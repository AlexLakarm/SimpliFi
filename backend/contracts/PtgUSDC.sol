// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PtgUSDC
/// @notice Principal Token for gUSDC, representing tokenized yield-bearing positions
/// @dev Extends ERC20 and Ownable for basic token functionality and access control
contract PtgUSDC is ERC20, Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    /// @notice Number of decimals for the token
    /// @dev Matches the decimals of the underlying gUSDC token
    uint8 private constant _DECIMALS = 6;

    /// @notice Mapping to track valid maturity dates for Principal Tokens
    /// @dev Maps maturity timestamp to validity status
    mapping(uint256 => bool) public maturities;

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initializes the Principal Token contract
    /// @dev Sets up the token with name "Principal Token gUSDC" and symbol "PT-gUSDC"
    constructor() ERC20("Principal Token gUSDC", "PT-gUSDC") Ownable(msg.sender) {}

    // ::::::::::::: FUNCTIONS ::::::::::::: // 

    /// @notice Returns the number of decimals used by the token
    /// @return uint8 The number of decimals
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mints new Principal Tokens with a specific maturity date
    /// @param to Address to receive the minted tokens
    /// @param amount Amount of tokens to mint
    /// @param maturity Timestamp when the Principal Tokens mature
    /// @dev Can only be called by the contract owner
    function mint(address to, uint256 amount, uint256 maturity) external onlyOwner {
        require(maturity > block.timestamp, "Maturity must be in future");
        maturities[maturity] = true;
        _mint(to, amount);
    }

    /// @notice Burns Principal Tokens when they reach maturity
    /// @param from Address from which to burn tokens
    /// @param amount Amount of tokens to burn
    /// @dev Can only be called by the contract owner
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    /// @notice Checks if a given maturity timestamp is valid
    /// @param maturity Timestamp to check
    /// @return bool True if the maturity timestamp is valid
    function isValidMaturity(uint256 maturity) external view returns (bool) {
        return maturities[maturity];
    }
}