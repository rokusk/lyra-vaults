"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const utils_1 = require("./utils");
const HOUR_SEC = 60 * 60;
const DAY_SEC = 24 * HOUR_SEC;
const WEEK_SEC = 7 * DAY_SEC;
const MONTH_SEC = 28 * DAY_SEC;
const YEAR_SEC = 365 * DAY_SEC;
describe('Delta Vault Strategy', async () => {
    let manager;
    let randomUser;
    let strategy;
    const minTimeToExpiry = hardhat_1.ethers.BigNumber.from(DAY_SEC * 4);
    const maxTimeToExpiry = hardhat_1.ethers.BigNumber.from(DAY_SEC * 10);
    const targetDelta = hardhat_1.ethers.utils.parseUnits('0.25', 18);
    const maxDeltaGap = hardhat_1.ethers.utils.parseUnits('0.1', 18); // min delta=0.15 and max delta=0.35
    const minIv = hardhat_1.ethers.utils.parseUnits('0.5', 18); // minIV=50%
    const maxIv = hardhat_1.ethers.utils.parseUnits('1.5', 18); // maxIV=150%
    const size = hardhat_1.ethers.utils.parseUnits('1', 18); // 1 STANDARD SIZE PER TRADE
    const minInterval = hardhat_1.ethers.BigNumber.from(HOUR_SEC);
    describe('setup roles', async () => {
        const addresses = await hardhat_1.ethers.getSigners();
        manager = addresses[0];
        randomUser = addresses[9];
    });
    describe('deployment', async () => {
        it('deploy strategy', async () => {
            const DeltaStrategy = await hardhat_1.ethers.getContractFactory('DeltaStrategy');
            strategy = (await DeltaStrategy.connect(manager).deploy(hardhat_1.ethers.constants.AddressZero, // vault
            '0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154', // blackScholes
            '0xCD8a1C3ba11CF5ECfa6267617243239504a98d90', // optionMarket
            '0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3'));
            (0, chai_1.expect)(await strategy.vault()).to.be.eq(hardhat_1.ethers.constants.AddressZero);
            (0, chai_1.expect)(await strategy.blackScholes()).to.be.eq('0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154');
            (0, chai_1.expect)(await strategy.optionMarket()).to.be.eq('0xCD8a1C3ba11CF5ECfa6267617243239504a98d90');
            (0, chai_1.expect)(await strategy.greekCache()).to.be.eq('0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3');
        });
    });
    describe('setStrategy', async () => {
        it('setting strategy should correctly update strategy variables', async () => {
            const strategyBytes = (0, utils_1.encodeDeltaStrategy)(minTimeToExpiry, maxTimeToExpiry, targetDelta, maxDeltaGap, minIv, maxIv, size, minInterval);
            await strategy.connect(manager).setStrategy(strategyBytes);
            const newStrategy = await strategy.currentStrategy();
            (0, chai_1.expect)(newStrategy.minTimeToExpiry).to.be.eq(hardhat_1.ethers.BigNumber.from(DAY_SEC * 4));
            (0, chai_1.expect)(newStrategy.maxTimeToExpiry).to.be.eq(hardhat_1.ethers.BigNumber.from(DAY_SEC * 10));
            (0, chai_1.expect)(newStrategy.targetDelta).to.be.eq(hardhat_1.ethers.utils.parseUnits('0.25', 18));
            (0, chai_1.expect)(newStrategy.maxDeltaGap).to.be.eq(hardhat_1.ethers.utils.parseUnits('0.1', 18));
            (0, chai_1.expect)(newStrategy.minIv).to.be.eq(hardhat_1.ethers.utils.parseUnits('0.5', 18));
            (0, chai_1.expect)(newStrategy.maxIv).to.be.eq(hardhat_1.ethers.utils.parseUnits('1.5', 18));
            (0, chai_1.expect)(newStrategy.size).to.be.eq(hardhat_1.ethers.utils.parseUnits('1', 18));
            (0, chai_1.expect)(newStrategy.minInterval).to.be.eq(hardhat_1.ethers.BigNumber.from(HOUR_SEC));
        });
        it('should revert if setStrategy is not called by owner', async () => {
            await (0, chai_1.expect)(strategy.connect(randomUser).setStrategy(ethers_1.constants.AddressZero)).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });
    describe('requestTrade', async () => {
        it('should return correct size, listing id, premium', async () => {
            const boardId = hardhat_1.ethers.BigNumber.from('1');
            await strategy.connect(randomUser).requestTrade(boardId);
            const { listingId, size, minPremium } = await strategy.requestTrade(boardId);
            (0, chai_1.expect)(listingId).to.be.eq(hardhat_1.ethers.BigNumber.from('9'));
            (0, chai_1.expect)(minPremium).to.be.eq(hardhat_1.ethers.utils.parseUnits('0', 18));
            (0, chai_1.expect)(size).to.be.eq(hardhat_1.ethers.utils.parseUnits('1', 18));
        });
        // todo: test setStrategy allowable times
    });
    describe('checkPostTrade', async () => {
        // todo: update test case
        it('should return true if ...', async () => {
            (0, chai_1.expect)(await strategy.checkPostTrade()).to.be.true;
        });
    });
});
