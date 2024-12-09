// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/// @title StrategyNFT
/// @notice NFT contract for representing investment strategy positions
/// @dev Extends ERC721Enumerable for enumerable token support and Ownable for access control
contract StrategyNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    // ::::::::::::: CONSTANTS ::::::::::::: //

    /// @notice Address of the StrategyOne contract that can mint NFTs
    address public strategyContract;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Variable to track the last used tokenId
    uint256 private _lastTokenId;

    // ::::::::::::: STRUCTS ::::::::::::: //

    /// @notice Structure to store strategy attributes
    /// @param initialAmount Initial amount invested in the strategy
    /// @param duration Duration of the strategy in seconds
    /// @param strategyId ID of the strategy in StrategyOne contract
    /// @param timestamp Creation timestamp of the strategy
    struct StrategyAttributes {
        uint256 initialAmount;
        uint256 duration;
        uint256 strategyId;
        uint256 timestamp;
    }

    // ::::::::::::: MAPPINGS ::::::::::::: //

    /// @notice Mapping of token attributes by tokenId
    mapping(uint256 => StrategyAttributes) public strategyAttributes;

    // ::::::::::::: EVENTS ::::::::::::: //   

    /// @notice Emitted when a new strategy NFT is minted
    /// @param owner Address of the NFT owner
    /// @param tokenId ID of the minted NFT
    /// @param initialAmount Initial investment amount
    /// @param duration Strategy duration
    /// @param strategyId Strategy ID in StrategyOne
    /// @param timestamp Minting timestamp
    event StrategyNFTMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 initialAmount,
        uint256 duration,
        uint256 strategyId,
        uint256 timestamp
    );

    /// @notice Emitted when a strategy NFT is burned
    /// @param tokenId ID of the burned NFT
    /// @param timestamp Burning timestamp
    event StrategyNFTBurned(uint256 indexed tokenId, uint256 timestamp);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: //

    /// @notice Initializes the contract with a base IPFS URI
    /// @param ipfsURI Base IPFS URI for token metadata
    constructor(string memory ipfsURI) ERC721("SimpliFi Strategies", "SFNFT") Ownable(msg.sender) {
        _baseTokenURI = ipfsURI;
    }

    // ::::::::::::: FUNCTIONS ::::::::::::: //

    /// @notice Sets the address of the StrategyOne contract
    /// @param _strategyContract Address of the StrategyOne contract
    /// @dev Can only be called by the contract owner
    function setStrategyContract(address _strategyContract) external onlyOwner {
        require(_strategyContract != address(0), "Invalid address");
        strategyContract = _strategyContract;
    }

    // :::: MINT :::: //

    /// @notice Mints a new strategy NFT
    /// @param to Address to mint the NFT to
    /// @param initialAmount Initial investment amount
    /// @param duration Strategy duration
    /// @param strategyId Strategy ID in StrategyOne
    /// @return uint256 ID of the minted NFT
    /// @dev Can only be called by the StrategyOne contract
    function mintStrategyNFT(
        address to,
        uint256 initialAmount,
        uint256 duration,
        uint256 strategyId
    ) external returns (uint256) {
        require(msg.sender == strategyContract, "Only strategy contract can mint");
        
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

    // :::: BURN :::: //

    /// @notice Burns a strategy NFT
    /// @param tokenId ID of the NFT to burn
    /// @dev Can only be called by the StrategyOne contract
    function burn(uint256 tokenId) external {
        require(msg.sender == strategyContract, "Only strategy contract can burn");
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        _burn(tokenId);
        delete strategyAttributes[tokenId];
        
        emit StrategyNFTBurned(tokenId, block.timestamp);
    }

    // :::: BASE URI :::: //

    /// @notice Returns the base URI for token metadata
    /// @return string Base URI
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /// @notice Sets a new base URI for token metadata
    /// @param baseURI New base URI
    /// @dev Can only be called by the contract owner
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // :::: TOKEN URI :::: //

    /// @notice Returns the URI for a given token's metadata
    /// @param tokenId ID of the token
    /// @return string Token URI with metadata
    /// @dev Constructs an on-chain base64 encoded JSON metadata string
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        StrategyAttributes memory attrs = strategyAttributes[tokenId];
        
        string memory imageUrl = string(abi.encodePacked(
            "https://ipfs.io/ipfs/",
            _baseTokenURI
        ));
        
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

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    // ::::::::::::: GETTERS ::::::::::::: //

    /// @notice Returns the attributes of a strategy NFT
    /// @param tokenId ID of the NFT
    /// @return StrategyAttributes Attributes of the strategy
    function getStrategyAttributes(uint256 tokenId) external view returns (StrategyAttributes memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return strategyAttributes[tokenId];
    }

    /// @notice Returns all tokens owned by an address
    /// @param owner Address to query
    /// @return uint256[] Array of token IDs owned by the address
    function getTokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        
        for(uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokens;
    }
} 