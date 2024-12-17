// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ::::::::::::: ERRORS ::::::::::::: // 

/// @notice Thrown when PT output amount is insufficient
error RouterInsufficientPtOut(uint256 actualPtOut, uint256 requiredPtOut);

/// @notice Thrown when token output amount is insufficient
error RouterInsufficientTokenOut(uint256 actualTokenOut, uint256 requiredTokenOut);

/// @notice Thrown when trying to interact with an expired market
error MarketExpired();

/// @notice Thrown when trying to redeem before maturity
error YCNotExpired();

/// @notice Thrown when a zero address is provided
error ZeroAddress();

/// @notice Thrown when market input amounts are zero
error MarketZeroAmountsInput();

/// @notice Thrown when token allowance is insufficient
error InsufficientAllowance(address token, uint256 currentAllowance, uint256 requiredAmount);

/// @notice Thrown when amount is insufficient or zero
error InsufficientAmount();

// ::::::::::::: INTERFACES ::::::::::::: // 

/// @notice Interface for the price oracle contract
interface IPriceOracle {
    function getPTRate(address token) external view returns (uint256);
    function getYield(address token) external view returns (uint256);
    function getDuration(address token) external view returns (uint256);
    function setDuration(address token, uint256 duration) external;
}

/// @notice Interface for the PT gUSDC token
interface IPtgUSDC {
    function mint(address to, uint256 amount, uint256 maturity) external;
    function burn(address from, uint256 amount) external;
    function isValidMaturity(uint256 maturity) external view returns (bool);
    function maturities(uint256 maturity) external view returns (bool);
}

