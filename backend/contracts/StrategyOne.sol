// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ::::::::::::: INTERFACES ::::::::::::: // 

interface IRoleControl {
    function getClientCGP(address client) external view returns (address);
    function isAdmin(address account) external view returns (bool);
    function isCGP(address account) external view returns (bool);
    function isClient(address account) external view returns (bool);
    function getRoles(address account) external view returns (string memory);
    function addAdmin(address newAdmin) external;
    function addCGP(address newCGP) external;
    function addClient(address newClient) external;
}

interface IMockPendleRouter {
    function swapExactTokenForPt(address tokenAddress, uint256 amount) external returns (uint256 ptReceived);
    function redeemPyToToken(address tokenAddress, uint256 maturityDate) external;
    function getActiveStrategy(address user, uint256 maturityDate) external view returns (uint256, uint256, uint256, uint256);
    function gUSDC() external view returns (address);
    function PTgUSDC() external view returns (address);
}

interface IMockPendleOracle {
    function getPTRate(address token) external view returns (uint256);
    function getYield(address token) external view returns (uint256);
    function getDuration(address token) external view returns (uint256);
}

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
}

// ::::::::::::: STRATEGY ONE SMART CONTRACT ::::::::::::: // 

contract StrategyOne {
    using SafeERC20 for IERC20;

    // Adresses des contrats Mock Pendle
    address public immutable router;
    address public immutable oracle;
    address public immutable roleControl;
    address public immutable nftContract;

    // Variables d'état pour les frais
    uint256 public protocolFeePoints;
    uint256 public cgpFeePoints;       

    // ::::::::::::: STRUCTS ::::::::::::: // 

    // Structure pour stocker les positions des utilisateurs
    struct Position {
        uint256 gUSDCAmount;    // Montant initial en gUSDC
        uint256 ptAmount;       // Montant de PT reçus
        uint256 entryDate;      // Date d'entrée
        uint256 maturityDate;   // Date de maturité
        uint256 exitDate;       // Date de sortie
        bool isActive;          // Position active
    }

    struct PositionYield {
        uint256 totalYield;     // Yield total
        uint256 protocolYield;  // Yield protocole
        uint256 cgpYield;       // Yield CGP
        uint256 clientYield;    // Yield client
    }

    struct PositionMarket {
        bool isOnSale;          // En vente
        uint256 salePrice;      // Prix de vente
    }

    // Struct pour stocker les frais en fonction de leur statut
    struct Fees {
        uint256 nonMaturedFees;           // Frais des stratégies non arrivées à maturité
        uint256 maturedNonWithdrawnFees;  // Frais des stratégies matures mais non retirés
        uint256 withdrawnFees;            // Total des frais retirés
    }

    // Struct pour le marché NFT
    struct NFTSale {
        uint256 salePrice;
        bool isOnSale;
    }

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    // Mappings pour suivre les positions des utilisateurs
    mapping(address => Position[]) public positions;
    mapping(address => PositionYield[]) public yields;
    mapping(address => PositionMarket[]) public markets;
    mapping(address => uint256) public positionCount;

    // Mapping pour stocker les frais du protocole et des CGP
    Fees public protocolFees;
    mapping(address => Fees) public cgpFees;

    // Mapping pour stocker les infos de vente des NFTs
    mapping(uint256 => NFTSale) public nftSales;
    
    // ::::::::::::: EVENTS ::::::::::::: // 

    // Event pour la mise en vente
    event StrategyEntered(address indexed user, uint256 positionId, uint256 amount, uint256 ptReceived, uint256 entryDate, uint256 maturityDate);
    event StrategyExited(address indexed user, uint256 positionId, uint256 initialAmount, uint256 finalAmount, uint256 yieldEarned, uint256 exitDate);
    event FeesCollected(
        address indexed cgp,
        uint256 cgpAmount,
        uint256 protocolAmount,
        uint256 totalAmount,
        uint256 timestamp
    );

    event PendingFeesUpdated(
        address indexed cgp,
        uint256 cgpPendingFees,
        uint256 protocolPendingFees
    );

    event ProtocolFeesWithdrawn(
        address indexed admin,
        uint256 amount,
        uint256 timestamp
    );

    event CGPFeesWithdrawn(
        address indexed cgp,
        uint256 amount,
        uint256 timestamp
    );

    event FeePointsUpdated(
        uint256 oldProtocolFeePoints,
        uint256 newProtocolFeePoints,
        uint256 oldCGPFeePoints,
        uint256 newCGPFeePoints,
        uint256 timestamp
    );

    event NFTListedForSale(uint256 indexed positionId, uint256 price, address seller);
    event NFTSold(uint256 indexed positionId, address seller, address buyer, uint256 price);


    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    constructor(
        address _router,
        address _oracle,
        address _roleControl,
        address _nftContract
    ) {
        router = _router;
        oracle = _oracle;
        roleControl = _roleControl;
        nftContract = _nftContract;
        protocolFeePoints = 1;
        cgpFeePoints = 1;
    }

    // ::::::::::::: MODIFIERS ::::::::::::: // 

    modifier onlyAdmin() {
        require(IRoleControl(roleControl).isAdmin(msg.sender), "Caller is not an admin");
        _;
    }

    modifier onlyCGP() {
        require(IRoleControl(roleControl).isCGP(msg.sender), "Caller is not a CGP");
        _;
    }

    modifier onlyClient() {
        require(IRoleControl(roleControl).isClient(msg.sender), "Caller is not a client");
        _;
    }

    // ::::::::::::: SMART CONTRACT FUNCTIONS ::::::::::::: // 

    // Fonction pour obtenir les détails de la stratégie actuelle
    function getStrategyDetails() external view returns (
        address underlyingToken,
        uint256 currentYield,
        uint256 duration,
        uint256 rate
    ) {
        IMockPendleOracle pendleOracle = IMockPendleOracle(oracle);
        underlyingToken = IMockPendleRouter(router).gUSDC();
        address ptToken = IMockPendleRouter(router).PTgUSDC();
        currentYield = pendleOracle.getYield(ptToken);
        duration = pendleOracle.getDuration(ptToken);
        rate = pendleOracle.getPTRate(ptToken);
        return (underlyingToken, currentYield, duration, rate);
    }

    // ::::::::::::: NEW STRATEGY ::::::::::::: // 

    function enterStrategy(uint256 amount) external onlyClient {
        require(amount > 0, "Amount must be greater than 0");
        
        // Récupérer le CGP du client via l'interface
        address clientCGP = IRoleControl(roleControl).getClientCGP(msg.sender);
        require(clientCGP != address(0), "Client has no CGP");

        // Créer la position et émettre l'événement dans une fonction séparée
        _createPosition(amount, clientCGP);
    }

    // Fonction interne pour créer la position
    function _createPosition(uint256 amount, address clientCGP) internal {
        address underlyingToken = IMockPendleRouter(router).gUSDC();
        address ptToken = IMockPendleRouter(router).PTgUSDC();

        // Transfert des tokens
        IERC20(underlyingToken).transferFrom(msg.sender, address(this), amount);
        IERC20(underlyingToken).approve(router, amount);

        // Swap via Pendle Router
        uint256 ptReceived = IMockPendleRouter(router).swapExactTokenForPt(underlyingToken, amount);

        // ::: GESTION DES FRAIS ::::: // 

        (uint256 yieldAmount, uint256 protocolFeesAmount, uint256 cgpFeesAmount) = _calculateFees(amount, ptToken);

        // Mettre à jour les frais en attente
        protocolFees.nonMaturedFees += protocolFeesAmount;
        cgpFees[clientCGP].nonMaturedFees += cgpFeesAmount;

        emit PendingFeesUpdated(clientCGP, cgpFees[clientCGP].nonMaturedFees, protocolFees.nonMaturedFees);

        // ::: CREATION DE LA POSITION ::: // 

        uint256 maturityDate = block.timestamp + IMockPendleOracle(oracle).getDuration(ptToken);

        Position memory newPosition = Position({
            gUSDCAmount: amount,
            ptAmount: ptReceived,
            entryDate: block.timestamp,
            maturityDate: maturityDate,
            exitDate: 0,
            isActive: true
        });

        // Ajouter la position
        positions[msg.sender].push(newPosition);
        uint256 positionId = positions[msg.sender].length - 1;
        positionCount[msg.sender]++;

        // Ajouter les données de yield
        yields[msg.sender].push(PositionYield({
            totalYield: yieldAmount,
            protocolYield: protocolFeesAmount,
            cgpYield: cgpFeesAmount,
            clientYield: yieldAmount - protocolFeesAmount - cgpFeesAmount
        }));

        // Ajouter les données de market
        markets[msg.sender].push(PositionMarket({
            isOnSale: false,
            salePrice: 0
        }));

        // ::: NFT MINT ::: // 

        // Mint du NFT avec les détails initiaux de la stratégie
        IStrategyNFT(nftContract).mintStrategyNFT(
            msg.sender,                    // owner du NFT
            amount,                        // montant initial
            IMockPendleOracle(oracle).getDuration(ptToken),  // durée
            positions[msg.sender].length - 1  // ID de la stratégie
        );

        emit StrategyEntered(msg.sender, positionId, amount, ptReceived, block.timestamp, maturityDate);
    }

    // Fonction interne pour calculer les frais
    function _calculateFees(uint256 amount, address ptToken) internal view returns (
        uint256 yieldAmount,
        uint256 protocolFeesAmount,
        uint256 cgpFeesAmount
    ) {
        uint256 yield = IMockPendleOracle(oracle).getYield(ptToken);  // ex: 10 pour 10%
        uint256 duration = IMockPendleOracle(oracle).getDuration(ptToken);  // en secondes
        
        // Pour éviter l'overflow, on fait les calculs en plusieurs étapes
        // 1. Calculer le yield annuel en points de base (1 point = 0.01%)
        uint256 annualYieldBps = yield * 100;  // 10% -> 1000 bps
        
        // 2. Calculer le yield proratisé sur la durée
        uint256 daysInYear = 365;
        uint256 durationInDays = duration / (24 * 60 * 60);
        uint256 proRatedYieldBps = (annualYieldBps * durationInDays) / daysInYear;
        
        // 3. Calculer les montants
        yieldAmount = (amount * proRatedYieldBps) / 10000;  // Divisé par 10000 car en bps
        
        // Le protocole et le CGP prennent leurs points respectifs du yield total
        protocolFeesAmount = (amount * protocolFeePoints * 100 * durationInDays) / (daysInYear * 10000);
        cgpFeesAmount = (amount * cgpFeePoints * 100 * durationInDays) / (daysInYear * 10000);
        
        return (yieldAmount, protocolFeesAmount, cgpFeesAmount);
    }

    // ::::::::::::: EXIT STRATEGY ::::::::::::: // 

    function exitStrategy(uint256 positionId) external onlyClient {
        require(positionId < positions[msg.sender].length, "Invalid position ID");
        Position storage position = positions[msg.sender][positionId];
        require(position.isActive, "Position not active");
        require(block.timestamp >= position.maturityDate, "Strategy not yet mature");

        address underlyingToken = IMockPendleRouter(router).gUSDC();
        address ptToken = IMockPendleRouter(router).PTgUSDC();

        // Récupérer la balance avant le redeem
        uint256 balanceBefore = IERC20(underlyingToken).balanceOf(address(this));

        // Approuver le Router pour les PT
        IERC20(ptToken).approve(router, position.ptAmount);

        // Redeem via Pendle Router
        IMockPendleRouter(router).redeemPyToToken(underlyingToken, position.maturityDate);

        // Calculer le montant exact reçu du Router
        uint256 balanceAfter = IERC20(underlyingToken).balanceOf(address(this));
        uint256 amountReceived = balanceAfter - balanceBefore;

        // Récupérer le CGP du client et les frais calculés à l'entrée
        address clientCGP = IRoleControl(roleControl).getClientCGP(msg.sender);
        PositionYield storage positionYield = yields[msg.sender][positionId];
        
        // Mettre à jour les frais
        protocolFees.maturedNonWithdrawnFees += positionYield.protocolYield;
        protocolFees.nonMaturedFees -= positionYield.protocolYield;
        
        cgpFees[clientCGP].maturedNonWithdrawnFees += positionYield.cgpYield;
        cgpFees[clientCGP].nonMaturedFees -= positionYield.cgpYield;

        // Calculer le montant à envoyer au client (total - frais)
        uint256 clientAmount = amountReceived - positionYield.protocolYield - positionYield.cgpYield;

        // Transfert uniquement du montant client
        IERC20(underlyingToken).transfer(msg.sender, clientAmount);

        // Mise à jour de la position
        position.isActive = false;
        position.exitDate = block.timestamp;
        positionCount[msg.sender]--;

        // Burn du NFT avec l'ID correct (positionId + 1)
        IStrategyNFT(nftContract).burn(positionId + 1);

        emit StrategyExited(
            msg.sender, 
            positionId, 
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

    // ::::::::::::: GETTERS POSITIONS ::::::::::::: // 

    // Fonction pour voir toutes les positions d'un utilisateur
    function getUserPositions(address user) external view returns (Position[] memory) {
        return positions[user];
    }

    // Fonction pour voir une position spécifique
    function getUserPosition(address user, uint256 positionId) external view returns (Position memory) {
        require(positionId < positions[user].length, "Invalid position ID");
        return positions[user][positionId];
    }

    // Getters pour les frais
    function getCGPFees(address cgp) external view returns (Fees memory) {
        return cgpFees[cgp];
    }

    function getProtocolFees() external view returns (Fees memory) {
        return protocolFees;
    }

    // ::::::::::::: FEES WITHDRAW AND MANAGEMENT ::::::::::::: // 

    // Nouvelle fonction pour retirer les frais du protocole
    function withdrawProtocolFees() external onlyAdmin {
        uint256 withdrawAmount = protocolFees.maturedNonWithdrawnFees;
        require(withdrawAmount > 0, "No fees to withdraw");

        address underlyingToken = IMockPendleRouter(router).gUSDC();
        
        // Mise à jour des frais avant le transfert
        protocolFees.maturedNonWithdrawnFees = 0;
        protocolFees.withdrawnFees += withdrawAmount;
        
        // Transfert des frais à l'admin
        IERC20(underlyingToken).transfer(msg.sender, withdrawAmount);

        emit ProtocolFeesWithdrawn(msg.sender, withdrawAmount, block.timestamp);
    }

    // Nouvelle fonction pour retirer les frais d'un CGP
    function withdrawCGPFees() external onlyCGP {
        uint256 withdrawAmount = cgpFees[msg.sender].maturedNonWithdrawnFees;
        require(withdrawAmount > 0, "No fees to withdraw");

        address underlyingToken = IMockPendleRouter(router).gUSDC();
        
        // Mise à jour des frais avant le transfert
        cgpFees[msg.sender].maturedNonWithdrawnFees = 0;
        cgpFees[msg.sender].withdrawnFees += withdrawAmount;
        
        // Transfert des frais au CGP
        IERC20(underlyingToken).transfer(msg.sender, withdrawAmount);

        emit CGPFeesWithdrawn(msg.sender, withdrawAmount, block.timestamp);
    }

    // Nouvelle fonction pour mettre à jour les points de frais
    function updateFeePoints(uint256 newProtocolFeePoints, uint256 newCGPFeePoints) external onlyAdmin {
        require(newProtocolFeePoints <= 100, "Protocol fee points cannot exceed 100");
        require(newCGPFeePoints <= 100, "CGP fee points cannot exceed 100");
        
        uint256 oldProtocolFeePoints = protocolFeePoints;
        uint256 oldCGPFeePoints = cgpFeePoints;
        
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

    // Fonction pour mettre en vente un NFT
    function listNFTForSale(uint256 positionId, uint256 price) external {
        require(price > 0, "Price must be greater than 0");
        require(positionId < positions[msg.sender].length, "Invalid position ID");
        Position storage position = positions[msg.sender][positionId];
        require(position.isActive, "Position not active");

        // Vérifier que l'utilisateur possède bien le NFT
        require(IStrategyNFT(nftContract).ownerOf(positionId) == msg.sender, "Not NFT owner");

        nftSales[positionId] = NFTSale({
            salePrice: price,
            isOnSale: true
        });

        emit NFTListedForSale(positionId, price, msg.sender);
    }

    // Fonction pour acheter un NFT
    function buyNFT(uint256 positionId) external {
        NFTSale storage sale = nftSales[positionId];
        require(sale.isOnSale, "NFT not for sale");
        
        address seller = IStrategyNFT(nftContract).ownerOf(positionId);
        require(seller != msg.sender, "Cannot buy your own NFT");

        // Transfert du paiement
        IERC20(IMockPendleRouter(router).gUSDC()).transferFrom(
            msg.sender,
            seller,
            sale.salePrice
        );

        // Transfert du NFT
        IStrategyNFT(nftContract).transferFrom(seller, msg.sender, positionId);

        // Mise à jour des données
        sale.isOnSale = false;
        positions[msg.sender].push(positions[seller][positionId]);
        delete positions[seller][positionId];

        emit NFTSold(positionId, seller, msg.sender, sale.salePrice);
    }

    // Fonction pour annuler la vente
    function cancelNFTSale(uint256 positionId) external {
        require(IStrategyNFT(nftContract).ownerOf(positionId) == msg.sender, "Not NFT owner");
        require(nftSales[positionId].isOnSale, "NFT not for sale");

        nftSales[positionId].isOnSale = false;
        emit NFTListedForSale(positionId, 0, msg.sender);
    }
} 