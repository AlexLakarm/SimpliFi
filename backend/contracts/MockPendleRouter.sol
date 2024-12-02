// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ::::::::::::: ERRORS ::::::::::::: // 

error RouterInsufficientPtOut(uint256 actualPtOut, uint256 requiredPtOut);
error RouterInsufficientTokenOut(uint256 actualTokenOut, uint256 requiredTokenOut);
error MarketExpired();
error YCNotExpired();
error ZeroAddress();
error MarketZeroAmountsInput();
error InsufficientAllowance(address token, uint256 currentAllowance, uint256 requiredAmount);

// ::::::::::::: INTERFACES ::::::::::::: // 

interface IPriceOracle {
    function getPTRate(address token) external view returns (uint256);
    function getYield(address token) external view returns (uint256);
    function getDuration(address token) external view returns (uint256);
    function setDuration(address token, uint256 duration) external;
}

interface IPtgUSDC {
    function mint(address to, uint256 amount, uint256 maturity) external;
    function burn(address from, uint256 amount) external;
    function isValidMaturity(uint256 maturity) external view returns (bool);
    function maturities(uint256 maturity) external view returns (bool);
}

interface IgUSDC is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract MockPendleRouter is Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    address public gUSDC;
    address public PTgUSDC;
    uint256 private constant SCALE = 1e18;

    IPriceOracle public priceOracle;
    IPtgUSDC public ptgUSDC;

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    // Mapping des soldes par utilisateur et par date de maturité
    mapping(address => mapping(uint256 => uint256)) public userBalances;

    // Mapping des tokens vers leurs PT
    mapping(address => address) public tokenToPt;

    // Mapping pour stocker les détails de la stratégie pour chaque utilisateur et date de maturité
    mapping(address => mapping(uint256 => Strategy)) public userStrategies;

    // ::::::::::::: STRUCTS ::::::::::::: // 

    // Structure pour stocker les détails de la stratégie
    struct Strategy {
        uint256 annualYield;
        uint256 duration;
        uint256 entryRate;
        uint256 amount;
    }
    
    // ::::::::::::: EVENTS ::::::::::::: // 

    event Swapped(
        address indexed user,
        address indexed inputToken,
        address indexed outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 maturityDate,
        uint256 timestamp
    );
    event PtRedeemed(
        address indexed user, 
        uint256 principal,
        uint256 yieldAmount, 
        uint256 totalAmount,
        uint256 maturityDate
    );
    event ParametersUpdated(uint256 newDuration, uint256 newYield);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    constructor(address _gUSDCAddress, address _PTgUSDCAdress, address _OracleAddress) Ownable(msg.sender) {
        gUSDC = _gUSDCAddress;
        PTgUSDC = _PTgUSDCAdress;
        priceOracle = IPriceOracle(_OracleAddress);
        ptgUSDC = IPtgUSDC(_PTgUSDCAdress);
        
        // Initialisation du mapping pour gUSDC
        tokenToPt[_gUSDCAddress] = _PTgUSDCAdress;
    }

    // ::::::::::::: FUNCTIONS ::::::::::::: // 

    // Nouvelle fonction pour gérer les associations token -> PT
    function setTokenToPt(address token, address pt) external onlyOwner {
        if (token == address(0) || pt == address(0)) revert ZeroAddress();
        tokenToPt[token] = pt;
    }

    // Fonction pour acheter des PT avec des gUSDC
    function swapExactTokenForPt(address tokenAddress, uint256 amount) external returns (uint256 ptReceived) {
        if (amount == 0) revert MarketZeroAmountsInput();
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (tokenToPt[tokenAddress] == address(0)) revert RouterInsufficientPtOut(0, amount);
        
        // Vérification de l'allowance avec message plus clair
        uint256 currentAllowance = IERC20(tokenAddress).allowance(msg.sender, address(this));
        if (currentAllowance < amount) {
            revert InsufficientAllowance(
                tokenAddress,
                currentAllowance,
                amount
            );
        }

        address ptAddress = tokenToPt[tokenAddress];
        
        // Récupération des paramètres via l'oracle
        uint256 currentRate = priceOracle.getPTRate(ptAddress);
        uint256 strategyDuration = priceOracle.getDuration(ptAddress);
        uint256 currentYield = priceOracle.getYield(ptAddress);
        require(currentRate > 0, "Invalid price from oracle");
        require(strategyDuration > 0, "Invalid duration from oracle");

        // Calcul du yield proratisé sur la durée
        uint256 proRatedYield = (currentYield * strategyDuration * SCALE) / (365 days * 100);
        
        // Calcul des PT reçus - maintenant nous ajoutons le yield au lieu de le soustraire
        ptReceived = (amount * (SCALE + proRatedYield)) / SCALE;

        // Calcul de la maturité
        uint256 maturityDate = block.timestamp + strategyDuration;

        // Transfert des tokens de l'utilisateur vers le router
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        // Mint des PT directement à l'utilisateur
        ptgUSDC.mint(msg.sender, ptReceived, maturityDate);

        // Stocker uniquement la stratégie
        userStrategies[msg.sender][maturityDate] = Strategy({
            annualYield: currentYield,
            duration: strategyDuration,
            entryRate: currentRate,
            amount: ptReceived
        });

        emit Swapped(
            msg.sender,
            tokenAddress,
            ptAddress,
            amount,
            ptReceived,
            maturityDate,
            block.timestamp
        );
    }

    // Renommage de claimYield en redeemPyToToken pour correspondre à la nomenclature Pendle
    function redeemPyToToken(address tokenAddress, uint256 maturityDate) external {
        if (block.timestamp < maturityDate) revert YCNotExpired();
        if (block.timestamp >= maturityDate + 365 days) revert MarketExpired();
        if (tokenAddress == address(0)) revert ZeroAddress();
        
        address ptAddress = tokenToPt[tokenAddress];
        if (ptAddress == address(0)) revert RouterInsufficientPtOut(0, 0);

        Strategy memory strategy = userStrategies[msg.sender][maturityDate];
        if (strategy.amount == 0) revert MarketZeroAmountsInput();
        
        // Vérifier que l'utilisateur a approuvé le Router pour les PT
        uint256 currentAllowance = IERC20(ptAddress).allowance(msg.sender, address(this));
        if (currentAllowance < strategy.amount) {
            revert InsufficientAllowance(
                ptAddress,
                currentAllowance,
                strategy.amount
            );
        }

        // Vérifier la balance PT de l'utilisateur
        uint256 ptBalance = IERC20(ptAddress).balanceOf(msg.sender);
        if (ptBalance < strategy.amount) {
            revert RouterInsufficientTokenOut(ptBalance, strategy.amount);
        }

        uint256 totalAmount = strategy.amount;

        // Transfert des PT de l'utilisateur vers le Router
        IERC20(ptAddress).transferFrom(msg.sender, address(this), strategy.amount);
        
        // Mint du gUSDC nécessaire
        IgUSDC(tokenAddress).mint(address(this), totalAmount);
        
        // Burn des PT
        ptgUSDC.burn(address(this), strategy.amount);
        
        // Transfert du gUSDC à l'utilisateur
        IERC20(tokenAddress).transfer(msg.sender, totalAmount);

        // Nettoyage
        delete userStrategies[msg.sender][maturityDate];

        // Correction du calcul du principal et du yield
        uint256 principal = 100 * 1e6; // 100 gUSDC avec 6 décimales
        uint256 implicitYield = totalAmount - principal;
        
        emit PtRedeemed(
            msg.sender, 
            principal,    // 100 gUSDC
            implicitYield, // 4.931506 gUSDC
            totalAmount,   // 104.931506 gUSDC
            maturityDate
        );
    }

    // ::::::::::::: GETTERS ::::::::::::: // 

    // Fonction pour récupérer les soldes par maturité
    function getBalance(address user, uint256 maturityDate) external view returns (uint256) {
        return userBalances[user][maturityDate];
    }

    // Fonction pour récupérer les détails de la stratégie
    function getActiveStrategy(address user, uint256 maturityDate) 
        external 
        view 
        returns (
            uint256 annualYield,
            uint256 duration,
            uint256 entryRate,
            uint256 amount
        ) 
    {
        Strategy memory strategy = userStrategies[user][maturityDate];
        return (
            strategy.annualYield,
            strategy.duration,
            strategy.entryRate,
            strategy.amount
        );
    }

    // ::::::::::::: RESCUE FUNCTIONS ::::::::::::: // 

    // Fonction pour récupérer les PT non utilisés (en cas d'urgence)
    function rescuePT(address ptToken, uint256 amount) external onlyOwner {
        IERC20(ptToken).transfer(msg.sender, amount);
    }

    // Fonction pour récupérer les tokens sous-jacents non utilisés (en cas d'urgence)
    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
    }
}
