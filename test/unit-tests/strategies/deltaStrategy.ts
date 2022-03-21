import { constants as lyraConstants, utils as lyraUtils } from '@lyrafinance/core';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DeltaStrategy } from '../../../typechain-types';
import { DeltaStrategyDetailStruct } from '../../../typechain-types/DeltaStrategy';

const defaultDeltaStrategyDetail: DeltaStrategyDetailStruct = {
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  targetDelta: lyraUtils.toBN('0.3'),
  maxDeltaGap: lyraUtils.toBN('0.1'),
  minIv: lyraUtils.toBN('0.5'),
  maxIv: lyraUtils.toBN('0.1'),
  size: lyraUtils.toBN('10'),
  minInterval: lyraConstants.HOUR_SEC,
};

describe('Delta Vault Strategy', async () => {
  let manager: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let strategy: DeltaStrategy;

  before(async () => {
    const addresses = await ethers.getSigners();
    manager = addresses[0];
    randomUser = addresses[9];

    strategy = (await (await ethers.getContractFactory('DeltaStrategy')).connect(manager).deploy(
      ethers.constants.AddressZero, // vault
      '0xCD8a1C3ba11CF5ECfa6267617243239504a98d90', // optionMarket
    )) as DeltaStrategy;
  });

  describe('deployment', async () => {
    it('deploys with correct vault and optionMarket addresses', async () => {
      expect(await strategy.vault()).to.be.eq(ethers.constants.AddressZero);
      expect(await strategy.optionMarket()).to.be.eq('0xCD8a1C3ba11CF5ECfa6267617243239504a98d90');
    });
  });

  describe('setStrategy', async () => {
    it('setting strategy should correctly update strategy variables', async () => {
      await strategy.connect(manager).setStrategy(defaultDeltaStrategyDetail);

      const newStrategy = await strategy.currentStrategy();
      expect(newStrategy.minTimeToExpiry).to.be.eq(defaultDeltaStrategyDetail.minTimeToExpiry);
      expect(newStrategy.maxTimeToExpiry).to.be.eq(defaultDeltaStrategyDetail.maxTimeToExpiry);
      expect(newStrategy.targetDelta).to.be.eq(defaultDeltaStrategyDetail.targetDelta);
      expect(newStrategy.maxDeltaGap).to.be.eq(defaultDeltaStrategyDetail.maxDeltaGap);
      expect(newStrategy.minIv).to.be.eq(defaultDeltaStrategyDetail.minIv);
      expect(newStrategy.maxIv).to.be.eq(defaultDeltaStrategyDetail.maxIv);
      expect(newStrategy.size).to.be.eq(defaultDeltaStrategyDetail.size);
      expect(newStrategy.minInterval).to.be.eq(defaultDeltaStrategyDetail.minInterval);
    });

    it('should revert if setStrategy is not called by owner', async () => {
      await expect(strategy.connect(randomUser).setStrategy(defaultDeltaStrategyDetail)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  // describe('requestTrade', async () => {
  //   it('should return correct size, listing id, premium', async () => {
  //     const boardId = ethers.BigNumber.from('1');
  //     await strategy.connect(randomUser).requestTrade(boardId);
  //     const { listingId, size, minPremium } = await strategy.requestTrade(boardId);
  //     expect(listingId).to.be.eq(ethers.BigNumber.from('9'));
  //     expect(minPremium).to.be.eq(ethers.utils.parseUnits('0', 18));
  //     expect(size).to.be.eq(ethers.utils.parseUnits('1', 18));
  //   });
  //   // todo: test setStrategy allowable times
  // });

  // describe('checkPostTrade', async () => {
  //   // todo: update test case
  //   it('should return true if ...', async () => {
  //     expect(await strategy.checkPostTrade()).to.be.true;
  //   });
  // });
});
