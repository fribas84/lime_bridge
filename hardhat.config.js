require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require('dotenv').config({ path: __dirname + '/.env' })

const { ETHERSCAN_API_KEY, MUMBAI_ALCHEMY, GOERLI_ALCHEMY, DEV_PRIVATE_KEY, POLYGON_API_KEY} = process.env;


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings:{
      optimizer:{
        enabled:true,
        runs:1000
      }
    }
  },
  gasReporter:{
    enabled:true,
  },
  networks:{
    goerli:{
      url: `https://eth-goerli.alchemyapi.io/v2/${GOERLI_ALCHEMY}`,
      accounts: [DEV_PRIVATE_KEY]
    },
    mumbai:{
      url: `https://polygon-mumbai.g.alchemy.com/v2/${MUMBAI_ALCHEMY}`,
      accounts: [DEV_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      polygon: POLYGON_API_KEY,
      polygonMumbai: POLYGON_API_KEY
    },
  },
};

task("deploy-testnets", "Deploys contract on a provided network")
    .setAction(async (taskArguments, hre, runSuper) => {
        const deployContract = require("./scripts/deployTestnet");
        await deployContract(taskArguments);
    });

