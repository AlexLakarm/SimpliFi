// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RoleControl
/// @notice Contract for managing roles and relationships between CGPs and clients
/// @dev Extends OpenZeppelin's AccessControl for role-based access control
contract RoleControl is AccessControl {

    // ::::::::::::: CONSTANTS : ROLES ::::::::::::: // 

    /// @notice Role identifier for administrators
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    /// @notice Role identifier for CGPs (Certified Financial Planners)
    bytes32 public constant CGP_ROLE = keccak256("CGP_ROLE");
    /// @notice Role identifier for clients
    bytes32 public constant CLIENT_ROLE = keccak256("CLIENT_ROLE");

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    /// @notice Maps CGP addresses to their client addresses
    mapping(address => address[]) private cgpToClients;
    /// @notice Maps client addresses to their CGP address
    mapping(address => address) private clientToCgp;
    /// @notice Tracks admin status for each address
    mapping(address => bool) private admins;
    /// @notice Tracks CGP status for each address
    mapping(address => bool) private cgps;
    /// @notice List of all admin addresses
    address[] private adminList;
    /// @notice List of all CGP addresses
    address[] private cgpList;

    // ::::::::::::: EVENTS ::::::::::::: // 

    /// @notice Emitted when a new admin is added
    /// @param newAdmin Address of the new admin
    /// @param addedBy Address of the admin who added the new admin
    event AdminAdded(address indexed newAdmin, address indexed addedBy);
    /// @notice Emitted when a new CGP is added
    /// @param newCGP Address of the new CGP
    /// @param addedBy Address of the admin who added the CGP
    event CGPAdded(address indexed newCGP, address indexed addedBy);
    /// @notice Emitted when a new client is added
    /// @param newClient Address of the new client
    /// @param cgp Address of the CGP who added the client
    event ClientAdded(address indexed newClient, address indexed cgp);
    /// @notice Emitted when an admin is removed
    /// @param admin Address of the removed admin
    /// @param removedBy Address of the admin who performed the removal
    event AdminRemoved(address indexed admin, address indexed removedBy);
    /// @notice Emitted when a CGP is removed
    /// @param cgp Address of the removed CGP
    /// @param removedBy Address of the admin who performed the removal
    event CGPRemoved(address indexed cgp, address indexed removedBy);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initializes the contract and sets up initial roles
    /// @dev Grants DEFAULT_ADMIN_ROLE and ADMIN_ROLE to the deployer
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        admins[msg.sender] = true;
        adminList.push(msg.sender);

        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(CGP_ROLE, ADMIN_ROLE);
        _setRoleAdmin(CLIENT_ROLE, CGP_ROLE);
    }

    // ::::::::::::: FUNCTIONS ::::::::::::: // 

    // ::::::::::::: ONLY ADMIN ROLE FUNCTIONS ::::::::::::: // 

    /// @notice Adds a new administrator
    /// @param newAdmin Address of the new administrator
    /// @dev Can only be called by addresses with DEFAULT_ADMIN_ROLE
    function addAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "Account is zero address");
        require(!admins[newAdmin], "Address is already an admin");
        _grantRole(ADMIN_ROLE, newAdmin);
        admins[newAdmin] = true;
        adminList.push(newAdmin);
        emit AdminAdded(newAdmin, msg.sender);
    }

    /// @notice Removes an administrator
    /// @param admin Address of the administrator to remove
    /// @dev Can only be called by addresses with DEFAULT_ADMIN_ROLE
    function deleteAdmin(address admin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(admin != msg.sender, "Cannot remove self");
        require(admins[admin], "Address is not an admin");
        _revokeRole(ADMIN_ROLE, admin);
        admins[admin] = false;
        
        for (uint i = 0; i < adminList.length; i++) {
            if (adminList[i] == admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }
        
        emit AdminRemoved(admin, msg.sender);
    }

    /// @notice Adds a new CGP
    /// @param newCGP Address of the new CGP
    /// @dev Can only be called by addresses with ADMIN_ROLE
    function addCGP(address newCGP) external onlyRole(ADMIN_ROLE) {
        require(newCGP != address(0), "Account is zero address");
        require(!cgps[newCGP], "Address is already a CGP");
        _grantRole(CGP_ROLE, newCGP);
        cgps[newCGP] = true;
        cgpList.push(newCGP);
        emit CGPAdded(newCGP, msg.sender);
    }

    /// @notice Removes a CGP
    /// @param cgp Address of the CGP to remove
    /// @dev Can only be called by addresses with ADMIN_ROLE
    function deleteCGP(address cgp) external onlyRole(ADMIN_ROLE) {
        require(cgps[cgp], "Address is not a CGP");
        require(cgpToClients[cgp].length == 0, "CGP still has clients");
        
        _revokeRole(CGP_ROLE, cgp);
        cgps[cgp] = false;
        
        for (uint i = 0; i < cgpList.length; i++) {
            if (cgpList[i] == cgp) {
                cgpList[i] = cgpList[cgpList.length - 1];
                cgpList.pop();
                break;
            }
        }
        
        emit CGPRemoved(cgp, msg.sender);
    }

    /// @notice Returns the list of all administrators
    /// @return address[] Array of administrator addresses
    function getAllAdmins() external view returns (address[] memory) {
        return adminList;
    }

    /// @notice Returns the list of all CGPs
    /// @return address[] Array of CGP addresses
    function getAllCGPs() external view returns (address[] memory) {
        return cgpList;
    }

    // ::::::::::::: ONLY CGP ROLE FUNCTIONS ::::::::::::: // 

    /// @notice Structure to store client information
    /// @param clientAddress Address of the client
    /// @param cgpAddress Address of the client's CGP
    /// @param isActive Whether the client is currently active
    struct ClientInfo {
        address clientAddress;
        address cgpAddress;
        bool isActive;
    }

    /// @notice List of all clients
    ClientInfo[] private allClientsList;
    /// @notice Maps client addresses to their index in allClientsList
    mapping(address => uint256) private clientToIndex;
    /// @notice Tracks whether an address has ever been a client
    mapping(address => bool) private isExistingClient;

    /// @notice Adds a new client
    /// @param newClient Address of the new client
    /// @dev Can only be called by addresses with CGP_ROLE
    function addClient(address newClient) external onlyRole(CGP_ROLE) {
        require(newClient != address(0), "Account is zero address");
        require(clientToCgp[newClient] == address(0), "Client already has a CGP");
        require(newClient != msg.sender, "CGP cannot be their own client");
        require(!hasRole(CGP_ROLE, newClient), "CGPs cannot be clients");
        
        _grantRole(CLIENT_ROLE, newClient);
        cgpToClients[msg.sender].push(newClient);
        clientToCgp[newClient] = msg.sender;

        ClientInfo memory newClientInfo = ClientInfo({
            clientAddress: newClient,
            cgpAddress: msg.sender,
            isActive: true
        });
        
        if (!isExistingClient[newClient]) {
            allClientsList.push(newClientInfo);
            clientToIndex[newClient] = allClientsList.length - 1;
            isExistingClient[newClient] = true;
        } else {
            uint256 index = clientToIndex[newClient];
            allClientsList[index] = newClientInfo;
        }

        emit ClientAdded(newClient, msg.sender);
    }

    /// @notice Removes a client
    /// @param client Address of the client to remove
    /// @dev Can only be called by the client's CGP
    function deleteClient(address client) external onlyRole(CGP_ROLE) {
        require(hasRole(CLIENT_ROLE, client), "Address is not a client");
        require(clientToCgp[client] == msg.sender, "Not client's CGP");
        
        _revokeRole(CLIENT_ROLE, client);
        
        address[] storage clients = cgpToClients[msg.sender];
        for (uint i = 0; i < clients.length; i++) {
            if (clients[i] == client) {
                clients[i] = clients[clients.length - 1];
                clients.pop();
                break;
            }
        }
        
        if (isExistingClient[client]) {
            uint256 index = clientToIndex[client];
            allClientsList[index].isActive = false;
        }

        delete clientToCgp[client];
    }

    /// @notice Returns the list of all clients
    /// @return ClientInfo[] Array of client information
    /// @dev Can only be called by addresses with ADMIN_ROLE
    function getAllClients() external view onlyRole(ADMIN_ROLE) returns (ClientInfo[] memory) {
        return allClientsList;
    }

    /// @notice Returns the list of clients for a specific CGP
    /// @param cgp Address of the CGP
    /// @return address[] Array of client addresses
    function getCGPClients(address cgp) external view returns (address[] memory) {
        require(hasRole(CGP_ROLE, cgp), "Not a CGP");
        return cgpToClients[cgp];
    }

    /// @notice Returns the CGP address for a specific client
    /// @param client Address of the client
    /// @return address CGP address
    function getClientCGP(address client) external view returns (address) {
        require(hasRole(CLIENT_ROLE, client), "Not a client");
        return clientToCgp[client];
    }

    // Modifiers pour StrategyOne
    /// @notice Modifier to restrict access to administrators
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    /// @notice Modifier to restrict access to CGPs
    modifier onlyCGP() {
        require(hasRole(CGP_ROLE, msg.sender), "Caller is not a CGP");
        _;
    }

    /// @notice Modifier to restrict access to clients
    modifier onlyClient() {
        require(hasRole(CLIENT_ROLE, msg.sender), "Caller is not a client");
        _;
    }

    /// @notice Checks if an address has administrator role
    /// @param account Address to check
    /// @return bool True if the address is an administrator
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    /// @notice Checks if an address has CGP role
    /// @param account Address to check
    /// @return bool True if the address is a CGP
    function isCGP(address account) external view returns (bool) {
        return hasRole(CGP_ROLE, account);
    }

    /// @notice Checks if an address has client role
    /// @param account Address to check
    /// @return bool True if the address is a client
    function isClient(address account) external view returns (bool) {
        return hasRole(CLIENT_ROLE, account);
    }

    /// @notice Returns the primary role of an address
    /// @param account Address to check
    /// @return string Role name ("ADMIN", "CGP", "CLIENT", or "NO_ROLE")
    function getRoles(address account) external view returns (string memory) {
        if (hasRole(ADMIN_ROLE, account)) {
            return "ADMIN";
        } else if (hasRole(CGP_ROLE, account)) {
            return "CGP";
        } else if (hasRole(CLIENT_ROLE, account)) {
            return "CLIENT";
        } else {
            return "NO_ROLE";
        }
    }

    /// @notice Returns all roles of an address
    /// @param account Address to check
    /// @return bool[] Array of booleans indicating role status [admin, cgp, client]
    function getAllRoles(address account) external view returns (bool[] memory) {
        bool[] memory roles = new bool[](3);
        roles[0] = hasRole(ADMIN_ROLE, account);
        roles[1] = hasRole(CGP_ROLE, account);
        roles[2] = hasRole(CLIENT_ROLE, account);
        return roles;
    }

    /// @notice Returns statistics for a CGP
    /// @param cgp Address of the CGP
    /// @return clientCount Total number of clients
    /// @return clients Array of client addresses
    /// @return activeClientsCount Number of active clients
    function getCGPStats(address cgp) external view returns (
        uint256 clientCount,
        address[] memory clients,
        uint256 activeClientsCount
    ) {
        require(hasRole(CGP_ROLE, cgp), "Not a CGP");
        clients = cgpToClients[cgp];
        clientCount = clients.length;
        
        activeClientsCount = 0;
        for(uint i = 0; i < clients.length; i++) {
            if(hasRole(CLIENT_ROLE, clients[i])) {
                activeClientsCount++;
            }
        }
        
        return (clientCount, clients, activeClientsCount);
    }

    /// @notice Returns information about a client
    /// @param client Address of the client
    /// @return isActive Whether the client is active
    /// @return assignedCGP Address of the assigned CGP
    /// @return assignmentDate Timestamp of the assignment
    function getClientInfo(address client) external view returns (
        bool isActive,
        address assignedCGP,
        uint256 assignmentDate
    ) {
        isActive = hasRole(CLIENT_ROLE, client);
        assignedCGP = clientToCgp[client];
        return (isActive, assignedCGP, block.timestamp);
    }
} 