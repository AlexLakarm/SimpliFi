// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockPendleOracle
/// @notice Mock contract simulating Pendle's oracle functionality for testing purposes
/// @dev Implements basic price oracle functionality with mock data
contract MockPendleOracle is Ownable {

    // ::::::::::::: CONSTANTS ::::::::::::: // 

    /// @notice Scale factor for precision (1e18)
    uint256 private constant SCALE = 1e18;

    // ::::::::::::: MAPPINGS ::::::::::::: // 

    /// @notice Mapping to store PT rates by token address
    mapping(address => uint256) private tokenToPtRates;

    /// @notice Mapping to store annual yields in percentage points by token address
    mapping(address => uint256) private annualYieldsPts;

    /// @notice Mapping to store strategy durations in seconds by token address
    mapping(address => uint256) private strategiesDurations;

    // ::::::::::::: EVENTS ::::::::::::: // 

    /// @notice Emitted when a PT rate is updated
    /// @param token The address of the token
    /// @param newRate The new PT rate
    event RateUpdated(address indexed token, uint256 newRate);

    /// @notice Emitted when a yield rate is updated
    /// @param token The address of the token
    /// @param newYield The new yield rate
    event YieldUpdated(address indexed token, uint256 newYield);

    /// @notice Emitted when a duration is updated
    /// @param token The address of the token
    /// @param newDuration The new duration
    event DurationUpdated(address indexed token, uint256 newDuration);

    // ::::::::::::: CONSTRUCTOR ::::::::::::: // 

    /// @notice Initializes the contract with the deployer as owner
    constructor()Ownable(msg.sender) {}

    // ::::::::::::: FUNCTIONS ::::::::::::: //     

    // :::: STRATEGY SETTINGS :::: // 

    /// @notice Updates the PT rate and annual yield for a token
    /// @param _ptTokenAddress The address of the PT token
    /// @param _annualYieldPoints The annual yield in percentage points (1-100)
    /// @dev Calculates the PT rate based on the annual yield
    function setRateAndPrice(address _ptTokenAddress, uint256 _annualYieldPoints) external onlyOwner {
        require(_annualYieldPoints > 0, "Yield must be greater than zero");
        require(_annualYieldPoints <= 100, "Yield cannot exceed 100%");
        
        tokenToPtRates[_ptTokenAddress] = SCALE - ((_annualYieldPoints * SCALE) / 100);
        annualYieldsPts[_ptTokenAddress] = _annualYieldPoints;

        emit RateUpdated(_ptTokenAddress, tokenToPtRates[_ptTokenAddress]);
        emit YieldUpdated(_ptTokenAddress, _annualYieldPoints);
    }

    /// @notice Updates the duration for a strategy
    /// @param _ptTokenAddress The address of the PT token
    /// @param _duration The duration in seconds
    function setDuration(address _ptTokenAddress, uint256 _duration) external onlyOwner {
        require(_duration > 30, "Strategy duration must be > 30 days");
        strategiesDurations[_ptTokenAddress] = _duration;

        emit DurationUpdated(_ptTokenAddress, _duration);
    }

    // :::: STRATEGY GETTERS :::: // 

    /// @notice Gets the PT rate for a token
    /// @param _ptTokenAddress The address of the PT token
    /// @return The PT rate with 18 decimals precision
    function getPTRate(address _ptTokenAddress) external view returns (uint256) {
        uint256 rate = tokenToPtRates[_ptTokenAddress];
        require(rate > 0, "Rate not set for this token");
        return rate;
    }

    /// @notice Gets the annual yield for a token
    /// @param _ptTokenAddress The address of the PT token
    /// @return The annual yield in percentage points
    function getYield(address _ptTokenAddress) external view returns (uint256) {
        uint256 yield = annualYieldsPts[_ptTokenAddress];
        require(yield > 0, "Yield not set for this token");
        return yield;
    }

    /// @notice Gets the duration for a strategy
    /// @param _ptTokenAddress The address of the PT token
    /// @return The duration in seconds
    function getDuration(address _ptTokenAddress) external view returns (uint256) {
        uint256 duration = strategiesDurations[_ptTokenAddress];
        require(duration > 0, "Duration not set for this token");
        return duration;
    }

    /// @notice TEST FUNCTION ONLY - TO BE REMOVED BEFORE PRODUCTION DEPLOYMENT
    /// @dev Sets test parameters with short duration and high yield for testing purposes
    /// @param _ptTokenAddress The address of the PT token
    function setTestParameters(address _ptTokenAddress) external onlyOwner {
        // Force a 1-minute duration for testing
        uint256 testDuration = 1 minutes;
        strategiesDurations[_ptTokenAddress] = testDuration;
        emit DurationUpdated(_ptTokenAddress, testDuration);

        // Force a high yield for testing (50%)
        uint256 testYield = 50;
        tokenToPtRates[_ptTokenAddress] = SCALE - ((testYield * SCALE) / 100);
        annualYieldsPts[_ptTokenAddress] = testYield;
        emit RateUpdated(_ptTokenAddress, tokenToPtRates[_ptTokenAddress]);
        emit YieldUpdated(_ptTokenAddress, testYield);
    }
}
