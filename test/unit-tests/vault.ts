import { parseUnits } from '@ethersproject/units';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LyraVault, MockOptionMarket, MockStrategy, MockERC20 } from '../../typechain';

describe('Vault', async () => {
  // contract instances
  let vault: LyraVault;

  // mocked contracts
  let mockedStrategy: MockStrategy;
  let mockedMarket: MockOptionMarket;
  
  let weth: MockERC20
  let susd: MockERC20

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

    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    weth = (await MockERC20Factory.deploy('Wrapped ETH', 'WETH', 18)) as MockERC20;
    susd = (await MockERC20Factory.deploy('Synth USD', 'sUSD', 18)) as MockERC20;
  });

  describe('deploy', async () => {
    it('should successfully deploy and set immutable addresses', async () => {
      const LyraVault = await ethers.getContractFactory('LyraVault');
      
      const cap = ethers.utils.parseEther('5000');
      const decimals = 18
      
      vault = (await LyraVault.deploy(
        mockedMarket.address,
        weth.address,
        owner.address, // feeRecipient,
        0, // management fee
        0, // performanceFee
        "LyraVault Share",
        "Lyra VS",
        {
          decimals,
          cap,
          asset: weth.address
        }
      )) as LyraVault;
      const params = await vault.vaultParams();
      expect(params.asset).to.be.eq(weth.address);
      expect(params.cap).to.be.eq(cap);
      expect(params.decimals).to.be.eq(decimals);
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

  describe('trade flow tests', async () => {
    const size = parseUnits('1')
    const collateralAmount = parseUnits('1')

    // mock premium to 50 USD
    const minPremium = parseUnits('50')

    before('mint weth for vault', async() => {
      //todo: change this to deposit
      await weth.mint(vault.address, parseUnits('50'))
    });
    before('mint asset for option market', async() => {
      await susd.mint(mockedMarket.address, parseUnits('100000'))
    })

    it('should revert if premium get from market is lower than strategy estimation', async() => {
      // set request and check result
      await mockedStrategy.setMockedTradeRequest(0, size, minPremium.add(1))

      await mockedMarket.setMockCollateral(weth.address, collateralAmount)
      await mockedMarket.setMockPremium(susd.address, minPremium)

      await expect(vault.trade()).to.be.revertedWith('premium too low')
    })

    it('should revert if post trade check return false', async() => {
      await mockedStrategy.setMockedTradeRequest(0, size, minPremium)
      await mockedStrategy.setMockedPostCheck(false)
      await expect(vault.trade()).to.be.revertedWith('bad trade')
    })

    it('should successfully trade with returned amount', async() => {
      // set request and check result
      await mockedStrategy.setMockedTradeRequest(0, size, minPremium)
      await mockedStrategy.setMockedPostCheck(true)

      await mockedMarket.setMockCollateral(weth.address, collateralAmount)
      await mockedMarket.setMockPremium(susd.address, minPremium)

      const wethBefore = await weth.balanceOf(vault.address)
      await vault.trade()  
      const wethAfter = await weth.balanceOf(vault.address)

      expect(wethBefore.sub(wethAfter).eq(collateralAmount)).to.be.true
    })

  });
});
