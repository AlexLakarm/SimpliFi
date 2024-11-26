// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PtgUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;
    
    // Mapping pour stocker les maturités par PT
    mapping(uint256 => bool) public maturities;

    constructor() ERC20("Principal Token gUSDC", "PT-gUSDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    // Fonction pour le minting des PT avec leur maturité
    function mint(address to, uint256 amount, uint256 maturity) external onlyOwner {
        require(maturity > block.timestamp, "Maturity must be in future");
        maturities[maturity] = true;
        _mint(to, amount);
    }

    // Fonction pour le burning des PT à maturité
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    // Fonction pour vérifier si une maturité existe
    function isValidMaturity(uint256 maturity) external view returns (bool) {
        return maturities[maturity];
    }
}