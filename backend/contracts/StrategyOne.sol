// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ::::::::::::: INTERFACES ::::::::::::: // 

/// @title IRoleControl
/// @notice Interface for role management
interface IRoleControl {
    function getClientCGP(address client) external view returns (address);
    function isAdmin(address account) external view returns (bool);
    function isCGP(address account) external view returns (bool);
    function isClient(address account) external view returns (bool);
}

/// @title IMockPendleRouter
/// @notice Simplified interface for the router
interface IMockPendleRouter {
    function gUSDC() external view returns (address);
    function PTgUSDC() external view returns (address);
    function swapExactTokenForPt(address tokenIn, uint256 amountIn) external returns (uint256);
    function redeemPyToToken(address ptToken, uint256 ptAmount) external returns (uint256);
}

/// @title IMockPendleOracle
/// @notice Interface for the Pendle oracle
interface IMockPendleOracle {
    function getDuration(address ptToken) external view returns (uint256);
    function getYield(address ptToken) external view returns (uint256);
    function getPTRate(address ptToken) external view returns (uint256);
}

/// @title IStrategyNFT
/// @notice Interface for the NFT contract
interface IStrategyNFT {
    function mintStrategyNFT(
        address to,
        uint256 initialAmount,
        uint256 duration,
        uint256 strategyId
    ) external returns (uint256);

    function burn(uint256 positionId) external;
    function ownerOf(uint256 positionId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function approve(address to, uint256 tokenId) external;
}

/// @title StrategyOne
/// @notice Main contract for managing investment strategies
/// @dev Implements logic for position management, NFTs, and fees
contract StrategyOne is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ::::::::::::: STATE VARIABLES ::::::::::::: //

    /// @notice Maximum number of active positions per user to prevent DoS attacks
    uint256 private constant MAX_POSITIONS_PER_USER = 15;

    /// @notice Address of the router for swap operations
    address public immutable router;
    /// @notice Address of the oracle for price data
    address public immutable oracle;
    /// @notice Address of the role control contract
    address public immutable roleControl;
    /// @notice Address of the NFT contract
    address public immutable nftContract;
    /// @notice Fee points for the protocol (1 point = 0.01%)
    uint256 public protocolFeePoints;
    /// @notice Fee points for the CGP (1 point = 0.01%)
    uint256 public cgpFeePoints;       
    /// @notice Total number of active positions
    uint256 private allActivePositionsCount;

    // ::::::::::::: STRUCTS ::::::::::::: //

    /// @notice Structure representing an investment position
    /// @param gUSDCAmount Initial amount in gUSDC
    /// @param ptAmount Amount of PT received
    /// @param entryDate Entry date into the position
    /// @param maturityDate Maturity date of the position
    /// @param exitDate Exit date of the position
    /// @param isActive Indicates if the position is active
    /// @param allPositionsId Global unique ID of the position
    /// @param owner Address of the position owner
    struct Position {
        uint256 gUSDCAmount;
        uint256 ptAmount;
        uint256 entryDate;
        uint256 maturityDate;
        uint256 exitDate;
        bool isActive;
        uint256 allPositionsId;
        address owner;
    }

    /// @notice Structure for calculating yields
    /// @param totalYield Total yield of the position
    /// @param protocolYield Yield for the protocol
    /// @param cgpYield Yield for the CGP
    /// @param clientYield Yield for the client
    struct PositionYield {
        uint256 totalYield;
        uint256 protocolYield;
        uint256 cgpYield;
        uint256 clientYield;
    }

    /// @notice Structure pour la gestion des frais
    /// @param nonMaturedFees Fees of positions not matured
    /// @param maturedNonWithdrawnFees Fees of matured positions not withdrawn
    /// @param withdrawnFees Total fees already withdrawn
    struct Fees {
        uint256 nonMaturedFees;
        uint256 maturedNonWithdrawnFees;
        uint256 withdrawnFees;
    }

