// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RoleControl is AccessControl {

    // ::::::::::::: CONSTANTS : ROLES ::::::::::::: // 

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CGP_ROLE = keccak256("CGP_ROLE");
    bytes32 public constant CLIENT_ROLE = keccak256("CLIENT_ROLE");

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    // Mapping pour stocker les clients de chaque CGP
    mapping(address => address[]) private cgpToClients;
    // Mapping pour retrouver le CGP d'un client
    mapping(address => address) private clientToCgp;
    // Nouveaux mappings pour tracker les admins et CGPs
    mapping(address => bool) private admins;
    mapping(address => bool) private cgps;
    address[] private adminList;
    address[] private cgpList;

    // ::::::::::::: EVENTS ::::::::::::: // 

    event AdminAdded(address indexed newAdmin, address indexed addedBy);
    event CGPAdded(address indexed newCGP, address indexed addedBy);
    event ClientAdded(address indexed newClient, address indexed cgp);
    event AdminRemoved(address indexed admin, address indexed removedBy);
    event CGPRemoved(address indexed cgp, address indexed removedBy);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    constructor() {
        // Le déployeur reçoit le rôle DEFAULT_ADMIN_ROLE et ADMIN_ROLE
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Ajout du déployeur aux listes
        admins[msg.sender] = true;
        adminList.push(msg.sender);

        // Configuration des rôles administrateurs
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(CGP_ROLE, ADMIN_ROLE);
        _setRoleAdmin(CLIENT_ROLE, CGP_ROLE);
    }

    // ::::::::::::: FUNCTIONS ::::::::::::: // 

    // ::::::::::::: ONLY ADMIN ROLE FUNCTIONS ::::::::::::: // 

    // Admins management

    function addAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "Account is zero address");
        require(!admins[newAdmin], "Address is already an admin");
        _grantRole(ADMIN_ROLE, newAdmin);
        admins[newAdmin] = true;
        adminList.push(newAdmin);
        emit AdminAdded(newAdmin, msg.sender);
    }

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

    // CGPs management

    function addCGP(address newCGP) external onlyRole(ADMIN_ROLE) {
        require(newCGP != address(0), "Account is zero address");
        require(!cgps[newCGP], "Address is already a CGP");
        _grantRole(CGP_ROLE, newCGP);
        cgps[newCGP] = true;
        cgpList.push(newCGP);
        emit CGPAdded(newCGP, msg.sender);
    }

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

    // Getters

    function getAllAdmins() external view returns (address[] memory) {
        return adminList;
    }

    function getAllCGPs() external view returns (address[] memory) {
        return cgpList;
    }

    // ::::::::::::: ONLY CGP ROLE FUNCTIONS ::::::::::::: // 

    // Clients management

    struct ClientInfo {
        address clientAddress;
        address cgpAddress;
        bool isActive;
    }

    ClientInfo[] private allClientsList;
    mapping(address => uint256) private clientToIndex;
    mapping(address => bool) private isExistingClient;

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

    // Getter onlyAdmin

    function getAllClients() external view onlyRole(ADMIN_ROLE) returns (ClientInfo[] memory) {
        return allClientsList;
    }

    // Fonction pour obtenir tous les clients d'un CGP
    function getCGPClients(address cgp) external view returns (address[] memory) {
        require(hasRole(CGP_ROLE, cgp), "Not a CGP");
        return cgpToClients[cgp];
    }

    // Fonction pour obtenir le CGP d'un client
    function getClientCGP(address client) external view returns (address) {
        require(hasRole(CLIENT_ROLE, client), "Not a client");
        return clientToCgp[client];
    }

    // Modifiers pour StrategyOne
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    modifier onlyCGP() {
        require(hasRole(CGP_ROLE, msg.sender), "Caller is not a CGP");
        _;
    }

    modifier onlyClient() {
        require(hasRole(CLIENT_ROLE, msg.sender), "Caller is not a client");
        _;
    }

    // Getters spécifiques pour vérifier les rôles
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    function isCGP(address account) external view returns (bool) {
        return hasRole(CGP_ROLE, account);
    }

    function isClient(address account) external view returns (bool) {
        return hasRole(CLIENT_ROLE, account);
    }

    // Fonction pour obtenir le rôle principal d'une adresse
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

    // Si on veut quand même vérifier tous les rôles (cas où quelqu'un aurait plusieurs rôles)
    function getAllRoles(address account) external view returns (bool[] memory) {
        bool[] memory roles = new bool[](3);
        roles[0] = hasRole(ADMIN_ROLE, account);
        roles[1] = hasRole(CGP_ROLE, account);
        roles[2] = hasRole(CLIENT_ROLE, account);
        return roles;
    }

    // Fonction pour obtenir les statistiques d'un CGP
    function getCGPStats(address cgp) external view returns (
        uint256 clientCount,
        address[] memory clients,
        uint256 activeClientsCount
    ) {
        require(hasRole(CGP_ROLE, cgp), "Not a CGP");
        clients = cgpToClients[cgp];
        clientCount = clients.length;
        
        // Compte des clients actifs (qui ont toujours le rôle CLIENT)
        activeClientsCount = 0;
        for(uint i = 0; i < clients.length; i++) {
            if(hasRole(CLIENT_ROLE, clients[i])) {
                activeClientsCount++;
            }
        }
        
        return (clientCount, clients, activeClientsCount);
    }

    // Fonction pour obtenir les infos d'un client
    function getClientInfo(address client) external view returns (
        bool isActive,
        address assignedCGP,
        uint256 assignmentDate
    ) {
        isActive = hasRole(CLIENT_ROLE, client);
        assignedCGP = clientToCgp[client];
        // Note: nous pourrions ajouter un mapping pour stocker la date d'assignation
        return (isActive, assignedCGP, block.timestamp);
    }
} 