// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPendleOracle is Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    // Échelle pour la précision (1e18)
    uint256 private constant SCALE = 1e18;

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    // Mappings pour stocker les données par adresse de token
    mapping(address => uint256) private tokenToPtRates; // Taux des PT
    mapping(address => uint256) private annualYieldsPts; // Rendements annuels en %
    mapping(address => uint256) private strategiesDurations; // Durées des stratégies en secondes

    // ::::::::::::: EVENTS ::::::::::::: // 

    // Events pour le suivi des mises à jour
    event RateUpdated(address indexed token, uint256 newRate);
    event YieldUpdated(address indexed token, uint256 newYield);
    event DurationUpdated(address indexed token, uint256 newDuration);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    constructor()Ownable(msg.sender) {}

    // ::::::::::::: FUNCTIONS ::::::::::::: //     

    // :::: STRATEGY SETTINGS :::: // 

    // Fonction pour mettre à jour le taux PT et le rendement annuel
    function setRateAndPrice(address _ptTokenAddress, uint256 _annualYieldPoints) external onlyOwner {
        require(_annualYieldPoints > 0, "Yield must be greater than zero");
        require(_annualYieldPoints <= 100, "Yield cannot exceed 100%");
        
        tokenToPtRates[_ptTokenAddress] = SCALE - ((_annualYieldPoints * SCALE) / 100);
        annualYieldsPts[_ptTokenAddress] = _annualYieldPoints;

        emit RateUpdated(_ptTokenAddress, tokenToPtRates[_ptTokenAddress]);
        emit YieldUpdated(_ptTokenAddress, _annualYieldPoints);
    }

    // Fonction pour mettre à jour la durée d'une stratégie
    function setDuration(address _ptTokenAddress, uint256 _duration) external onlyOwner {
        require(_duration > 30, "Strategy duration must be > 30 days");
        strategiesDurations[_ptTokenAddress] = _duration;

        emit DurationUpdated(_ptTokenAddress, _duration);
    }

    // :::: STRATEGY GETTERS :::: // 

    // Fonction pour récupérer le taux PT d'un token
    function getPTRate(address _ptTokenAddress) external view returns (uint256) {
        uint256 rate = tokenToPtRates[_ptTokenAddress];
        require(rate > 0, "Rate not set for this token");
        return rate; // Retourne un taux avec 18 décimales de précision
    }

    // Fonction pour récupérer le rendement annuel d'un token
    function getYield(address _ptTokenAddress) external view returns (uint256) {
        uint256 yield = annualYieldsPts[_ptTokenAddress];
        require(yield > 0, "Yield not set for this token");
        return yield; // Retourne le rendement annuel (en %)
    }

    // Fonction pour récupérer la durée d'une stratégie d'un token
    function getDuration(address _ptTokenAddress) external view returns (uint256) {
        uint256 duration = strategiesDurations[_ptTokenAddress];
        require(duration > 0, "Duration not set for this token");
        return duration; // Retourne la durée en secondes
    }

    // ⚠️ FONCTION DE TEST UNIQUEMENT - À SUPPRIMER AVANT DÉPLOIEMENT EN PRODUCTION ⚠️
    function setTestParameters(address _ptTokenAddress) external onlyOwner {
        // Force une durée de 1 minute pour les tests
        uint256 testDuration = 1 minutes;
        strategiesDurations[_ptTokenAddress] = testDuration;
        emit DurationUpdated(_ptTokenAddress, testDuration);

        // Force un yield très élevé pour les tests (50%)
        uint256 testYield = 50; // 50%
        tokenToPtRates[_ptTokenAddress] = SCALE - ((testYield * SCALE) / 100);
        annualYieldsPts[_ptTokenAddress] = testYield;
        emit RateUpdated(_ptTokenAddress, tokenToPtRates[_ptTokenAddress]);
        emit YieldUpdated(_ptTokenAddress, testYield);
    }
}
