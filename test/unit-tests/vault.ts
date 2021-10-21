import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LyraVault, MockOptionMarket, MockStrategy } from '../../typechain';

describe('Vault', async () => {
  // contract instances
  let vault: LyraVault;

  // mocked contracts
  let mockedStrategy: MockStrategy;
  let mockedMarket: MockOptionMarket;

  // signers
  let random: SignerWithAddress;
  let owner: SignerWithAddress;

  before('prepare signers', async () => {
    const addresses = await ethers.getSigners();
    owner = addresses[0];
    random = addresses[1];
  });

  before('prepare mocked contracts', async () => {
    const MockOptionMarketFactory = await ethers.getContractFactory('MockOptionMarket');
    mockedMarket = (await MockOptionMarketFactory.deploy()) as MockOptionMarket;

    const MockStrategyFactory = await ethers.getContractFactory('MockStrategy');
    mockedStrategy = (await MockStrategyFactory.deploy()) as MockStrategy;
  });

  describe('deploy', async () => {
    it('should successfully deploy and set immutable addresses', async () => {
      const LyraVault = await ethers.getContractFactory('LyraVault');
      vault = (await LyraVault.deploy(mockedMarket.address)) as LyraVault;
      expect(await vault.optionMarket()).to.be.eq(mockedMarket.address);
    });
  });

  describe('set strategy', async () => {
    it('should revert if called by non-owner', async () => {
      await expect(vault.connect(random).setStrategy(ethers.constants.AddressZero)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('should be able to set strategy', async () => {
      // deploy a new mocked strategy
      await vault.connect(owner).setStrategy(mockedStrategy.address);
      expect(await vault.strategy()).to.be.eq(mockedStrategy.address);
    });
  });

  describe('trade', async () => {
    before('');
  });
});
