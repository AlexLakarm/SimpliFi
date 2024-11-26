// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract StrategyNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    // Adresse du contrat StrategyOne qui peut mint
    address public strategyContract;

    // URI de base pour les métadonnées
    string private _baseTokenURI;

    // Structure pour stocker les attributs de la stratégie
    struct StrategyAttributes {
        uint256 initialAmount;   // Montant initial investi
        uint256 duration;        // Durée de la stratégie
        uint256 strategyId;      // ID de la stratégie dans StrategyOne
        uint256 timestamp;       // Date de création
    }

    // Mapping des attributs par tokenId
    mapping(uint256 => StrategyAttributes) public strategyAttributes;

    // Events
    event StrategyNFTMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 initialAmount,
        uint256 duration,
        uint256 strategyId,
        uint256 timestamp
    );

    event StrategyNFTBurned(uint256 indexed tokenId, uint256 timestamp);

    // Variable pour suivre le dernier tokenId utilisé
    uint256 private _lastTokenId;

    constructor(string memory ipfsURI) ERC721("SimpliFi Strategies", "SFNFT") Ownable(msg.sender) {
        _baseTokenURI = ipfsURI;
    }

    // Fonction pour définir l'adresse du contrat StrategyOne
    function setStrategyContract(address _strategyContract) external onlyOwner {
        require(_strategyContract != address(0), "Invalid address");
        strategyContract = _strategyContract;
    }

    // Fonction pour mint un nouveau NFT (appelée par StrategyOne)
    function mintStrategyNFT(
        address to,
        uint256 initialAmount,
        uint256 duration,
        uint256 strategyId
    ) external returns (uint256) {
        require(msg.sender == strategyContract, "Only strategy contract can mint");
        
        // Incrémenter le tokenId au lieu d'utiliser totalSupply
        _lastTokenId++;
        uint256 newTokenId = _lastTokenId;
        
        _safeMint(to, newTokenId);

        strategyAttributes[newTokenId] = StrategyAttributes({
            initialAmount: initialAmount,
            duration: duration,
            strategyId: strategyId,
            timestamp: block.timestamp
        });

        emit StrategyNFTMinted(
            to,
            newTokenId,
            initialAmount,
            duration,
            strategyId,
            block.timestamp
        );

        return newTokenId;
    }

    // Fonction pour brûler un NFT (uniquement appelable par StrategyOne)
    function burn(uint256 tokenId) external {
        require(msg.sender == strategyContract, "Only strategy contract can burn");
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        _burn(tokenId);
        delete strategyAttributes[tokenId];
        
        emit StrategyNFTBurned(tokenId, block.timestamp);
    }

    // Override de la fonction baseURI
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // Fonction pour mettre à jour l'URI de base
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // Fonction pour obtenir les attributs d'une stratégie
    function getStrategyAttributes(uint256 tokenId) external view returns (StrategyAttributes memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return strategyAttributes[tokenId];
    }

    // Construction du tokenURI avec les attributs on-chain
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        StrategyAttributes memory attrs = strategyAttributes[tokenId];
        
        // Construction de l'URL de l'image avec le format correct
        string memory imageUrl = string(abi.encodePacked(
            "https://ipfs.io/ipfs/",
            _baseTokenURI
        ));
        
        // Construction du JSON avec des virgules correctement placées
        string memory json = string(abi.encodePacked(
            '{"name": "Simplifi Strategy #', 
            Strings.toString(tokenId),
            '", "description": "Simplifi DeFi Strategy NFT", "image": "',
            imageUrl,
            '", "attributes": [{"trait_type": "Initial Amount", "value": "',
            Strings.toString(attrs.initialAmount),
            '"}, {"trait_type": "Duration", "value": "',
            Strings.toString(attrs.duration),
            '"}, {"trait_type": "Strategy ID", "value": "',
            Strings.toString(attrs.strategyId),
            '"}, {"trait_type": "Creation Date", "value": "',
            Strings.toString(attrs.timestamp),
            '"}]}'
        ));

        // Utilisation de Base64 d'OpenZeppelin
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }
} 