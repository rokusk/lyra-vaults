"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@eth-optimism/plugins/hardhat/compiler");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("hardhat-typechain");
require("solidity-coverage");
dotenv.config();
const mnemonic = fs.existsSync('.secret')
    ? fs.readFileSync('.secret').toString().trim()
    : 'test test test test test test test test test test test junk';
const etherscanKey = process.env.ETHERSCAN_KEY;
// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
exports.default = {
    networks: {
        hardhat: {},
        local: {
            url: 'http://127.0.0.1:8545',
            accounts: { mnemonic },
            gasPrice: 0,
        },
        kovan: {
            url: 'https://kovan.infura.io/v3/',
        },
        'local-ovm': {
            url: 'http://127.0.0.1:8545',
            accounts: { mnemonic },
            gasPrice: 0,
            ovm: true,
        },
        'kovan-ovm': {
            url: 'https://kovan.optimism.io',
            ovm: true,
        },
    },
    solidity: {
        version: '0.7.6',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1,
            },
        },
    },
    typechain: {
        outDir: 'typechain',
        target: 'ethers-v5',
    },
    contractSizer: {
        alphaSort: true,
    },
    etherscan: {
        apiKey: etherscanKey,
    },
    gasReporter: {
        enabled: false,
    },
};
