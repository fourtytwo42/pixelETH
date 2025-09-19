// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPixelCanvas
 * @notice Interface for the pixel canvas game contract
 * @dev Canonical ABI surface for the pixel purchasing game
 */
interface IPixelCanvas {
    // ============ STRUCTS ============

    struct Pixel {
        address owner;
        uint64 lastPaid;  // Profile A: uint64 for gas optimization
        uint24 color;     // RGB color (0xRRGGBB)
        uint8 meta;       // bit0: team (0=Red, 1=Blue), bits 7:1 reserved
    }

    struct TeamCounts {
        uint32 redCount;
        uint32 blueCount;
    }

    // ============ ENUMS ============

    enum BiasMode {
        Linear,
        Rational
    }

    // ============ EVENTS ============

    event PixelBought(
        uint32 indexed id,
        address from,
        address to,
        uint128 pricePaid,
        uint24 color,
        uint8 team
    );

    event Withdraw(address indexed to, uint256 amount);

    event ParamsUpdated(string param, uint256 oldValue, uint256 newValue);

    // ============ CUSTOM ERRORS ============

    error ContractPaused();
    error BatchTooLarge();
    error BadId();
    error LenMismatch();
    error IdsNotStrictlyIncreasing();
    error MsgValueMismatch();
    error SlippageExceeded();
    error PriceOverflow();
    error NothingToWithdraw();
    error DenominatorZero();
    error InvalidClamps();

    // ============ MUTATING FUNCTIONS ============

    function buyPacked(
        bytes calldata idsLE,
        bytes calldata colors24,
        bytes calldata teamBits,
        uint256 maxTotal
    ) external payable;

    function withdraw() external;

    function pause() external;

    function unpause() external;

    // ============ ADMIN FUNCTIONS ============

    function setTreasury(address newTreasury) external;

    function setBasePrice(uint128 newBasePrice) external;

    function setBiasMode(BiasMode newMode) external;

    function setBiasLinearAlphaBps(uint16 newAlphaBps) external;

    function setBiasRationalKappaBps(uint16 newKappaBps) external;

    function setMultiplierClamps(uint16 newMinMultBps, uint32 newMaxMultBps) external;

    function setMaxBatch(uint256 newMaxBatch) external;

    // ============ VIEW FUNCTIONS ============

    function getPixel(uint32 id) external view returns (address owner, uint64 lastPaid, uint24 color, uint8 team);

    function getStepPrice(uint32 id) external view returns (uint256);

    function getMultiplierBps(uint8 team) external view returns (uint256);

    function quotePrice(uint32 id, uint8 team) external view returns (uint256);

    function getTeamCounts() external view returns (uint32 redCount, uint32 blueCount);

    function width() external view returns (uint32);

    function height() external view returns (uint32);

    function basePrice() external view returns (uint128);

    function maxBatch() external view returns (uint256);

    function treasury() external view returns (address);

    function biasMode() external view returns (BiasMode);

    function biasLinearAlphaBps() external view returns (uint16);

    function biasRationalKappaBps() external view returns (uint16);

    function minMultBps() external view returns (uint16);

    function maxMultBps() external view returns (uint32);

    function pendingETH(address account) external view returns (uint256);

    function isPaused() external view returns (bool);

    function getCurrentPrices(uint32[] calldata ids) external view returns (uint256[] memory);
}
