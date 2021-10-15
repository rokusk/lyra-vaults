import { ethers } from 'hardhat';
import { DeltaStrategy } from '../../../typechain';
import { expect } from "chai";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants } from 'ethers';
import { encodeDeltaStrategy } from './utils';

describe('Delta Vault Strategy', async () => {

  let manager: SignerWithAddress
  let randomUser: SignerWithAddress

  let strategy: DeltaStrategy

  describe('setup roles', async() => {
    const addresses = await ethers.getSigners()
    manager = addresses[0]
    randomUser = addresses[9]
  })

  describe('deployment', async() => {
    it('deploy strategy', async() => {
      const DeltaStrategy = await ethers.getContractFactory("DeltaStrategy");
      strategy = await DeltaStrategy.deploy(ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero) as DeltaStrategy;
  
      expect(await strategy.vault()).to.be.eq(ethers.constants.AddressZero)
      expect(await strategy.optionMarketViwer()).to.be.eq(ethers.constants.AddressZero)
      expect(await strategy.blackScholes()).to.be.eq(ethers.constants.AddressZero)
    })
  })
  
  describe('setStrategy', async() => {
    it('setting strategy should update isRoundReady and roundStrategy', async() => {
      const strategyBytes = encodeDeltaStrategy(0, 0, 0, 0)
      await strategy.connect(manager).setStrategy(strategyBytes)
      
      const newStrategy = await strategy.currentStrategy()
      expect(newStrategy.minInterval.isZero()).to.be.true
      expect(newStrategy.maxIv.isZero()).to.be.true
      expect(newStrategy.minInterval.isZero()).to.be.true
      expect(newStrategy.size.isZero()).to.be.true
    })
    it('should revert if setStrategy is not called by owner', async() => {
      await expect(strategy.connect(randomUser).setStrategy(constants.AddressZero)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('requestTrade', async() => {
    // todo: update test case
    it('should return correct size, listing id, premium', async() => {
      const { size, minPremium, listingId } = await strategy.requestTrade()
      expect(size.isZero()).to.be.true 
      expect(minPremium.isZero()).to.be.true 
      expect(listingId.isZero()).to.be.true 
    })
  })

  describe('checkPostTrade', async() => {
    // todo: update test case
    it('should return true if ...', async() => {
      expect(await strategy.checkPostTrade()).to.be.true 
    })
  })
})