    /// @notice Structure pour la gestion des ventes de NFT
    /// @param salePrice Sale price in gUSDC
    /// @param isOnSale Indicates if the NFT is on sale
    struct NFTSale {
        uint256 salePrice;
        bool isOnSale;
    }

    // ::::::::::::: MAPPINGS ::::::::::::: //

    /// @notice Positions of each user
    mapping(address => Position[]) public userPositions;
    /// @notice Yields of each position by user
    mapping(address => PositionYield[]) public yields;
    /// @notice Number of active positions per user
    mapping(address => uint256) public userPositionCount;
    /// @notice Mapping of all positions by ID
    mapping(uint256 => Position) public allPositions;
    /// @notice Sale information for each NFT, indexed by allPositionsId
    /// @dev The key is allPositionsId (and not NFTid which would be allPositionsId + 1)
    mapping(uint256 => NFTSale) public nftSales;
    /// @notice Fees of the protocol
    Fees public protocolFees;
    /// @notice Fees per CGP
    mapping(address => Fees) public cgpFees;

    // ::::::::::::: EVENTS ::::::::::::: //

    // :::: STRATEGY EVENTS :::: //

    /// @notice Emitted when a new position is created
    /// @param user Address of the user
    /// @param NFTid ID of the NFT
    /// @param amount Amount invested in gUSDC
    /// @param ptReceived Amount of PT received
    /// @param entryDate Entry date
    /// @param maturityDate Maturity date
    event StrategyEntered(
        address indexed user,
        uint256 indexed NFTid,
        uint256 amount,
        uint256 ptReceived,
        uint256 entryDate,
        uint256 maturityDate
    );

    /// @notice Emitted when a position is closed
    /// @param user Address of the user
    /// @param NFTid ID of the NFT
    /// @param initialAmount Initial amount invested
    /// @param finalAmount Final amount received
    /// @param yieldEarned Yield earned
    /// @param exitDate Exit date
    event StrategyExited(
        address indexed user,
        uint256 indexed NFTid,
        uint256 initialAmount,
        uint256 finalAmount,
        uint256 yieldEarned,
        uint256 exitDate
    );

    // :::: NFT EVENTS :::: //

    /// @notice Emitted when an NFT is listed for sale
    event NFTListedForSale(
        uint256 indexed NFTid,
        uint256 allPositionsId,
        uint256 price,
        address seller
    );

    /// @notice Emitted when an NFT is sold
    event NFTSold(
        uint256 indexed NFTid,
        uint256 allPositionsId,
        address seller,
        address buyer,
        uint256 price
    );

    /// @notice Emitted when an NFT sale is canceled
    event NFTSaleCanceled(
        uint256 indexed NFTid,
        uint256 allPositionsId,
        address seller
    );

    /// @notice Emitted when fees are collected
    event FeesCollected(
        address indexed cgp,
        uint256 cgpAmount,
        uint256 protocolAmount,
        uint256 totalAmount,
        uint256 timestamp
    );

    // :::: FEES EVENTS :::: //

    /// @notice Emitted when pending fees are updated
    event PendingFeesUpdated(
        address indexed cgp,
        uint256 cgpPendingFees,
        uint256 protocolPendingFees
    );

