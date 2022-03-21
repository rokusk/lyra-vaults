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
const hardhat_1 = require("hardhat");
const core_1 = require("@lyrafinance/core");
const chai_1 = __importStar(require("chai"));
const ethereum_waffle_1 = require("ethereum-waffle");
chai_1.default.use(ethereum_waffle_1.solidity);
describe('OptionMarket - Exercising', () => {
    let account;
    let account2;
    let accountAddr;
    let account2Addr;
    let testSystem;
    let boardIds;
    let strikeIds;
    let snap;
    before(async () => {
        [account, account2] = await hardhat_1.ethers.getSigners();
        [accountAddr, account2Addr] = await Promise.all([account.getAddress(), account2.getAddress()]);
        let testSystem = await core_1.lyraTestSystem.deploy(account);
        await core_1.lyraTestSystem.seed(account, testSystem);
        snap = await core_1.evm.takeSnapshot();
    });
    beforeEach(async () => {
        snap = await core_1.evm.takeSnapshot();
        boardIds = await testSystem.optionMarket.getLiveBoards();
        strikeIds = await testSystem.optionMarket.getBoardStrikes(boardIds[0]);
    });
    afterEach(async () => {
        await core_1.evm.restoreSnapshot(snap);
    });
    it('will pay out long calls', async () => {
        // One long call
        await testSystem.optionMarket.openPosition({
            strikeId: strikeIds[0],
            positionId: 0,
            amount: core_1.utils.toBN('1'),
            setCollateralTo: 0,
            iterations: 1,
            minTotalCost: 0,
            maxTotalCost: core_1.constants.MAX_UINT,
            optionType: core_1.lyraTestSystem.OptionType.LONG_CALL
        });
        await core_1.evm.fastForward(core_1.constants.MONTH_SEC);
        await testSystem.mockSNX.exchangeRates.mockLatestPrice(core_1.utils.toBN('2000'));
        await testSystem.optionMarket.settleExpiredBoard(boardIds[0]);
        (0, chai_1.expect)(await testSystem.liquidityPool.totalOutstandingSettlements()).to.eq(core_1.utils.toBN('500'));
        const preBalance = await testSystem.mockSNX.quoteAsset.balanceOf(accountAddr);
        await testSystem.shortCollateral.settleOptions([strikeIds[0]]);
        const postBalance = await testSystem.mockSNX.quoteAsset.balanceOf(accountAddr);
        (0, chai_1.expect)(postBalance.sub(preBalance)).to.eq(core_1.utils.toBN('500'));
    });
});
