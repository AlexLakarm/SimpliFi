require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const HOLESKY_RPC_URL=process.env.HOLESKY_RPC_URL || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks:{
    localhost:{
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    holesky : {
      url: HOLESKY_RPC_URL ,
      chainId: 17000,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  },
  solidity: "0.8.28",
  etherscan:{
    apiKey:{
      holesky:ETHERSCAN_API_KEY
    }
  }
};