"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBytes32 = void 0;
const hardhat_1 = require("hardhat");
const toBytes32 = (msg) => {
    return hardhat_1.ethers.utils.formatBytes32String(msg);
};
exports.toBytes32 = toBytes32;
