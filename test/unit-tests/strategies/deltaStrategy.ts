import { ethers } from 'hardhat';
import { DeltaStrategy } from '../../../typechain';
import { expect } from "chai";

describe('Delta Vault Strategy', async () => {

  describe('deployment', async() => {
    it('deploy strategy', async() => {
      const DeltaStrategy = await ethers.getContractFactory("DeltaStrategy");
      const strategy = await DeltaStrategy.deploy(ethers.constants.AddressZero, ethers.constants.AddressZero) as DeltaStrategy;
  
      expect(await strategy.optionMarketViwer()).to.be.eq(ethers.constants.AddressZero)
      expect(await strategy.blackScholes()).to.be.eq(ethers.constants.AddressZero)
    })
  })
  
  describe('set strategy', async() => {
    it('setting strategy should update isRoundReady and roundStrategy', async() => {})
    it('should revert if setStrategy is not called by owner', async() => {})
  })
})