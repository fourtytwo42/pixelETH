require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 33701, // Different chain ID from main testing
      blockGasLimit: 30000000, // 30M gas block limit
      allowUnlimitedContractSize: true,
      accounts: {
        count: 10,
        accountsBalance: "100000000000000000000000", // 100k ETH per account
      },
    },
    gas_test: {
      url: "http://127.0.0.1:8546", // Different port from main hardhat node
      chainId: 33701,
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 21,
    showTimeSpent: true,
    showMethodSig: true,
  },
  mocha: {
    timeout: 120000, // 2 minutes
  },
};
