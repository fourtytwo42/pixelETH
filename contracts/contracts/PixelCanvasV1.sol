// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IPixelCanvas.sol";
import "./access/AdminRoles.sol";
import "./libraries/BuyCalldataPacking.sol";

/**
 * @title PixelCanvasV1
 * @notice Core implementation of the pixel canvas game
 * @dev Single write-path through buyPacked, deterministic pricing, sparse storage
 */
contract PixelCanvasV1 is 
    IPixelCanvas, 
    AdminRoles, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    UUPSUpgradeable 
{
    using BuyCalldataPacking for bytes;

    // ============ STORAGE ============

    // Canvas dimensions (immutable after deployment)
    uint32 public width;
    uint32 public height;

    // Global parameters
    address public treasury;
    uint128 public basePrice;
    BiasMode public biasMode;
    uint16 public biasLinearAlphaBps;     // α in basis points (10000 = 1.0)
    uint16 public biasRationalKappaBps;   // κ in basis points (10000 = 1.0)
    uint16 public minMultBps;             // Minimum multiplier in basis points
    uint32 public maxMultBps;             // Maximum multiplier in basis points
    uint256 public maxBatch;              // Maximum pixels per transaction

    // Team counts
    uint32 public redCount;
    uint32 public blueCount;

    // Sparse pixel storage - only stores pixels that have been owned
    mapping(uint32 => Pixel) public pixels;

    // Pull-payment balances
    mapping(address => uint256) public pendingETH;

    // ============ CONSTANTS ============

    uint256 private constant BPS_BASE = 10000;
    uint256 private constant PRICE_STEP_NUMERATOR = 3;
    uint256 private constant PRICE_STEP_DENOMINATOR = 2;
    uint256 private constant TREASURY_FEE_BPS = 1000; // 10%
    uint256 private constant SELLER_SHARE_BPS = 9000; // 90%

    // ============ MODIFIERS ============


    // ============ INITIALIZATION ============

    function initialize(
        uint32 _width,
        uint32 _height,
        address _treasury,
        uint128 _basePrice,
        address _owner,
        address _pauser,
        uint256 _maxBatch
    ) external initializer {
        __AdminRoles_init(_owner, _pauser);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        width = _width;
        height = _height;
        treasury = _treasury;
        basePrice = _basePrice;
        maxBatch = _maxBatch;

        // Set default bias parameters
        biasMode = BiasMode.Linear;
        biasLinearAlphaBps = 10000; // α = 1.0
        minMultBps = 7500;          // 0.75x minimum
        maxMultBps = 30000;         // 3.0x maximum
    }

    // ============ CORE FUNCTIONALITY ============

    /**
     * @notice Buy multiple pixels in a single transaction
     * @param idsLE Little-endian packed pixel IDs (4 bytes each, strictly increasing)
     * @param colors24 Packed RGB colors (3 bytes each, 0xRRGGBB)
     * @param teamBits Packed team assignments (1 bit each, LSB first)
     * @param maxTotal Maximum total price willing to pay (slippage protection)
     */
    function buyPacked(
        bytes calldata idsLE,
        bytes calldata colors24,
        bytes calldata teamBits,
        uint256 maxTotal
    ) external payable {
        _requireNotPaused();
        if (idsLE.length == 0) return;
        
        uint256 numPixels = idsLE.length / 4;
        if (numPixels > maxBatch) revert BatchTooLarge();

        // Validate and decode inputs
        BuyCalldataPacking.validateLengths(numPixels, idsLE.length, colors24.length, teamBits.length);
        
        uint32[] memory ids = idsLE.decodeIdsLE();
        uint24[] memory colors = colors24.decodeColors24();
        uint8[] memory teams = teamBits.decodeTeamBits(numPixels);

        // Validate pixel IDs are within bounds
        uint32 maxId = width * height;
        for (uint256 i = 0; i < numPixels; i++) {
            if (ids[i] >= maxId) revert BadId();
        }

        // Snapshot multipliers once at transaction entry
        uint256 redMultBps = getMultiplierBps(0); // Red team
        uint256 blueMultBps = getMultiplierBps(1); // Blue team

        uint256 totalCost = 0;
        uint256 newRedCount = redCount;
        uint256 newBlueCount = blueCount;

        // Process each pixel
        for (uint256 i = 0; i < numPixels; i++) {
            uint32 id = ids[i];
            uint24 color = colors[i];
            uint8 team = teams[i];

            if (team > 1) revert BadId(); // Team must be 0 or 1

            Pixel storage pixel = pixels[id];
            address currentOwner = pixel.owner;
            uint8 currentTeam = pixel.meta & 1;

            // Calculate step price
            uint256 stepPrice;
            if (currentOwner == address(0)) {
                // First mint
                stepPrice = basePrice;
            } else {
                // Resale - price increases by 1.5x (with floor)
                uint256 newPrice = (uint256(pixel.lastPaid) * PRICE_STEP_NUMERATOR) / PRICE_STEP_DENOMINATOR;
                stepPrice = newPrice;
            }

            // Apply team multiplier
            uint256 multiplierBps = (team == 0) ? redMultBps : blueMultBps;
            uint256 finalPrice = (stepPrice * multiplierBps) / BPS_BASE;

            // Check for overflow in Profile A (uint64 storage)
            if (finalPrice > type(uint64).max) revert PriceOverflow();

            totalCost += finalPrice;

            // Handle payouts
            if (currentOwner == address(0)) {
                // First mint - 100% to treasury
                pendingETH[treasury] += finalPrice;
                
                // Increment team count
                if (team == 0) {
                    newRedCount++;
                } else {
                    newBlueCount++;
                }
            } else {
                // Resale - 90% to seller, 10% to treasury
                uint256 sellerAmount = (finalPrice * SELLER_SHARE_BPS) / BPS_BASE;
                uint256 treasuryAmount = finalPrice - sellerAmount;
                
                pendingETH[currentOwner] += sellerAmount;
                pendingETH[treasury] += treasuryAmount;

                // Update team counts if team changed
                if (currentTeam != team) {
                    if (currentTeam == 0) {
                        newRedCount--;
                        newBlueCount++;
                    } else {
                        newBlueCount--;
                        newRedCount++;
                    }
                }
            }

            // Update pixel state
            pixel.owner = msg.sender;
            pixel.lastPaid = uint64(finalPrice);
            pixel.color = color;
            pixel.meta = team; // Store team in bit 0

            // Emit event
            emit PixelBought(id, currentOwner, msg.sender, uint128(finalPrice), color, team);
        }

        // Update global team counts
        redCount = uint32(newRedCount);
        blueCount = uint32(newBlueCount);

        // Validate payment
        if (msg.value != totalCost) revert MsgValueMismatch();
        if (totalCost > maxTotal) revert SlippageExceeded();
    }

    /**
     * @notice Withdraw pending ETH balance
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingETH[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingETH[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Withdraw(msg.sender, amount);
    }

    // ============ ADMIN FUNCTIONS ============

    function pause() external onlyPauser {
        _pause();
    }

    function unpause() external onlyPauser {
        _unpause();
    }

    function setTreasury(address newTreasury) external onlyOwnerCustom {
        require(newTreasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit ParamsUpdated("treasury", uint256(uint160(oldTreasury)), uint256(uint160(newTreasury)));
    }

    function setBasePrice(uint128 newBasePrice) external onlyOwnerCustom {
        require(newBasePrice > 0, "Invalid base price");
        uint128 oldBasePrice = basePrice;
        basePrice = newBasePrice;
        emit ParamsUpdated("basePrice", oldBasePrice, newBasePrice);
    }

    function setBiasMode(BiasMode newMode) external onlyOwnerCustom {
        BiasMode oldMode = biasMode;
        biasMode = newMode;
        emit ParamsUpdated("biasMode", uint256(oldMode), uint256(newMode));
    }

    function setBiasLinearAlphaBps(uint16 newAlphaBps) external onlyOwnerCustom {
        uint16 oldAlphaBps = biasLinearAlphaBps;
        biasLinearAlphaBps = newAlphaBps;
        emit ParamsUpdated("biasLinearAlphaBps", oldAlphaBps, newAlphaBps);
    }

    function setBiasRationalKappaBps(uint16 newKappaBps) external onlyOwnerCustom {
        // Ensure κ < 1.0 to avoid division by zero
        require(newKappaBps < BPS_BASE, "Kappa must be < 1.0");
        uint16 oldKappaBps = biasRationalKappaBps;
        biasRationalKappaBps = newKappaBps;
        emit ParamsUpdated("biasRationalKappaBps", oldKappaBps, newKappaBps);
    }

    function setMultiplierClamps(uint16 newMinMultBps, uint32 newMaxMultBps) external onlyOwnerCustom {
        require(newMinMultBps <= BPS_BASE, "Min mult too high");
        require(newMaxMultBps >= BPS_BASE, "Max mult too low");
        require(newMinMultBps <= newMaxMultBps, "Invalid clamp range");
        
        uint16 oldMinMultBps = minMultBps;
        uint32 oldMaxMultBps = maxMultBps;
        
        minMultBps = newMinMultBps;
        maxMultBps = newMaxMultBps;
        
        emit ParamsUpdated("minMultBps", oldMinMultBps, newMinMultBps);
        emit ParamsUpdated("maxMultBps", oldMaxMultBps, newMaxMultBps);
    }

    function setMaxBatch(uint256 newMaxBatch) external onlyOwnerCustom {
        require(newMaxBatch > 0, "Invalid max batch");
        uint256 oldMaxBatch = maxBatch;
        maxBatch = newMaxBatch;
        emit ParamsUpdated("maxBatch", oldMaxBatch, newMaxBatch);
    }

    // ============ VIEW FUNCTIONS ============

    function getPixel(uint32 id) external view returns (address owner, uint64 lastPaid, uint24 color, uint8 team) {
        Pixel storage pixel = pixels[id];
        return (pixel.owner, pixel.lastPaid, pixel.color, pixel.meta & 1);
    }

    function getStepPrice(uint32 id) external view returns (uint256) {
        Pixel storage pixel = pixels[id];
        if (pixel.owner == address(0)) {
            return basePrice;
        } else {
            return (uint256(pixel.lastPaid) * PRICE_STEP_NUMERATOR) / PRICE_STEP_DENOMINATOR;
        }
    }

    function getMultiplierBps(uint8 team) public view returns (uint256) {
        uint256 totalOwned = uint256(redCount) + uint256(blueCount);
        if (totalOwned == 0) return BPS_BASE; // 1.0x when no pixels owned

        if (team > 1) revert BadId();

        uint256 teamCount = (team == 0) ? redCount : blueCount;
        uint256 otherCount = totalOwned - teamCount;

        // Calculate D in basis points: D = (teamCount - otherCount) * 10000 / totalOwned
        int256 numerator = int256(teamCount) - int256(otherCount);
        int256 D_bps = (numerator * int256(BPS_BASE)) / int256(totalOwned);

        uint256 multiplierBps;

        if (biasMode == BiasMode.Linear) {
            // M = 1 + α·D, where α and D are in basis points
            int256 bias = (int256(uint256(biasLinearAlphaBps)) * D_bps) / int256(BPS_BASE);
            multiplierBps = uint256(int256(BPS_BASE) + bias);
        } else {
            // Rational mode: M = (1 + κD) / (1 - κD)
            int256 kD = (int256(uint256(biasRationalKappaBps)) * D_bps) / int256(BPS_BASE);
            int256 denominator = int256(BPS_BASE) - kD;
            
            if (denominator <= 0) revert DenominatorZero();
            
            int256 numeratorRational = int256(BPS_BASE) + kD;
            multiplierBps = uint256((numeratorRational * int256(BPS_BASE)) / denominator);
        }

        // Apply clamps
        if (multiplierBps < minMultBps) {
            multiplierBps = minMultBps;
        } else if (multiplierBps > maxMultBps) {
            multiplierBps = maxMultBps;
        }

        return multiplierBps;
    }

    function quotePrice(uint32 id, uint8 team) external view returns (uint256) {
        uint256 stepPrice = this.getStepPrice(id);
        uint256 multiplierBps = getMultiplierBps(team);
        return (stepPrice * multiplierBps) / BPS_BASE;
    }

    function getTeamCounts() external view returns (uint32, uint32) {
        return (redCount, blueCount);
    }

    function getCurrentPrices(uint32[] calldata ids) external view returns (uint256[] memory prices) {
        prices = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            prices[i] = this.getStepPrice(ids[i]);
        }
    }

    function isPaused() external view returns (bool) {
        return paused();
    }

    // ============ UUPS UPGRADE ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwnerCustom {}

    // ============ GAPS ============

    uint256[40] private __gap;
}