    /// @notice Emitted when protocol fees are withdrawn
    event ProtocolFeesWithdrawn(
        address indexed admin,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when CGP fees are withdrawn
    event CGPFeesWithdrawn(
        address indexed cgp,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when fee points are updated
    event FeePointsUpdated(
        uint256 oldProtocolFeePoints,
        uint256 newProtocolFeePoints,
        uint256 oldCGPFeePoints,
        uint256 newCGPFeePoints,
        uint256 timestamp
    );

    // ::::::::::::: MODIFIERS ::::::::::::: //

    /// @notice Restricts access to admins
    modifier onlyAdmin() {
        require(IRoleControl(roleControl).isAdmin(msg.sender), "Caller is not an admin");
        _;
    }

    /// @notice Restricts access to CGPs
    modifier onlyCGP() {
        require(IRoleControl(roleControl).isCGP(msg.sender), "Caller is not a CGP");
        _;
    }

    /// @notice Restricts access to clients
    modifier onlyClient() {
        require(IRoleControl(roleControl).isClient(msg.sender), "Caller is not a client");
        _;
    }

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initializes the contract with necessary addresses
    /// @param _router Address of the router
    /// @param _oracle Address of the oracle
    /// @param _roleControl Address of the role control contract
    /// @param _nftContract Address of the NFT contract
    constructor(
        address _router,
        address _oracle,
        address _roleControl,
        address _nftContract
    ) {
        require(_router != address(0), "Invalid router address");
        require(_oracle != address(0), "Invalid oracle address");
        require(_roleControl != address(0), "Invalid role control address");
        require(_nftContract != address(0), "Invalid NFT contract address");
        
        router = _router;
        oracle = _oracle;
        roleControl = _roleControl;
        nftContract = _nftContract;
        protocolFeePoints = 1;
        cgpFeePoints = 1;
        allActivePositionsCount = 0;
    }

    // ::::::::::::: SMART CONTRACT FUNCTIONS ::::::::::::: // 

    /// @notice Creates a new investment position
    /// @param amount Amount in gUSDC to invest
    /// @dev Protected against reentrancy and follows checks-effects-interactions pattern
    function enterStrategy(uint256 amount) external nonReentrant onlyClient {
        // Initial checks
        require(amount > 0, "Amount must be greater than 0");
        require(userPositionCount[msg.sender] < MAX_POSITIONS_PER_USER, "Max positions limit reached");
        
        // Get client's CGP
        address clientCGP = IRoleControl(roleControl).getClientCGP(msg.sender);
        require(clientCGP != address(0), "Client has no CGP");

        // Create the position
        _createPosition(amount, clientCGP);
    }

    /// @notice Internal function to create a position
    /// @param amount Amount in gUSDC to invest
    /// @param clientCGP Address of the client's CGP
    /// @dev Handles token transfers, yield calculations, and NFT minting
    function _createPosition(uint256 amount, address clientCGP) internal {
        // Get token addresses
        address underlyingToken = IMockPendleRouter(router).gUSDC();
        address ptToken = IMockPendleRouter(router).PTgUSDC();

        // Transfer tokens from user
        IERC20(underlyingToken).transferFrom(msg.sender, address(this), amount);
        
        // Reset approval before setting new amount
        IERC20(underlyingToken).approve(router, 0);
        IERC20(underlyingToken).approve(router, amount);

        // Swap via Pendle Router
        uint256 ptReceived = IMockPendleRouter(router).swapExactTokenForPt(underlyingToken, amount);

        // ::: CALCULATE FEES AND YIELDS ::::: // 

        (uint256 yieldAmount, uint256 protocolFeesAmount, uint256 cgpFeesAmount) = _calculateFees(amount, ptToken);

        // Vérifier que les frais ne dépassent pas le yield
        require(protocolFeesAmount + cgpFeesAmount <= yieldAmount, "Fees exceed yield");

        // Update pending fees
        protocolFees.nonMaturedFees += protocolFeesAmount;
        cgpFees[clientCGP].nonMaturedFees += cgpFeesAmount;

        emit PendingFeesUpdated(clientCGP, cgpFees[clientCGP].nonMaturedFees, protocolFees.nonMaturedFees);

        // ::: CREATE POSITION DATA ::: // 

        uint256 maturityDate = block.timestamp + IMockPendleOracle(oracle).getDuration(ptToken);
        uint256 currentAllPositionsId = allActivePositionsCount++;

        Position memory newPosition = Position({
            gUSDCAmount: amount,
            ptAmount: ptReceived,
            entryDate: block.timestamp,
            maturityDate: maturityDate,
            exitDate: 0,
            isActive: true,
            allPositionsId: currentAllPositionsId,
            owner: msg.sender
        });

        // Update position mappings
        userPositions[msg.sender].push(newPosition);
        allPositions[currentAllPositionsId] = newPosition;
        userPositionCount[msg.sender]++;

        // Calculer le yield client (en vérifiant qu'il n'y a pas d'overflow)
        uint256 clientYield = yieldAmount;
        if (protocolFeesAmount + cgpFeesAmount <= yieldAmount) {
            clientYield = yieldAmount - protocolFeesAmount - cgpFeesAmount;
        }

        // Store yield data
        yields[msg.sender].push(PositionYield({
            totalYield: yieldAmount,
            protocolYield: protocolFeesAmount,
            cgpYield: cgpFeesAmount,
            clientYield: clientYield
        }));

        // Mint NFT
        uint256 NFTid = IStrategyNFT(nftContract).mintStrategyNFT(
            msg.sender,
            amount,
            IMockPendleOracle(oracle).getDuration(ptToken),
            currentAllPositionsId
        );

        emit StrategyEntered(
            msg.sender,
            NFTid,
            amount,
            ptReceived,
            block.timestamp,
            maturityDate
        );
    }

    /// @notice Calculates fees for a position
    /// @param amount Initial amount of the position
    /// @return yieldAmount Total yield amount
    /// @return protocolFeesAmount Fees for the protocol
    /// @return cgpFeesAmount Fees for the CGP
    function _calculateFees(uint256 amount, address ptToken) internal view returns (
        uint256 yieldAmount,
        uint256 protocolFeesAmount,
        uint256 cgpFeesAmount
    ) {
        uint256 yield = IMockPendleOracle(oracle).getYield(ptToken);  // ex: 50 equals 50%
        uint256 duration = IMockPendleOracle(oracle).getDuration(ptToken);  // in seconds
        
        // Utiliser une plus grande précision pour les calculs intermédiaires
        uint256 PRECISION = 1e6;
        
        // 1. Calculate the pro-rated yield with higher precision
        uint256 daysInYear = 365;
        uint256 durationInDays = duration / (24 * 60 * 60);
        
        // Calculer le yield proraté avec une meilleure précision
        uint256 proRatedYield = (yield * durationInDays * PRECISION) / (daysInYear * 100);  // Diviser par 100 pour le pourcentage
        
        // 2. Calculate yield amount
        yieldAmount = (amount * proRatedYield) / PRECISION;
        
        // 3. Calculate fees from yield amount (maximum 1% chacun du yield)
        protocolFeesAmount = (yieldAmount * protocolFeePoints) / 10000;  // Diviser par 10000 car les points sont en 0.01%
        cgpFeesAmount = (yieldAmount * cgpFeePoints) / 10000;  // Diviser par 10000 car les points sont en 0.01%
        
        return (yieldAmount, protocolFeesAmount, cgpFeesAmount);
    }

    // ::::::::::::: EXIT STRATEGY ::::::::::::: // 

    /// @notice Allows a user to exit a matured strategy position
    /// @param allPositionsId Global ID of the position to exit
    /// @dev Follows checks-effects-interactions pattern and includes reentrancy protection
    function exitStrategy(uint256 allPositionsId) external nonReentrant onlyClient {
        // Check position validity and ownership
        Position storage position = allPositions[allPositionsId];
        require(position.owner == msg.sender, "Not position owner");
        require(position.isActive, "Position not active");
        require(block.timestamp >= position.maturityDate, "Strategy not yet mature");

        // Get token addresses
        address underlyingToken = IMockPendleRouter(router).gUSDC();
        address ptToken = IMockPendleRouter(router).PTgUSDC();

        // Get CGP address for fee distribution
        address clientCGP = IRoleControl(roleControl).getClientCGP(msg.sender);
        require(clientCGP != address(0), "Client has no CGP");

        // Find position index in user's positions
        uint256 userPositionId;
        bool positionFound = false;
        for (uint256 i = 0; i < userPositions[msg.sender].length; i++) {
            if (userPositions[msg.sender][i].allPositionsId == allPositionsId) {
                userPositionId = i;
                positionFound = true;
                break;
            }
        }
        require(positionFound, "Position not found in user's positions");

        // Get yield data
        PositionYield storage positionYield = yields[msg.sender][userPositionId];

        // Record initial balance for calculating received amount
        uint256 balanceBefore = IERC20(underlyingToken).balanceOf(address(this));

        // Update state before external interactions
        position.isActive = false;
        position.exitDate = block.timestamp;
        userPositions[msg.sender][userPositionId].isActive = false;
        userPositions[msg.sender][userPositionId].exitDate = block.timestamp;
        userPositionCount[msg.sender]--;
        allActivePositionsCount--;

        // Update fees state
        protocolFees.maturedNonWithdrawnFees += positionYield.protocolYield;
        protocolFees.nonMaturedFees -= positionYield.protocolYield;
        
        cgpFees[clientCGP].maturedNonWithdrawnFees += positionYield.cgpYield;
        cgpFees[clientCGP].nonMaturedFees -= positionYield.cgpYield;

        // Reset approval before setting new amount
        IERC20(ptToken).approve(router, 0);
        IERC20(ptToken).approve(router, position.ptAmount);

        // External interactions (last step)
        IMockPendleRouter(router).redeemPyToToken(ptToken, position.ptAmount);

        // Calculate received amount
        uint256 balanceAfter = IERC20(underlyingToken).balanceOf(address(this));
        uint256 amountReceived = balanceAfter - balanceBefore;

        // Calculate client amount (total - fees)
        uint256 clientAmount = amountReceived - positionYield.protocolYield - positionYield.cgpYield;

        // Transfer client amount
        IERC20(underlyingToken).transfer(msg.sender, clientAmount);

        // Burn the NFT (allPositionsId + 1 = NFTid)
        uint256 NFTid = allPositionsId + 1;
        IStrategyNFT(nftContract).burn(NFTid);

        emit StrategyExited(
            msg.sender,
            NFTid,
            position.gUSDCAmount,
            position.ptAmount,
            positionYield.totalYield,
            block.timestamp
        );

        emit FeesCollected(
            clientCGP,
            positionYield.cgpYield,
            positionYield.protocolYield,
            positionYield.totalYield,
            block.timestamp
        );
    }

    // ::::::::::::: FEES WITHDRAW AND MANAGEMENT ::::::::::::: // 

    /// @notice Withdraws accumulated protocol fees
    /// @dev Only admin can call this function and only matured fees can be withdrawn
    /// @return withdrawableFees Amount of fees withdrawn
    function withdrawProtocolFees() external onlyAdmin returns (uint256 withdrawableFees) {
        withdrawableFees = protocolFees.maturedNonWithdrawnFees;
        require(withdrawableFees > 0, "No fees to withdraw");

        // Update fee state before transfer
        protocolFees.maturedNonWithdrawnFees = 0;
        protocolFees.withdrawnFees += withdrawableFees;

        // Get gUSDC token and transfer fees
        address gUSDCToken = IMockPendleRouter(router).gUSDC();
        IERC20(gUSDCToken).transfer(msg.sender, withdrawableFees);

        emit ProtocolFeesWithdrawn(
            msg.sender,
            withdrawableFees,
            block.timestamp
        );
    }

    /// @notice Withdraws accumulated CGP fees
    /// @dev Only CGP can call this function and only matured fees can be withdrawn
    /// @return withdrawableFees Amount of fees withdrawn
    function withdrawCGPFees() external onlyCGP returns (uint256 withdrawableFees) {
        withdrawableFees = cgpFees[msg.sender].maturedNonWithdrawnFees;
        require(withdrawableFees > 0, "No fees to withdraw");

        // Update fee state before transfer
        cgpFees[msg.sender].maturedNonWithdrawnFees = 0;
        cgpFees[msg.sender].withdrawnFees += withdrawableFees;

        // Get gUSDC token and transfer fees
        address gUSDCToken = IMockPendleRouter(router).gUSDC();
        IERC20(gUSDCToken).transfer(msg.sender, withdrawableFees);

        emit CGPFeesWithdrawn(
            msg.sender,
            withdrawableFees,
            block.timestamp
        );
    }

    /// @notice Updates the fee points for both protocol and CGP fees
    /// @dev Only admin can update fee points and they cannot exceed 1% (100 points)
    /// @param newProtocolFeePoints New protocol fee points (1 point = 0.01%)
    /// @param newCGPFeePoints New CGP fee points (1 point = 0.01%)
    /// @custom:security Follows checks-effects-interactions pattern
    /// @custom:validation Fee points cannot exceed 100 (1%)
    function updateFeePoints(
        uint256 newProtocolFeePoints,
        uint256 newCGPFeePoints
    ) external onlyAdmin {
        // Store old values for event
        uint256 oldProtocolFeePoints = protocolFeePoints;
        uint256 oldCGPFeePoints = cgpFeePoints;

        // Validate and update new fee points
        require(newProtocolFeePoints <= 100, "Protocol fee too high"); // Max 1%
        require(newCGPFeePoints <= 100, "CGP fee too high"); // Max 1%
        
        protocolFeePoints = newProtocolFeePoints;
        cgpFeePoints = newCGPFeePoints;

        emit FeePointsUpdated(
            oldProtocolFeePoints,
            newProtocolFeePoints,
            oldCGPFeePoints,
            newCGPFeePoints,
            block.timestamp
        );
    }

    // ::::::::::::: NFT MARKET ::::::::::::: // 

    /// @notice Liste un NFT à vendre
    /// @param _positionId L'ID de la position à vendre
    /// @param _price Le prix de vente en gUSDC
    function listNFTForSale(uint256 _positionId, uint256 _price) external nonReentrant {
        uint256 NFTid = _positionId + 1;
        require(IStrategyNFT(nftContract).ownerOf(NFTid) == msg.sender, "Not the owner");
        require(_price > 0, "Price must be > 0");
        require(allPositions[_positionId].isActive, "Position not active");
        require(!nftSales[_positionId].isOnSale, "Already on sale");

        // Approuver le contrat pour le transfert du NFT
        IStrategyNFT(nftContract).approve(address(this), NFTid);

        // Mettre le NFT en vente
        nftSales[_positionId] = NFTSale({
            salePrice: _price,
            isOnSale: true
        });

        emit NFTListedForSale(NFTid, _positionId, _price, msg.sender);
    }

    /// @notice Cancels the sale of an NFT
    /// @param allPositionsId Global ID of the position
    /// @dev Protected against reentrancy
    function cancelNFTSale(uint256 allPositionsId) external nonReentrant {
        Position storage position = allPositions[allPositionsId];
        require(position.owner == msg.sender, "Not position owner");
        require(position.isActive, "Position not active");

        uint256 NFTid = allPositionsId + 1;
        require(IStrategyNFT(nftContract).ownerOf(NFTid) == msg.sender, "Not NFT owner");

        delete nftSales[allPositionsId];
        emit NFTSaleCanceled(NFTid, allPositionsId, msg.sender);
    }

    /// @notice Buys an NFT that is listed for sale
    /// @param allPositionsId Global ID of the position associated with the NFT
    /// @dev Follows checks-effects-interactions pattern and includes reentrancy protection
    function buyNFT(uint256 allPositionsId) external nonReentrant {
        // Check if NFT is listed for sale
        NFTSale memory sale = nftSales[allPositionsId];
        require(sale.isOnSale, "NFT not for sale");

        // Check if position is still active
        Position storage position = allPositions[allPositionsId];
        require(position.isActive, "Position not active");

        // Get NFT details and verify ownership
        uint256 NFTid = allPositionsId + 1;
        address nftOwner = IStrategyNFT(nftContract).ownerOf(NFTid);
        require(nftOwner != msg.sender, "Cannot buy your own NFT");

        // Get gUSDC token contract
        IERC20 gUSDC = IERC20(IMockPendleRouter(router).gUSDC());

        // Check token approvals
        require(gUSDC.allowance(msg.sender, address(this)) >= sale.salePrice, "Insufficient gUSDC allowance");
        require(IStrategyNFT(nftContract).getApproved(NFTid) == address(this), "NFT not approved for transfer");

        // Update state first (checks-effects pattern)
        bool positionFound = false;
        Position[] storage oldOwnerPositions = userPositions[nftOwner];
        for (uint i = 0; i < oldOwnerPositions.length; i++) {
            if (oldOwnerPositions[i].allPositionsId == allPositionsId) {
                // Replace with last element and reduce array length
                oldOwnerPositions[i] = oldOwnerPositions[oldOwnerPositions.length - 1];
                oldOwnerPositions.pop();
                positionFound = true;
                break;
            }
        }
        require(positionFound, "Position not found in seller's positions");

        // Update position ownership
        position.owner = msg.sender;
        userPositions[msg.sender].push(position);

        // Remove sale listing
        delete nftSales[allPositionsId];

        // Perform external interactions last (interactions pattern)
        require(gUSDC.transferFrom(msg.sender, nftOwner, sale.salePrice), "gUSDC transfer failed");
        IStrategyNFT(nftContract).transferFrom(nftOwner, msg.sender, NFTid);

        emit NFTSold(NFTid, allPositionsId, nftOwner, msg.sender, sale.salePrice);
    }

    // ::::::::::::: GETTERS ::::::::::::: //

    /// @notice Returns strategy details
    /// @return underlyingToken Address of the underlying token
    /// @return currentYield Current yield rate
    /// @return duration Strategy duration
    /// @return rate PT rate
    function getStrategyDetails() external view returns (
        address underlyingToken,
        uint256 currentYield,
        uint256 duration,
        uint256 rate
    ) {
        address ptToken = IMockPendleRouter(router).PTgUSDC();
        return (
            IMockPendleRouter(router).gUSDC(),
            IMockPendleOracle(oracle).getYield(ptToken),
            IMockPendleOracle(oracle).getDuration(ptToken),
            IMockPendleOracle(oracle).getPTRate(ptToken)
        );
    }

    /// @notice Returns protocol statistics
    /// @return totalActivePositions Total number of active positions
    /// @return totalPositionsOnSale Total number of positions on sale
    /// @return protocolPendingFees Pending fees for the protocol
    /// @return protocolWithdrawnFees Fees already withdrawn by the protocol
    function getProtocolStats() external view returns (
        uint256 totalActivePositions,
        uint256 totalPositionsOnSale,
        uint256 protocolPendingFees,
        uint256 protocolWithdrawnFees
    ) {
        totalActivePositions = allActivePositionsCount;
        
        // Count positions on sale (limited by active positions)
        uint256 onSaleCount = 0;
        for (uint256 i = 0; i < allActivePositionsCount; i++) {
            if (nftSales[i].isOnSale) {
                onSaleCount++;
            }
        }
        totalPositionsOnSale = onSaleCount;

        protocolPendingFees = protocolFees.nonMaturedFees + protocolFees.maturedNonWithdrawnFees;
        protocolWithdrawnFees = protocolFees.withdrawnFees;

        return (
            totalActivePositions,
            totalPositionsOnSale,
            protocolPendingFees,
            protocolWithdrawnFees
        );
    }

    /// @notice Returns the total number of active positions
    /// @return The number of active positions
    function getAllActivePositionsCount() external view returns (uint256) {
        return allActivePositionsCount;
    }

    // Function to view all positions of a user
    function getUserPositions(address user) external view returns (Position[] memory) {
        return userPositions[user];
    }

    // Function to view a specific position
    function getUserPosition(address user, uint256 positionId) external view returns (Position memory) {
        require(positionId < userPositions[user].length, "Invalid position ID");
        return userPositions[user][positionId];
    }

    // Getters for fees
    function getCGPFees(address cgp) external view returns (Fees memory) {
        return cgpFees[cgp];
    }

    function getProtocolFees() external view returns (Fees memory) {
        return protocolFees;
    }
} 

