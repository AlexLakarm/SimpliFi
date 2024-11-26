# Simplifi Backend - DeFi Strategy Smart Contracts

## Overview
This backend implements the smart contract infrastructure for Simplifi, a DeFi platform integrating with Pendle Finance for yield strategies. The contracts manage role-based access, strategy execution, and NFT position tracking.

## Mock Pendle Finance Integration
We've implemented a simplified version of Pendle Finance's core mechanics:

- **gUSDC**: Mock underlying token (similar to USDC)
- **PtgUSDC**: Principal Token that represents the tokenized yield position
- **MockPendleRouter**: Simulates Pendle's router for token swaps and strategy execution
- **MockPendleOracle**: Provides mock yield rates and duration calculations

## Smart Contracts Structure

### Core Contracts
- `RoleControl.sol`: Manages platform roles (Admin, CGP, Client)
- `StrategyOne.sol`: Main strategy implementation
- `StrategyNFT.sol`: NFT representation of positions

### Mock Contracts
- `gUSDC.sol`: Mock stablecoin
- `PtgUSDC.sol`: Mock Principal Token
- `MockPendleRouter.sol`: Mock router implementation
- `MockPendleOracle.sol`: Mock oracle for yield data

## Testing

### Unit Tests Location
```
test/unit/
├── Rolecontrol.test.js       # Role management tests
├── StrategyOne.test.js       # Strategy implementation tests
├── StrategyNft.test.js       # NFT functionality tests
└── mock/
    ├── GUsdc.test.js         # Mock stablecoin tests
    ├── PtGUsdc.test.js       # Mock PT token tests
    ├── MockPendleRouter.test.js  # Mock router tests
    └── MockPendleOracle.test.js  # Mock oracle tests
```

## Development Setup

```bash
# Install dependencies
npm install

# Run tests
npx hardhat test

# Run specific test file
npx hardhat test test/unit/Rolecontrol.test.js

# Deploy contracts (local network)
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## Deployment Scripts
```
scripts/
├── RoleControlDeploy.js
├── StrategyOneDeploy.js
├── StrategyNFTDeploy.js
└── mockDeploy.js
```

## Contract Interaction Scripts
```
scripts/
├── strategyOneEnter.js   # Enter a strategy
└── strategyOneExit.js    # Exit a strategy
```

## Testing Coverage
Run coverage report:
```bash
npx hardhat coverage
```

## Environment Variables
Create a `.env` file:
```
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Contract Addresses
Contract addresses are managed in `config/addresses.js`
