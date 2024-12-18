require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

// Configuration de base
const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // Configuration pour le réseau de test intégré
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    }
  },
  solidity: "0.8.28"
};

// Ajouter la configuration Holesky seulement si les variables d'environnement sont présentes
if (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64 &&
    process.env.HOLESKY_RPC_URL && process.env.ETHERSCAN_API_KEY) {
  config.networks.holesky = {
    url: process.env.HOLESKY_RPC_URL,
    chainId: 17000,
    accounts: [process.env.PRIVATE_KEY]
  };
  
  config.etherscan = {
    apiKey: {
      holesky: process.env.ETHERSCAN_API_KEY
    }
  };
}

module.exports = config;