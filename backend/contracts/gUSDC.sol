// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract gUSDC is ERC20, Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    uint8 private constant _DECIMALS = 6; // USDC a 6 décimales
    address private routerAddress;

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    constructor(uint256 initialSupply) ERC20("Gains USDC", "gUSDC") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    // ::::::::::::: FUNCTIONS ::::::::::::: // 

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    // Fonction pour simuler le mint de yield
    // Dans un cas réel, ce yield proviendrait du protocole sous-jacent (ex: Granary)
    function mint(address to, uint256 amount) external {
        require(msg.sender == routerAddress, "Only Router can mint");
        _mint(to, amount);
    }

    // ::::::::::::: PARAMETERS ::::::::::::: // 

    // Fonction pour définir l'adresse du router
    function setRouterAddress(address _routerAddress) external onlyOwner {
        require(_routerAddress != address(0), "Invalid router address");
        routerAddress = _routerAddress;
    }

}