"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const units_1 = require("@ethersproject/units");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const constants_1 = require("../utils/constants");
const synthetixUtils_1 = require("../utils/synthetixUtils");
describe('Unit test: Basic LyraVault flow', async () => {
    // contract instances
    let vault;
    // mocked contracts
    let mockedStrategy;
    let mockedMarket;
    let mockedSynthetix;
    let seth;
    let susd;
    // signers
    let anyone;
    let owner;
    let depositor;
    let feeRecipient;
    // fix deposit amount at 1 eth
    const depositAmount = (0, units_1.parseEther)('1');
    const performanceFee = 2 * constants_1.FEE_MULTIPLIER; // 2% fee
    const managementFee = 1 * constants_1.FEE_MULTIPLIER; // 1% fee
    const initCap = (0, units_1.parseEther)('50');
    // mocked key for synthetix
    const susdKey = (0, synthetixUtils_1.toBytes32)('sUSD');
    const sethKey = (0, synthetixUtils_1.toBytes32)('sETH');
    before('prepare signers', async () => {
        const addresses = await hardhat_1.ethers.getSigners();
        owner = addresses[0];
        anyone = addresses[1];
        depositor = addresses[2];
        feeRecipient = addresses[3];
    });
    before('prepare mocked contracts', async () => {
        const MockOptionMarketFactory = await hardhat_1.ethers.getContractFactory('MockOptionMarket');
        mockedMarket = (await MockOptionMarketFactory.deploy());
        const MockStrategyFactory = await hardhat_1.ethers.getContractFactory('MockStrategy');
        mockedStrategy = (await MockStrategyFactory.deploy());
        const MockSynthetixFactory = await hardhat_1.ethers.getContractFactory('MockSynthetix');
        mockedSynthetix = (await MockSynthetixFactory.deploy());
        const MockERC20Factory = await hardhat_1.ethers.getContractFactory('MockERC20');
        susd = (await MockERC20Factory.deploy('Synth USD', 'sUSD', 18));
        seth = (await MockERC20Factory.deploy('Synth ETH', 'sUSD', 18));
    });
    before('mint asset for option market and synthetix', async () => {
        await susd.mint(mockedMarket.address, (0, units_1.parseUnits)('100000'));
        await seth.connect(anyone).mint(mockedSynthetix.address, (0, units_1.parseEther)('100'));
    });
    before('setup mocked synthetix', async () => {
        await mockedSynthetix.setMockedKeyToAddress(susdKey, susd.address);
        await mockedSynthetix.setMockedKeyToAddress(sethKey, seth.address);
    });
    describe('deploy', async () => {
        it('should successfully deploy and set immutable addresses', async () => {
            const LyraVault = await hardhat_1.ethers.getContractFactory('LyraVault');
            const cap = hardhat_1.ethers.utils.parseEther('5000');
            const decimals = 18;
            vault = (await LyraVault.deploy(mockedMarket.address, susd.address, owner.address, // feeRecipient,
            mockedSynthetix.address, 'LyraVault Share', 'Lyra VS', {
                decimals,
                cap,
                asset: seth.address,
            }, susdKey, sethKey));
            const params = await vault.vaultParams();
            (0, chai_1.expect)(params.asset).to.be.eq(seth.address);
            (0, chai_1.expect)(params.decimals).to.be.eq(decimals);
            (0, chai_1.expect)(await vault.optionMarket()).to.be.eq(mockedMarket.address);
            // view functions
            (0, chai_1.expect)(await vault.decimals()).to.be.eq(decimals);
        });
    });
    describe('owner settings', async () => {
        it('owner should be able to set a new cap', async () => {
            await vault.connect(owner).setCap(initCap);
            const params = await vault.vaultParams();
            (0, chai_1.expect)(params.cap).to.be.eq(initCap);
        });
        it('owner should be able to set a new management fee', async () => {
            await vault.connect(owner).setManagementFee(managementFee);
            const fee = await vault.managementFee();
            const weeklyFee = ethers_1.BigNumber.from(managementFee).mul(constants_1.FEE_MULTIPLIER).div(constants_1.WEEKS_PER_YEAR);
            (0, chai_1.expect)(weeklyFee).to.be.eq(fee);
        });
        it("should revert when trying to set a mangement fee that's too high", async () => {
            await (0, chai_1.expect)(vault.connect(owner).setManagementFee(100 * constants_1.FEE_MULTIPLIER)).to.be.revertedWith('Invalid management fee');
        });
        it('owner should be able to set a new performance fee', async () => {
            await vault.connect(owner).setPerformanceFee(performanceFee);
            const fee = await vault.performanceFee();
            (0, chai_1.expect)(fee).to.be.eq(performanceFee);
        });
        it("should revert when trying to set a performance fee that's too high", async () => {
            await (0, chai_1.expect)(vault.connect(owner).setPerformanceFee(100 * constants_1.FEE_MULTIPLIER)).to.be.revertedWith('Invalid performance fee');
        });
        it('owner should be able to set a new fee recipient address', async () => {
            await vault.connect(owner).setFeeRecipient(feeRecipient.address);
            const recipient = await vault.feeRecipient();
            (0, chai_1.expect)(recipient).to.be.eq(feeRecipient.address);
        });
    });
    describe('set strategy', async () => {
        it('should revert if called by non-owner', async () => {
            await (0, chai_1.expect)(vault.connect(anyone).setStrategy(hardhat_1.ethers.constants.AddressZero)).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('should be able to set strategy', async () => {
            // deploy a new mocked strategy
            await vault.connect(owner).setStrategy(mockedStrategy.address);
            (0, chai_1.expect)(await vault.strategy()).to.be.eq(mockedStrategy.address);
        });
    });
    describe('basic deposit', async () => {
        it('should deposit ewth into the contract', async () => {
            const initReceipt = await vault.depositReceipts(depositor.address);
            await seth.mint(depositor.address, depositAmount);
            await seth.connect(depositor).approve(vault.address, hardhat_1.ethers.constants.MaxUint256);
            await vault.connect(depositor).deposit(depositAmount);
            const newReceipt = await vault.depositReceipts(depositor.address);
            (0, chai_1.expect)(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount);
            (0, chai_1.expect)(newReceipt.unredeemedShares.sub(initReceipt.unredeemedShares)).to.be.eq(0);
        });
    });
    describe('trade before first round end', async () => {
        it('should revert because the first round is not started yet', async () => {
            // set mocked asset only
            await mockedMarket.setMockCollateral(seth.address, (0, units_1.parseEther)('1'));
            await mockedMarket.setMockPremium(susd.address, 0);
            await (0, chai_1.expect)(vault.trade()).to.be.revertedWith('SafeMath: subtraction overflow');
        });
    });
    describe('start the second round', async () => {
        it('should be able to close the previous round', async () => {
            await vault.connect(owner).closeRound();
        });
        it('should be able to rollover the position', async () => {
            const roundBefore = await vault.vaultState();
            await vault.connect(owner).rollToNextRound();
            const roundAfter = await vault.vaultState();
            (0, chai_1.expect)(roundBefore.round).to.be.eq(1);
            (0, chai_1.expect)(roundAfter.round).to.be.eq(2);
        });
    });
    describe('trade flow tests', async () => {
        const size = (0, units_1.parseUnits)('1');
        const collateralAmount = (0, units_1.parseUnits)('1');
        // mock premium to 50 USD
        const minPremium = (0, units_1.parseUnits)('50');
        const premiumInSeth = (0, units_1.parseEther)('0.01');
        it('should revert if premium get from market is lower than strategy estimation', async () => {
            // set request and check result
            await mockedStrategy.setMockedTradeRequest(0, size, minPremium.add(1));
            await mockedMarket.setMockCollateral(seth.address, collateralAmount);
            await mockedMarket.setMockPremium(susd.address, minPremium);
            await (0, chai_1.expect)(vault.trade()).to.be.revertedWith('premium too low');
        });
        it('should revert if post trade check return false', async () => {
            await mockedStrategy.setMockedTradeRequest(0, size, minPremium);
            await mockedStrategy.setMockedPostCheck(false);
            await (0, chai_1.expect)(vault.trade()).to.be.revertedWith('bad trade');
        });
        it('should successfully trade with returned amount', async () => {
            // set request and check result
            await mockedStrategy.setMockedTradeRequest(0, size, minPremium);
            await mockedStrategy.setMockedPostCheck(true);
            await mockedMarket.setMockCollateral(seth.address, collateralAmount);
            await mockedMarket.setMockPremium(susd.address, minPremium);
            // set synthetix exchange result
            await mockedSynthetix.setMockedTradeAmount(seth.address, premiumInSeth);
            const sethBefore = await seth.balanceOf(vault.address);
            await vault.trade();
            const sethAfter = await seth.balanceOf(vault.address);
            (0, chai_1.expect)(sethBefore.sub(collateralAmount).add(premiumInSeth)).to.be.eq(sethAfter);
        });
    });
    describe('settle trade', async () => {
        const settlementPayout = (0, units_1.parseEther)('1');
        before('set mock settle data', async () => {
            await mockedMarket.setMockSettlement(settlementPayout);
            // mint seth to mock mark
            await seth.connect(anyone).mint(mockedMarket.address, settlementPayout);
        });
        it('should settle a specific listing and get back collateral (seth)', async () => {
            const vaultBalanceBefore = await seth.balanceOf(vault.address);
            const listingId = 0;
            await vault.settle(listingId);
            const vaultBalanceAfter = await seth.balanceOf(vault.address);
            (0, chai_1.expect)(vaultBalanceAfter.sub(vaultBalanceBefore)).to.be.eq(settlementPayout);
        });
    });
    describe('rollover', async () => {
        before('simulate time pass', async () => {
            await hardhat_1.ethers.provider.send('evm_increaseTime', [86400 * 7]);
            await hardhat_1.ethers.provider.send('evm_mine', []);
        });
        it('should rollover the vault to the next round', async () => {
            const vaultStateBefore = await vault.vaultState();
            await vault.rollToNextRound();
            const vaultStateAfter = await vault.vaultState();
            (0, chai_1.expect)(vaultStateBefore.round + 1).to.be.eq(vaultStateAfter.round);
        });
    });
});
