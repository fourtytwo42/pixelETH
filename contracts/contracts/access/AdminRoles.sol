// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title AdminRoles
 * @notice Minimal role-based access control for PixelCanvas
 * @dev Owner role covers UpgradeAdmin + ParamAdmin, separate Pauser role
 */
abstract contract AdminRoles is Initializable, OwnableUpgradeable {
    address public pauser;

    event PauserUpdated(address indexed oldPauser, address indexed newPauser);

    error NotAuthorized();

    modifier onlyPauser() {
        if (msg.sender != pauser && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    modifier onlyOwnerCustom() {
        if (msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    function __AdminRoles_init(address initialOwner, address initialPauser) internal onlyInitializing {
        __Ownable_init(initialOwner);
        _setPauser(initialPauser);
    }

    function setPauser(address newPauser) external onlyOwner {
        _setPauser(newPauser);
    }

    function _setPauser(address newPauser) internal {
        address oldPauser = pauser;
        pauser = newPauser;
        emit PauserUpdated(oldPauser, newPauser);
    }

    uint256[49] private __gap;
}