/// @notice Interface for the gUSDC token
interface IgUSDC is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @title MockPendleRouter
/// @notice Mock contract simulating Pendle's router functionality for testing purposes
/// @dev Implements basic swap and redemption functionality with mock data
contract MockPendleRouter is Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    /// @notice Address of the gUSDC token
    address public gUSDC;

    /// @notice Address of the PT gUSDC token
    address public PTgUSDC;

    /// @notice Scale factor for precision (1e18)
    uint256 private constant SCALE = 1e18;

    /// @notice Price oracle interface
    IPriceOracle public priceOracle;

    /// @notice PT gUSDC interface
    IPtgUSDC public ptgUSDC;

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    /// @notice Mapping of user balances by maturity date
    mapping(address => mapping(uint256 => uint256)) public userBalances;

    /// @notice Mapping of tokens to their PT tokens
    mapping(address => address) public tokenToPt;

    /// @notice Mapping of PT tokens to their underlying tokens
    mapping(address => address) public ptToToken;

    /// @notice Mapping of user strategies by maturity date
    mapping(address => mapping(uint256 => Strategy)) public userStrategies;

    // ::::::::::::: STRUCTS ::::::::::::: // 

    /// @notice Structure to store strategy details
    /// @param annualYield Annual yield percentage
    /// @param duration Strategy duration in seconds
    /// @param entryRate Entry rate for the strategy
    /// @param amount Amount of tokens in the strategy
    struct Strategy {
        uint256 annualYield;
        uint256 duration;
        uint256 entryRate;
        uint256 amount;
    }
    
    // ::::::::::::: EVENTS ::::::::::::: // 

    /// @notice Emitted when a swap occurs
    event Swapped(
        address indexed user,
        address indexed inputToken,
        address indexed outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 maturityDate,
        uint256 timestamp
    );

    /// @notice Emitted when PT tokens are redeemed
    event PtRedeemed(
        address indexed user, 
        uint256 principal,
        uint256 yieldAmount, 
        uint256 totalAmount,
        uint256 maturityDate
    );

    /// @notice Emitted when parameters are updated
    event ParametersUpdated(uint256 newDuration, uint256 newYield);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initializes the router with necessary token and oracle addresses
    /// @param _gUSDCAddress Address of the gUSDC token
    /// @param _PTgUSDCAdress Address of the PT gUSDC token
    /// @param _OracleAddress Address of the price oracle
    constructor(address _gUSDCAddress, address _PTgUSDCAdress, address _OracleAddress) Ownable(msg.sender) {
        gUSDC = _gUSDCAddress;
        PTgUSDC = _PTgUSDCAdress;
        priceOracle = IPriceOracle(_OracleAddress);
        ptgUSDC = IPtgUSDC(_PTgUSDCAdress);
        
        // Initialize mappings for gUSDC
        tokenToPt[_gUSDCAddress] = _PTgUSDCAdress;
        ptToToken[_PTgUSDCAdress] = _gUSDCAddress;
    }

    // ::::::::::::: EXTERNAL FUNCTIONS ::::::::::::: // 

    /// @notice Swaps exact amount of tokens for PT tokens
    /// @param tokenAddress Address of the input token
    /// @param amount Amount of tokens to swap
    /// @return ptReceived Amount of PT tokens received
    function swapExactTokenForPt(
        address tokenAddress,
        uint256 amount
    ) external returns (uint256 ptReceived) {
        if (amount == 0) revert MarketZeroAmountsInput();
        if (tokenAddress == address(0)) revert ZeroAddress();
        
        address ptAddress = tokenToPt[tokenAddress];
        
        // Get parameters from oracle
        uint256 currentRate = priceOracle.getPTRate(ptAddress);
        uint256 strategyDuration = priceOracle.getDuration(ptAddress);
        uint256 currentYield = priceOracle.getYield(ptAddress);
        require(currentRate > 0, "Invalid price from oracle");
        require(strategyDuration > 0, "Invalid duration from oracle");

        // Calculate pro-rated yield over duration
        uint256 proRatedYield = (currentYield * strategyDuration * SCALE) / (365 days * 100);
        
        // Calculate PT received - now adding yield instead of subtracting
        ptReceived = (amount * (SCALE + proRatedYield)) / SCALE;

        // Calculate maturity date
        uint256 maturityDate = block.timestamp + strategyDuration;

        // Store strategy details before external calls
        userStrategies[msg.sender][maturityDate] = Strategy({
            annualYield: currentYield,
            duration: strategyDuration,
            entryRate: currentRate,
            amount: ptReceived
        });

        // Vérifier l'allowance avant le transferFrom
        uint256 currentAllowance = IERC20(tokenAddress).allowance(msg.sender, address(this));
        if (currentAllowance < amount) {
            revert InsufficientAllowance(tokenAddress, currentAllowance, amount);
        }

        // External calls after state changes
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        ptgUSDC.mint(msg.sender, ptReceived, maturityDate);

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

    /// @notice Redeems PT tokens for underlying tokens at maturity
    /// @param ptToken Address of the PT token to redeem
    /// @param ptAmount Amount of PT tokens to redeem
    function redeemPyToToken(address ptToken, uint256 ptAmount) external returns (uint256) {
        if (ptToken == address(0)) revert ZeroAddress();
        if (ptAmount == 0) revert InsufficientAmount();

        // Get the underlying token
        address underlyingToken = ptToToken[ptToken];
        if (underlyingToken == address(0)) revert RouterInsufficientPtOut(0, 0);

        // Vérifier la balance de PT tokens de l'utilisateur
        uint256 ptBalance = IERC20(ptToken).balanceOf(msg.sender);
        if (ptBalance < ptAmount) revert InsufficientAmount();

        // Vérifier l'allowance des PT tokens
        uint256 ptAllowance = IERC20(ptToken).allowance(msg.sender, address(this));
        if (ptAllowance < ptAmount) {
            revert InsufficientAllowance(ptToken, ptAllowance, ptAmount);
        }

        // Transfer PT tokens from sender to router
        IERC20(ptToken).transferFrom(msg.sender, address(this), ptAmount);

        // Burn PT tokens
        IPtgUSDC(ptToken).burn(address(this), ptAmount);

        // Mint underlying tokens to this contract
        IgUSDC(underlyingToken).mint(address(this), ptAmount);

        // Transfer underlying tokens to sender
        IERC20(underlyingToken).transfer(msg.sender, ptAmount);

        return ptAmount;
    }

    // ::::::::::::: ADMIN FUNCTIONS ::::::::::::: // 

    /// @notice Sets the mapping between a token and its PT token
    /// @param tokenAddress Address of the underlying token
    /// @param ptAddress Address of the PT token
    function setTokenToPt(address tokenAddress, address ptAddress) external onlyOwner {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (ptAddress == address(0)) revert ZeroAddress();
        tokenToPt[tokenAddress] = ptAddress;
    }

    /// @notice Permet au propriétaire de récupérer les PT tokens bloqués
    /// @param ptAddress Adresse du token PT
    /// @param amount Montant à récupérer
    function rescuePT(address ptAddress, uint256 amount) external onlyOwner {
        if (ptAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert MarketZeroAmountsInput();
        IERC20(ptAddress).transfer(msg.sender, amount);
    }

    /// @notice Permet au propriétaire de récupérer les tokens sous-jacents bloqués
    /// @param tokenAddress Adresse du token
    /// @param amount Montant à récupérer
    function rescueToken(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert MarketZeroAmountsInput();
        IERC20(tokenAddress).transfer(msg.sender, amount);
    }

    /// @notice Récupère les détails d'une stratégie active
    /// @param user Adresse de l'utilisateur
    /// @param maturityDate Date de maturité de la stratégie
    /// @return Strategy Les détails de la stratégie
    function getActiveStrategy(address user, uint256 maturityDate) external view returns (Strategy memory) {
        Strategy memory strategy = userStrategies[user][maturityDate];
        require(strategy.amount > 0, "No active strategy found");
        return strategy;
    }
}
