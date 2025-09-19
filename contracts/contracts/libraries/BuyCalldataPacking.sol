// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BuyCalldataPacking
 * @notice Pure functions for decoding packed calldata in buyPacked
 * @dev Handles little-endian uint32 ids, RGB colors, and team bitfields
 */
library BuyCalldataPacking {
    error LenMismatch();
    error IdsNotStrictlyIncreasing();

    /**
     * @notice Decode little-endian uint32 array from bytes
     * @param data Packed bytes, 4 bytes per uint32, little-endian
     * @return ids Array of pixel IDs
     */
    function decodeIdsLE(bytes calldata data) internal pure returns (uint32[] memory ids) {
        if (data.length % 4 != 0) revert LenMismatch();
        
        uint256 count = data.length / 4;
        ids = new uint32[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 offset = i * 4;
            ids[i] = uint32(
                uint256(uint8(data[offset])) |
                (uint256(uint8(data[offset + 1])) << 8) |
                (uint256(uint8(data[offset + 2])) << 16) |
                (uint256(uint8(data[offset + 3])) << 24)
            );
        }
        
        // Verify strictly increasing
        for (uint256 i = 1; i < count; i++) {
            if (ids[i] <= ids[i - 1]) revert IdsNotStrictlyIncreasing();
        }
    }

    /**
     * @notice Decode RGB colors from packed bytes
     * @param data Packed bytes, 3 bytes per color (0xRRGGBB)
     * @return colors Array of 24-bit RGB colors
     */
    function decodeColors24(bytes calldata data) internal pure returns (uint24[] memory colors) {
        if (data.length % 3 != 0) revert LenMismatch();
        
        uint256 count = data.length / 3;
        colors = new uint24[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 offset = i * 3;
            colors[i] = uint24(
                (uint256(uint8(data[offset])) << 16) |
                (uint256(uint8(data[offset + 1])) << 8) |
                uint256(uint8(data[offset + 2]))
            );
        }
    }

    /**
     * @notice Decode team bitfield from packed bytes
     * @param data Packed bytes, LSB-first bitfield
     * @param expectedCount Number of pixels expected
     * @return teams Array of team assignments (0=Red, 1=Blue)
     */
    function decodeTeamBits(bytes calldata data, uint256 expectedCount) 
        internal 
        pure 
        returns (uint8[] memory teams) 
    {
        uint256 requiredBytes = (expectedCount + 7) / 8;
        if (data.length < requiredBytes) revert LenMismatch();
        
        teams = new uint8[](expectedCount);
        
        for (uint256 i = 0; i < expectedCount; i++) {
            uint256 byteIndex = i / 8;
            uint256 bitIndex = i % 8;
            teams[i] = (uint8(data[byteIndex]) >> bitIndex) & 1;
        }
    }

    /**
     * @notice Validate input lengths match
     * @param numPixels Expected number of pixels
     * @param idsLength Length of IDs bytes array
     * @param colorsLength Length of colors bytes array  
     * @param teamBitsLength Length of team bits bytes array
     */
    function validateLengths(
        uint256 numPixels,
        uint256 idsLength,
        uint256 colorsLength,
        uint256 teamBitsLength
    ) internal pure {
        if (idsLength != numPixels * 4) revert LenMismatch();
        if (colorsLength != numPixels * 3) revert LenMismatch();
        if (teamBitsLength < (numPixels + 7) / 8) revert LenMismatch();
    }
}
