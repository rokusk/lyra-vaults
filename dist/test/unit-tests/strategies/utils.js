"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeDeltaStrategy = void 0;
const hardhat_1 = require("hardhat");
function encodeDeltaStrategy(minTimeToExpiry, maxTimeToExpiry, targetDelta, maxDeltaGap, minIv, maxIv, size, minInterval) {
    const encoder = new hardhat_1.ethers.utils.AbiCoder();
    return encoder.encode(['uint', 'uint', 'int', 'int', 'uint', 'uint', 'uint', 'uint'], [minTimeToExpiry, maxTimeToExpiry, targetDelta, maxDeltaGap, minIv, maxIv, size, minInterval]);
}
exports.encodeDeltaStrategy = encodeDeltaStrategy;
