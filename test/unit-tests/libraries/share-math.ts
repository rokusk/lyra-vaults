import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ShareMathTest } from '../../../typechain';

describe('Unit test: ShareMath Library', async () => {
  let tester: ShareMathTest

  before('deploy tester', async () => {
    const ShareMathTestFactory = await ethers.getContractFactory('ShareMathTest');
    tester = (await ShareMathTestFactory.deploy()) as ShareMathTest
  });

  describe('#assetToShares', async() => {
    it('shoudl revert if share price is 0', async() => {
      await expect(tester.assetToShares(0, 1, 0)).to.be.revertedWith('Invalid assetPerShare')
    })
  })
  describe('#sharesToAsset', async() => {
    it('shoudl revert if share price is 0', async() => {
      await expect(tester.sharesToAsset(0, 1, 0)).to.be.revertedWith('Invalid assetPerShare')
    })
  })
  
  describe('#assertUint104', async() => {
    it('should revert if pass in number > uint104', async() => {
      await expect(tester.assertUint104(ethers.constants.MaxInt256)).to.be.revertedWith('Overflow uint104')
    })
  })

  describe('#assertUint128', async() => {
    it('should revert if pass in number > uint128', async() => {
      await expect(tester.assertUint128(ethers.constants.MaxInt256)).to.be.revertedWith('Overflow uint128')
    })
  })
   
}); 
