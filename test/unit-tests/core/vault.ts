import { parseEther, parseUnits } from '@ethersproject/units';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { LyraVault, MockERC20, MockOptionMarket, MockStrategy, MockSynthetix } from '../../../typechain';
import { FEE_MULTIPLIER } from '../utils/constants';
import { toBytes32 } from '../utils/synthetixUtils';

describe('Unit test: Basic LyraVault flow', async () => {
  // contract instances
  let vault: LyraVault;

  // mocked contracts
  let mockedStrategy: MockStrategy;
  let mockedMarket: MockOptionMarket;
  let mockedSynthetix: MockSynthetix;

  let seth: MockERC20;
  let susd: MockERC20;

  // signers
  let anyone: SignerWithAddress;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  // fix deposit amount at 1 eth
  const depositAmount = parseEther('1');

  const performanceFee = 2 * FEE_MULTIPLIER; // 2% fee
  const managementFee = 1 * FEE_MULTIPLIER; // 1% fee
  const initCap = parseEther('50');

  // mocked key for synthetix
  const susdKey = toBytes32('sUSD');
  const sethKey = toBytes32('sETH');

  let totalDeposit: BigNumber;

  // mocked premium in USD and ETH
  const roundPremiumSUSD = parseUnits('50');
  const roundPremiumInEth = parseEther('0.01');

  before('prepare signers', async () => {
    const addresses = await ethers.getSigners();
    owner = addresses[0];
    anyone = addresses[1];
    depositor = addresses[2];
    feeRecipient = addresses[3];
  });

  before('prepare mocked contracts', async () => {
    const MockOptionMarketFactory = await ethers.getContractFactory('MockOptionMarket');
    mockedMarket = (await MockOptionMarketFactory.deploy()) as MockOptionMarket;

    const MockStrategyFactory = await ethers.getContractFactory('MockStrategy');
    mockedStrategy = (await MockStrategyFactory.deploy()) as MockStrategy;

    const MockSynthetixFactory = await ethers.getContractFactory('MockSynthetix');
    mockedSynthetix = (await MockSynthetixFactory.deploy()) as MockSynthetix;

    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    susd = (await MockERC20Factory.deploy('Synth USD', 'sUSD', 18)) as MockERC20;
    seth = (await MockERC20Factory.deploy('Synth ETH', 'sUSD', 18)) as MockERC20;
  });

  before('mint asset for option market and synthetix', async () => {
    await susd.mint(mockedMarket.address, parseUnits('100000'));

    await seth.connect(anyone).mint(mockedSynthetix.address, parseEther('100'));
  });

  before('setup mocked synthetix', async () => {
    await mockedSynthetix.setMockedKeyToAddress(susdKey, susd.address);
    await mockedSynthetix.setMockedKeyToAddress(sethKey, seth.address);
  });

  describe('deploy', async () => {
    it('should successfully deploy and set immutable addresses', async () => {
      const LyraVault = await ethers.getContractFactory('LyraVault');

      const cap = ethers.utils.parseEther('5000');
      const decimals = 18;

      vault = (await LyraVault.deploy(
        mockedMarket.address,
        susd.address,
        owner.address, // feeRecipient,
        mockedSynthetix.address,
        86400 * 7,
        'LyraVault Share',
        'Lyra VS',
        {
          decimals,
          cap,
          asset: seth.address,
        },
        susdKey,
        sethKey,
      )) as LyraVault;
      const params = await vault.vaultParams();
      expect(params.asset).to.be.eq(seth.address);

      expect(params.decimals).to.be.eq(decimals);
      expect(await vault.optionMarket()).to.be.eq(mockedMarket.address);

      // view functions
      expect(await vault.decimals()).to.be.eq(decimals);
    });
  });

  describe('owner settings', async () => {
    it('shoud revert when setting cap as 0', async () => {
      await expect(vault.connect(owner).setCap(0)).to.be.revertedWith('IC');
    });
    it('owner should be able to set a new cap', async () => {
      await vault.connect(owner).setCap(initCap);

      const params = await vault.vaultParams();
      expect(params.cap).to.be.eq(initCap);
    });
    it('owner should be able to set a new management fee', async () => {
      await vault.connect(owner).setManagementFee(managementFee);

      const fee = await vault.managementFee();
      const weeklyFee = BigNumber.from(managementFee).mul(7).div(365);
      expect(weeklyFee).to.be.eq(fee);
    });
    it("should revert when trying to set a mangement fee that's too high", async () => {
      await expect(vault.connect(owner).setManagementFee(100 * FEE_MULTIPLIER)).to.be.revertedWith('IM');
    });
    it('owner should be able to set a new performance fee', async () => {
      await vault.connect(owner).setPerformanceFee(performanceFee);

      const fee = await vault.performanceFee();
      expect(fee).to.be.eq(performanceFee);
    });
    it("should revert when trying to set a performance fee that's too high", async () => {
      await expect(vault.connect(owner).setPerformanceFee(100 * FEE_MULTIPLIER)).to.be.revertedWith('IP');
    });
    it('should revert when trying to set a invalid feeRecipient high', async () => {
      await expect(vault.connect(owner).setFeeRecipient(ethers.constants.AddressZero)).to.be.revertedWith('IA');
    });
    it('owner should be able to set a new fee recipient address', async () => {
      await vault.connect(owner).setFeeRecipient(feeRecipient.address);
      const recipient = await vault.feeRecipient();
      expect(recipient).to.be.eq(feeRecipient.address);
    });
    it('should revert if trying to set the same feeRecipient as the existing one', async () => {
      await expect(vault.connect(owner).setFeeRecipient(feeRecipient.address)).to.be.revertedWith('SF');
    });
  });

  describe('set strategy', async () => {
    it('should revert if called by non-owner', async () => {
      await expect(vault.connect(anyone).setStrategy(ethers.constants.AddressZero)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('should be able to set strategy', async () => {
      // deploy a new mocked strategy
      await vault.connect(owner).setStrategy(mockedStrategy.address);
      expect(await vault.strategy()).to.be.eq(mockedStrategy.address);
    });
  });

  describe('basic deposit', async () => {
    it('should revert if trying to deposit 0', async () => {
      await expect(vault.connect(anyone).deposit(0)).to.be.revertedWith('!A');
    });
    it('should revert if trying to use depositFor with amount = 0', async () => {
      await expect(vault.connect(anyone).depositFor(0, depositor.address)).to.be.revertedWith('!A');
    });
    it('should revert if trying to deposit to a 0 address', async () => {
      await expect(vault.connect(anyone).depositFor(1, ethers.constants.AddressZero)).to.be.revertedWith('!C');
    });
    it('should deposit ewth into the contract', async () => {
      const initReceipt = await vault.depositReceipts(depositor.address);

      await seth.mint(depositor.address, depositAmount);
      await seth.connect(depositor).approve(vault.address, ethers.constants.MaxUint256);
      await vault.connect(depositor).deposit(depositAmount);

      const newReceipt = await vault.depositReceipts(depositor.address);

      expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount);
      expect(newReceipt.unredeemedShares.sub(initReceipt.unredeemedShares)).to.be.eq(0);
    });
    it('should revert if deposit amount exceed the cap', async () => {
      const depositAmount = initCap.add(1);
      await seth.mint(depositor.address, depositAmount);
      await seth.connect(depositor).approve(vault.address, ethers.constants.MaxUint256);
      await expect(vault.connect(depositor).deposit(depositAmount)).to.be.revertedWith('EC');
    });
  });

  describe('trade before first round end', async () => {
    it('should revert because the first round is not started yet', async () => {
      // set mocked asset only
      await mockedMarket.setMockCollateral(seth.address, parseEther('1'));
      await mockedMarket.setMockPremium(susd.address, 0);

      await expect(vault.trade()).to.be.revertedWith('round closed');
    });
  });

  describe('start the second round', async () => {
    it('should be able to close the previous round', async () => {
      totalDeposit = await seth.balanceOf(vault.address);
      await vault.connect(owner).closeRound();
    });
    it('should be able to rollover the position', async () => {
      await ethers.provider.send('evm_increaseTime', [86400]);
      await ethers.provider.send('evm_mine', []);

      const roundBefore = await vault.vaultState();
      await vault.connect(owner).startNextRound();
      const roundAfter = await vault.vaultState();
      expect(roundBefore.round).to.be.eq(1);
      expect(roundAfter.round).to.be.eq(2);
    });
  });

  describe('trade flow tests', async () => {
    const size = parseUnits('1');
    const collateralAmount = parseUnits('1');

    it('should revert if premium get from market is lower than strategy estimation', async () => {
      // set request and check result
      await mockedStrategy.setMockedTradeRequest(0, size, roundPremiumSUSD.add(1));

      await mockedMarket.setMockCollateral(seth.address, collateralAmount);
      await mockedMarket.setMockPremium(susd.address, roundPremiumSUSD);

      await expect(vault.trade()).to.be.revertedWith('premium too low');
    });

    it('should revert if post trade check return false', async () => {
      await mockedStrategy.setMockedTradeRequest(0, size, roundPremiumSUSD);
      await mockedStrategy.setMockedPostCheck(false);
      await expect(vault.trade()).to.be.revertedWith('bad trade');
    });

    it('should successfully trade with returned amount', async () => {
      // set request and check result
      await mockedStrategy.setMockedTradeRequest(0, size, roundPremiumSUSD);
      await mockedStrategy.setMockedPostCheck(true);

      await mockedMarket.setMockCollateral(seth.address, collateralAmount);
      await mockedMarket.setMockPremium(susd.address, roundPremiumSUSD);

      // set synthetix exchange result
      await mockedSynthetix.setMockedTradeAmount(seth.address, roundPremiumInEth);

      const sethBefore = await seth.balanceOf(vault.address);
      await vault.trade();
      const sethAfter = await seth.balanceOf(vault.address);
      expect(sethBefore.sub(collateralAmount).add(roundPremiumInEth)).to.be.eq(sethAfter);
    });
  });

  describe('settle trade', async () => {
    const settlementPayout = parseEther('1');
    before('set mock settle data', async () => {
      await mockedMarket.setMockSettlement(settlementPayout);

      // mint seth to mock mark
      await seth.connect(anyone).mint(mockedMarket.address, settlementPayout);
    });
    it('should settle a specific listing and get back collateral (seth)', async () => {
      const vaultBalanceBefore = await seth.balanceOf(vault.address);
      const listingId = 0;
      await vault.settle([listingId]);
      const vaultBalanceAfter = await seth.balanceOf(vault.address);
      expect(vaultBalanceAfter.sub(vaultBalanceBefore)).to.be.eq(settlementPayout);
    });
  });

  describe('rollover', async () => {
    before('simulate time pass', async () => {
      await ethers.provider.send('evm_increaseTime', [86400 * 7]);
      await ethers.provider.send('evm_mine', []);
    });

    it('should revert if trying to start the next round without closing the round', async () => {
      await expect(vault.startNextRound()).to.be.revertedWith('round opened');
    });

    it('should close the current round', async () => {
      await vault.closeRound();
    });

    it('should revert if trying to trade right now', async () => {
      await expect(vault.trade()).to.be.revertedWith('round closed');
    });

    it('should revert if trying to start the next round within 24 hours from close', async () => {
      await expect(vault.startNextRound()).to.be.revertedWith('CD');
    });

    it('should roll into the next round and pay the fee recpient fees', async () => {
      await ethers.provider.send('evm_increaseTime', [86400]);
      await ethers.provider.send('evm_mine', []);

      const vaultStateBefore = await vault.vaultState();
      const recipientBalanceBefore = await seth.balanceOf(feeRecipient.address);

      await vault.startNextRound();

      const vaultStateAfter = await vault.vaultState();

      expect(vaultStateBefore.round + 1).to.be.eq(vaultStateAfter.round);

      const roundPerformanceFee = roundPremiumInEth.mul(performanceFee).div(100 * FEE_MULTIPLIER);

      const weeklyManagementFee = await vault.managementFee();
      const roundManagementFee = totalDeposit
        .add(roundPremiumInEth)
        .mul(weeklyManagementFee)
        .div(100 * FEE_MULTIPLIER);

      const recipientBalanceAfter = await seth.balanceOf(feeRecipient.address);
      expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.be.eq(roundManagementFee.add(roundPerformanceFee));
    });
  });
});
