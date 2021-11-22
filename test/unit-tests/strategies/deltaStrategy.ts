import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { DeltaStrategy } from '../../../typechain';
import { encodeDeltaStrategy } from './utils';

const HOUR_SEC = 60 * 60;
const DAY_SEC = 24 * HOUR_SEC;
const WEEK_SEC = 7 * DAY_SEC;
const MONTH_SEC = 28 * DAY_SEC;
const YEAR_SEC = 365 * DAY_SEC;

describe('Delta Vault Strategy', async () => {
  let manager: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let strategy: DeltaStrategy;

  const minTimeToExpiry = ethers.BigNumber.from(DAY_SEC * 4);
  const maxTimeToExpiry = ethers.BigNumber.from(DAY_SEC * 10);
  const targetDelta = ethers.utils.parseUnits('0.25', 18);
  const maxDeltaGap = ethers.utils.parseUnits('0.1', 18); // min delta=0.15 and max delta=0.35
  const minIv = ethers.utils.parseUnits('0.5', 18); // minIV=50%
  const maxIv = ethers.utils.parseUnits('1.5', 18); // maxIV=150%
  const size = ethers.utils.parseUnits('1', 18); // 1 STANDARD SIZE PER TRADE
  const minInterval = ethers.BigNumber.from(HOUR_SEC);

  describe('setup roles', async () => {
    const addresses = await ethers.getSigners();
    manager = addresses[0];
    randomUser = addresses[9];
  });

  describe('deployment', async () => {
    it('deploy strategy', async () => {
      const DeltaStrategy = await ethers.getContractFactory('DeltaStrategy');
      strategy = (await DeltaStrategy.connect(manager).deploy(
        ethers.constants.AddressZero, // vault
        '0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154', // blackScholes
        '0xCD8a1C3ba11CF5ECfa6267617243239504a98d90', // optionMarket
        '0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3', // greekCache
      )) as DeltaStrategy;

      expect(await strategy.vault()).to.be.eq(ethers.constants.AddressZero);
      expect(await strategy.blackScholes()).to.be.eq('0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154');
      expect(await strategy.optionMarket()).to.be.eq('0xCD8a1C3ba11CF5ECfa6267617243239504a98d90');
      expect(await strategy.greekCache()).to.be.eq('0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3');
    });
  });

  describe('setStrategy', async () => {
    it('setting strategy should correctly update strategy variables', async () => {
      const strategyBytes = encodeDeltaStrategy(
        minTimeToExpiry,
        maxTimeToExpiry,
        targetDelta,
        maxDeltaGap,
        minIv,
        maxIv,
        size,
        minInterval,
      );
      await strategy.connect(manager).setStrategy(strategyBytes);

      const newStrategy = await strategy.currentStrategy();
      expect(newStrategy.minTimeToExpiry).to.be.eq(ethers.BigNumber.from(DAY_SEC * 4));
      expect(newStrategy.maxTimeToExpiry).to.be.eq(ethers.BigNumber.from(DAY_SEC * 10));
      expect(newStrategy.targetDelta).to.be.eq(ethers.utils.parseUnits('0.25', 18));
      expect(newStrategy.maxDeltaGap).to.be.eq(ethers.utils.parseUnits('0.1', 18));
      expect(newStrategy.minIv).to.be.eq(ethers.utils.parseUnits('0.5', 18));
      expect(newStrategy.maxIv).to.be.eq(ethers.utils.parseUnits('1.5', 18));
      expect(newStrategy.size).to.be.eq(ethers.utils.parseUnits('1', 18));
      expect(newStrategy.minInterval).to.be.eq(ethers.BigNumber.from(HOUR_SEC));
    });

    it('should revert if setStrategy is not called by owner', async () => {
      await expect(strategy.connect(randomUser).setStrategy(constants.AddressZero)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('requestTrade', async () => {
    it('should return correct size, listing id, premium', async () => {
      const boardId = ethers.BigNumber.from('1');
      await strategy.connect(randomUser).requestTrade(boardId);
      const { listingId, size, minPremium } = await strategy.requestTrade(boardId);
      expect(listingId).to.be.eq(ethers.BigNumber.from('9'));
      expect(minPremium).to.be.eq(ethers.utils.parseUnits('0', 18));
      expect(size).to.be.eq(ethers.utils.parseUnits('1', 18));
    });
    // todo: test setStrategy allowable times
  });

  describe('checkPostTrade', async () => {
    // todo: update test case
    it('should return true if ...', async () => {
      expect(await strategy.checkPostTrade()).to.be.true;
    });
  });
});
