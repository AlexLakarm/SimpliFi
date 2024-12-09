// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title gUSDC
/// @notice Mock USDC token with yield generation capabilities
/// @dev Extends ERC20 and Ownable for basic token functionality and access control
contract gUSDC is ERC20, Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    /// @notice Number of decimals for the token
    /// @dev USDC uses 6 decimals
    uint8 private constant _DECIMALS = 6;
    /// @notice Address of the router contract that can mint tokens
    address private routerAddress;

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initializes the gUSDC token with an initial supply
    /// @param initialSupply The initial amount of tokens to mint
    /// @dev The initial supply is minted to the contract deployer
    constructor(uint256 initialSupply) ERC20("Gains USDC", "gUSDC") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    // ::::::::::::: FUNCTIONS ::::::::::::: // 

    /// @notice Returns the number of decimals used by the token
    /// @return uint8 The number of decimals
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mints new tokens to simulate yield generation
    /// @param to Address to receive the minted tokens
    /// @param amount Amount of tokens to mint
    /// @dev In a real implementation, yield would come from the underlying protocol (e.g., Granary)
    function mint(address to, uint256 amount) external {
        require(msg.sender == routerAddress, "Only Router can mint");
        _mint(to, amount);
    }

    // ::::::::::::: PARAMETERS ::::::::::::: // 

    /// @notice Sets the address of the router contract
    /// @param _routerAddress Address of the router contract
    /// @dev Can only be called by the contract owner
    function setRouterAddress(address _routerAddress) external onlyOwner {
        require(_routerAddress != address(0), "Invalid router address");
        routerAddress = _routerAddress;
    }
}