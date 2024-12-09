// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ::::::::::::: INTERFACES ::::::::::::: // 

/// @title IRoleControl
/// @notice Interface pour la gestion des rôles
interface IRoleControl {
    function getClientCGP(address client) external view returns (address);
    function isAdmin(address account) external view returns (bool);
    function isCGP(address account) external view returns (bool);
    function isClient(address account) external view returns (bool);
}

/// @title IMockPendleRouter
/// @notice Interface simplifiée pour le router
interface IMockPendleRouter {
    function gUSDC() external view returns (address);
    function PTgUSDC() external view returns (address);
    function swapExactTokenForPt(address tokenIn, uint256 amountIn) external returns (uint256);
    function redeemPyToToken(address ptToken, uint256 amountIn) external returns (uint256);
}

/// @title IMockPendleOracle
/// @notice Interface pour l'oracle Pendle
interface IMockPendleOracle {
    function getDuration(address ptToken) external view returns (uint256);
    function getYield(address ptToken) external view returns (uint256);
}

/// @title IStrategyNFT
/// @notice Interface pour le contrat de NFTs
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

/// @title StrategyOne
/// @notice Contrat principal pour la gestion des stratégies d'investissement
/// @dev Implémente la logique de gestion des positions, NFTs et frais
contract StrategyOne is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ::::::::::::: STATE VARIABLES ::::::::::::: //

    /// @notice Adresse du router pour les opérations de swap
    address public immutable router;
    /// @notice Adresse de l'oracle pour les prix
    address public immutable oracle;
    /// @notice Adresse du contrat de gestion des rôles
    address public immutable roleControl;
    /// @notice Adresse du contrat NFT
    address public immutable nftContract;
    /// @notice Points de frais pour le protocole (1 point = 0.01%)
    uint256 public protocolFeePoints;
    /// @notice Points de frais pour le CGP (1 point = 0.01%)
    uint256 public cgpFeePoints;       
    /// @notice Nombre total de positions actives
    uint256 private allActivePositionsCount;

    // ::::::::::::: STRUCTS ::::::::::::: //

    /// @notice Structure représentant une position d'investissement
    /// @param gUSDCAmount Montant initial en gUSDC
    /// @param ptAmount Montant de PT reçus
    /// @param entryDate Date d'entrée dans la position
    /// @param maturityDate Date de maturité de la position
    /// @param exitDate Date de sortie de la position
    /// @param isActive Indique si la position est active
    /// @param allPositionsId ID global unique de la position
    /// @param owner Adresse du propriétaire de la position
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

    /// @notice Structure pour le calcul des rendements
    /// @param totalYield Rendement total de la position
    /// @param protocolYield Part du rendement pour le protocole
    /// @param cgpYield Part du rendement pour le CGP
    /// @param clientYield Part du rendement pour le client
    struct PositionYield {
        uint256 totalYield;
        uint256 protocolYield;
        uint256 cgpYield;
        uint256 clientYield;
    }

    /// @notice Structure pour la gestion des frais
    /// @param nonMaturedFees Frais des positions non arrivées à maturité
    /// @param maturedNonWithdrawnFees Frais des positions matures non retirés
    /// @param withdrawnFees Total des frais déjà retirés
    struct Fees {
        uint256 nonMaturedFees;
        uint256 maturedNonWithdrawnFees;
        uint256 withdrawnFees;
    }

    /// @notice Structure pour la gestion des ventes de NFT
    /// @param salePrice Prix de vente en gUSDC
    /// @param isOnSale Indique si le NFT est en vente
    struct NFTSale {
        uint256 salePrice;
        bool isOnSale;
    }

    // ::::::::::::: MAPPINGS ::::::::::::: //

    /// @notice Positions de chaque utilisateur
    mapping(address => Position[]) public userPositions;
    /// @notice Rendements de chaque position par utilisateur
    mapping(address => PositionYield[]) public yields;
    /// @notice Nombre de positions actives par utilisateur
    mapping(address => uint256) public userPositionCount;
    /// @notice Mapping global des positions par ID
    mapping(uint256 => Position) public allPositions;
    /// @notice Informations de vente pour chaque NFT, indexé par allPositionsId
    /// @dev La clé est allPositionsId (et non pas NFTid qui serait allPositionsId + 1)
    mapping(uint256 => NFTSale) public nftSales;
    /// @notice Frais du protocole
    Fees public protocolFees;
    /// @notice Frais par CGP
    mapping(address => Fees) public cgpFees;

    // ::::::::::::: EVENTS ::::::::::::: //

    // :::: STRATEGY EVENTS :::: //

    /// @notice Émis lorsqu'une nouvelle position est créée
    /// @param user Adresse de l'utilisateur
    /// @param NFTid ID du NFT
    /// @param amount Montant investi en gUSDC
    /// @param ptReceived Montant de PT reçus
    /// @param entryDate Date d'entrée
    /// @param maturityDate Date de maturité
    event StrategyEntered(
        address indexed user,
        uint256 indexed NFTid,
        uint256 amount,
        uint256 ptReceived,
        uint256 entryDate,
        uint256 maturityDate
    );

    /// @notice Émis lorsqu'une position est fermée
    /// @param user Adresse de l'utilisateur
    /// @param NFTid ID du NFT
    /// @param initialAmount Montant initial investi
    /// @param finalAmount Montant final reçu
    /// @param yieldEarned Rendement gagné
    /// @param exitDate Date de sortie
    event StrategyExited(
        address indexed user,
        uint256 indexed NFTid,
        uint256 initialAmount,
        uint256 finalAmount,
        uint256 yieldEarned,
        uint256 exitDate
    );

    // :::: NFT EVENTS :::: //

    /// @notice Émis lorsqu'un NFT est mis en vente
    event NFTListedForSale(
        uint256 indexed NFTid,
        uint256 allPositionsId,
        uint256 price,
        address seller
    );

    /// @notice Émis lorsqu'un NFT est vendu
    event NFTSold(
        uint256 indexed NFTid,
        uint256 allPositionsId,
        address seller,
        address buyer,
        uint256 price
    );

    /// @notice Émis lorsqu'une vente est annulée
    event NFTSaleCanceled(
        uint256 indexed NFTid,
        uint256 allPositionsId,
        address seller
    );

    /// @notice Émis lorsque des frais sont collectés
    event FeesCollected(
        address indexed cgp,
        uint256 cgpAmount,
        uint256 protocolAmount,
        uint256 totalAmount,
        uint256 timestamp
    );

    // :::: FEES EVENTS :::: //

    /// @notice Émis lorsque les frais en attente sont mis à jour
    event PendingFeesUpdated(
        address indexed cgp,
        uint256 cgpPendingFees,
        uint256 protocolPendingFees
    );

    /// @notice Émis lorsque les frais du protocole sont retirés
    event ProtocolFeesWithdrawn(
        address indexed admin,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Émis lorsque les frais d'un CGP sont retirés
    event CGPFeesWithdrawn(
        address indexed cgp,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Émis lorsque les points de frais sont mis à jour
    event FeePointsUpdated(
        uint256 oldProtocolFeePoints,
        uint256 newProtocolFeePoints,
        uint256 oldCGPFeePoints,
        uint256 newCGPFeePoints,
        uint256 timestamp
    );

    // ::::::::::::: MODIFIERS ::::::::::::: //

    /// @notice Restreint l'accès aux administrateurs
    modifier onlyAdmin() {
        require(IRoleControl(roleControl).isAdmin(msg.sender), "Caller is not an admin");
        _;
    }

    /// @notice Restreint l'accès aux CGPs
    modifier onlyCGP() {
        require(IRoleControl(roleControl).isCGP(msg.sender), "Caller is not a CGP");
        _;
    }

    /// @notice Restreint l'accès aux clients
    modifier onlyClient() {
        require(IRoleControl(roleControl).isClient(msg.sender), "Caller is not a client");
        _;
    }

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initialise le contrat avec les adresses nécessaires
    /// @param _router Adresse du router
    /// @param _oracle Adresse de l'oracle
    /// @param _roleControl Adresse du contrat de gestion des rôles
    /// @param _nftContract Adresse du contrat NFT
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

    /// @notice Crée une nouvelle position d'investissement
    /// @param amount Montant en gUSDC à investir
    /// @dev Protégé contre la réentrance
    function enterStrategy(uint256 amount) external nonReentrant onlyClient {
        require(amount > 0, "Amount must be greater than 0");
        
        address clientCGP = IRoleControl(roleControl).getClientCGP(msg.sender);
        require(clientCGP != address(0), "Client has no CGP");

        _createPosition(amount, clientCGP);
    }

    /// @notice Fonction interne pour créer une position
    /// @param amount Montant en gUSDC à investir
    /// @param clientCGP Adresse du CGP du client
    /// @dev Gère la création de la position et l'émission du NFT
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

        // Ajouter la position aux deux mappings
        userPositions[msg.sender].push(newPosition);
        allPositions[currentAllPositionsId] = newPosition;
        userPositionCount[msg.sender]++;

        // Ajouter les données de yield
        yields[msg.sender].push(PositionYield({
            totalYield: yieldAmount,
            protocolYield: protocolFeesAmount,
            cgpYield: cgpFeesAmount,
            clientYield: yieldAmount - protocolFeesAmount - cgpFeesAmount
        }));

        // Mint du NFT
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

    /// @notice Calcule les frais pour une position
    /// @param amount Montant initial de la position
    /// @return yieldAmount Montant total du yield
    /// @return protocolFeesAmount Frais pour le protocole
    /// @return cgpFeesAmount Frais pour le CGP
    function _calculateFees(uint256 amount, address ptToken) internal view returns (
        uint256 yieldAmount,
        uint256 protocolFeesAmount,
        uint256 cgpFeesAmount
    ) {
        uint256 yield = IMockPendleOracle(oracle).getYield(ptToken);  // ex: 10 pour 10%
        uint256 duration = IMockPendleOracle(oracle).getDuration(ptToken);  // en secondes
        
     
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

    /// @notice Permet de sortir d'une position à maturité
    /// @param allPositionsId ID global de la position
    /// @dev Protégé contre la réentrance
    function exitStrategy(uint256 allPositionsId) external nonReentrant onlyClient {
        Position storage position = allPositions[allPositionsId];
        require(position.owner == msg.sender, "Not position owner");
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
        
        // Trouver l'index de la position dans userPositions
        uint256 userPositionId;
        for (uint256 i = 0; i < userPositions[msg.sender].length; i++) {
            if (userPositions[msg.sender][i].allPositionsId == allPositionsId) {
                userPositionId = i;
                break;
            }
        }
        
        PositionYield storage positionYield = yields[msg.sender][userPositionId];
        
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
        userPositionCount[msg.sender]--;
        allActivePositionsCount--;

        // L'ID du NFT est toujours allPositionsId + 1
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

    /// @notice Met en vente un NFT
    /// @param allPositionsId ID global de la position
    /// @param price Prix de vente en gUSDC
    /// @dev Protégé contre la réentrance
    function listNFTForSale(uint256 allPositionsId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be greater than 0");
        
        Position storage position = allPositions[allPositionsId];
        require(position.owner == msg.sender, "Not position owner");
        require(position.isActive, "Position not active");

        uint256 NFTid = allPositionsId + 1;
        require(IStrategyNFT(nftContract).ownerOf(NFTid) == msg.sender, "Not NFT owner");

        nftSales[allPositionsId] = NFTSale({
            salePrice: price,
            isOnSale: true
        });

        emit NFTListedForSale(NFTid, allPositionsId, price, msg.sender);
    }

    /// @notice Annule la vente d'un NFT
    /// @param allPositionsId ID global de la position
    /// @dev Protégé contre la réentrance
    function cancelNFTSale(uint256 allPositionsId) external nonReentrant {
        Position storage position = allPositions[allPositionsId];
        require(position.owner == msg.sender, "Not position owner");
        require(position.isActive, "Position not active");

        uint256 NFTid = allPositionsId + 1;
        require(IStrategyNFT(nftContract).ownerOf(NFTid) == msg.sender, "Not NFT owner");

        delete nftSales[allPositionsId];
        emit NFTSaleCanceled(NFTid, allPositionsId, msg.sender);
    }

    /// @notice Achète un NFT en vente
    /// @param allPositionsId ID global de la position
    /// @dev Protégé contre la réentrance et suit le pattern checks-effects-interactions
    function buyNFT(uint256 allPositionsId) external nonReentrant {
        NFTSale memory sale = nftSales[allPositionsId];
        require(sale.isOnSale, "NFT not for sale");

        Position storage position = allPositions[allPositionsId];
        require(position.isActive, "Position not active");

        uint256 NFTid = allPositionsId + 1;
        address nftOwner = IStrategyNFT(nftContract).ownerOf(NFTid);
        require(nftOwner != msg.sender, "Cannot buy your own NFT");

        // Transférer d'abord les gUSDC
        IERC20 gUSDC = IERC20(IMockPendleRouter(router).gUSDC());
        require(gUSDC.transferFrom(msg.sender, nftOwner, sale.salePrice), "gUSDC transfer failed");

        // Puis transférer le NFT
        IStrategyNFT(nftContract).transferFrom(nftOwner, msg.sender, NFTid);

        // Mettre à jour le propriétaire dans allPositions
        position.owner = msg.sender;

        // Mettre à jour userPositions
        // Retirer la position de l'ancien propriétaire
        Position[] storage oldOwnerPositions = userPositions[nftOwner];
        for (uint i = 0; i < oldOwnerPositions.length; i++) {
            if (oldOwnerPositions[i].allPositionsId == allPositionsId) {
                // Remplacer avec la dernière position et réduire la longueur
                oldOwnerPositions[i] = oldOwnerPositions[oldOwnerPositions.length - 1];
                oldOwnerPositions.pop();
                break;
            }
        }

        // Ajouter la position au nouveau propriétaire
        userPositions[msg.sender].push(position);

        delete nftSales[allPositionsId];
        emit NFTSold(NFTid, allPositionsId, nftOwner, msg.sender, sale.salePrice);
    }

    // ::::::::::::: GETTERS ::::::::::::: //

    /// @notice Retourne les statistiques du protocole
    /// @return totalActivePositions Nombre total de positions actives
    /// @return totalPositionsOnSale Nombre total de positions en vente
    /// @return protocolPendingFees Frais en attente pour le protocole
    /// @return protocolWithdrawnFees Frais déjà retirés par le protocole
    function getProtocolStats() external view returns (
        uint256 totalActivePositions,
        uint256 totalPositionsOnSale,
        uint256 protocolPendingFees,
        uint256 protocolWithdrawnFees
    ) {
        totalActivePositions = allActivePositionsCount;
        
        // Compter les positions en vente (limité par le nombre de positions actives)
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

    /// @notice Retourne le nombre total de positions actives
    /// @return Le nombre de positions actives
    function getAllActivePositionsCount() external view returns (uint256) {
        return allActivePositionsCount;
    }

    // ::::::::::::: GETTERS POSITIONS ::::::::::::: // 

    // Fonction pour voir toutes les positions d'un utilisateur
    function getUserPositions(address user) external view returns (Position[] memory) {
        return userPositions[user];
    }

    // Fonction pour voir une position spécifique
    function getUserPosition(address user, uint256 positionId) external view returns (Position memory) {
        require(positionId < userPositions[user].length, "Invalid position ID");
        return userPositions[user][positionId];
    }

    // Getters pour les frais
    function getCGPFees(address cgp) external view returns (Fees memory) {
        return cgpFees[cgp];
    }

    function getProtocolFees() external view returns (Fees memory) {
        return protocolFees;
    }

} 

