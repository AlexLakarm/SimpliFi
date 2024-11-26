# Simplifi - DeFi Yield Strategy Platform

## Overview
Simplifi is a decentralized finance (DeFi) platform that enables users to participate in yield strategies through a simplified interface. The platform integrates with Pendle Finance's yield tokenization protocol, allowing users to earn yields on their stablecoins while maintaining control through NFT-represented positions.

## Key Features
- **Role-Based Access Control**: Three-tiered system with Admins, CGPs (Chargés en Gestion de Patrimoine), and Clients
- **Yield Strategies**: Automated yield generation using Pendle Finance's PT (Principal Tokens)
- **NFT Position Tracking**: Each strategy position is represented by a unique NFT
- **Fee Distribution**: Automated fee collection and distribution between protocol and CGPs

## Technical Stack
- **Smart Contracts**: Solidity 0.8.28
- **Development Environment**: Hardhat
- **Testing**: Chai & Ethers.js
- **Frontend**: React (coming soon)

## Project Structure

## Smart Contracts
- **RoleControl**: Manages platform access and roles
- **StrategyOne**: Core strategy implementation
- **StrategyNFT**: NFT representation of strategy positions
- **Mock Contracts**: Simulated Pendle Finance integration

## Getting Started

### Prerequisites
- Node.js >= 14
- npm or yarn
- Hardhat

### Installation

## Testing
The project includes comprehensive test suites for all smart contracts:
- Unit tests for each contract
- Integration tests for strategy flows
- Mock tests for Pendle Finance integration

## License
MIT

## Contributors
- Alexandre KERMAREC
