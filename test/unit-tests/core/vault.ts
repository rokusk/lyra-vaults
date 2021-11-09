import { parseEther, parseUnits } from '@ethersproject/units';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LyraVault, MockOptionMarket, MockStrategy, MockERC20, WETH9 } from '../../../typechain';

describe('Unit test: Basic LyraVault flow', async () => {
  // contract instances
  let vault: LyraVault;

  // mocked contracts
  let mockedStrategy: MockStrategy;
  let mockedMarket: MockOptionMarket;
  
  let weth: WETH9
  let susd: MockERC20

  // signers
  let anyone: SignerWithAddress;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress

  // fix deposit amount at 1 eth
  const depositAmount = parseEther('1')

  before('prepare signers', async () => {
    const addresses = await ethers.getSigners();
    owner = addresses[0];
    anyone = addresses[1];
    depositor = addresses[2]
  });

  before('prepare mocked contracts', async () => {
    const MockOptionMarketFactory = await ethers.getContractFactory('MockOptionMarket');
    mockedMarket = (await MockOptionMarketFactory.deploy()) as MockOptionMarket;

    const MockStrategyFactory = await ethers.getContractFactory('MockStrategy');
    mockedStrategy = (await MockStrategyFactory.deploy()) as MockStrategy;

    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    susd = (await MockERC20Factory.deploy('Synth USD', 'sUSD', 18)) as MockERC20;

    const WETH9Factory = await ethers.getContractFactory("WETH9");
    weth = (await WETH9Factory.deploy()) as WETH9;
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

      // view functions
      expect(await vault.decimals()).to.be.eq(decimals);
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

  describe('basic deposit', async() => {
    it('should deposit eth into the contract', async() => {
      
      const initReceipt = await vault.depositReceipts(depositor.address);
      
      await vault.connect(depositor).depositETH({value: depositAmount})

      const newReceipt = await vault.depositReceipts(depositor.address);
      const balances = await vault.shareBalances(depositor.address)

      expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount)
      expect(newReceipt.unredeemedShares.sub(initReceipt.unredeemedShares)).to.be.eq(0)

      expect(balances.heldByAccount).to.be.eq(0)
      // share are not minted yet, so heldByVault is also 0
      expect(balances.heldByVault).to.be.eq(0)
    })
  })

  describe('trade flow tests', async () => {
    const size = parseUnits('1')
    const collateralAmount = parseUnits('1')

    // mock premium to 50 USD
    const minPremium = parseUnits('50')

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

  describe('settle trade', async() => {
    const settlementPayout = parseEther('1')
    before('set mock settle data', async() => {
      await mockedMarket.setMockSettlement(settlementPayout)

      // send weth to mock mark
      await weth.connect(anyone).deposit({value: settlementPayout})
      await weth.connect(anyone).transfer(mockedMarket.address, settlementPayout)
    })
    it('should settle a specific listing and get back collateral (weth)', async() => {
      const vaultBalanceBefore = await weth.balanceOf(vault.address)
      const listingId = 0
      await vault.settle(listingId)
      const vaultBalanceAfter = await weth.balanceOf(vault.address)
      expect(vaultBalanceAfter.sub(vaultBalanceBefore)).to.be.eq(settlementPayout)
    })
  })

  describe('rollover', async() => {
    it('should revert if a round is not passed', async() => {
      //todo: add restriction on rollover
    })
    before('simulate time pass', async() => {
      await ethers.provider.send("evm_increaseTime", [86400*7])
      await ethers.provider.send("evm_mine", [])
    })
    it('should rollover the vault to the next round', async() => {
      const vaultStateBefore = await vault.vaultState()
      
      await vault.rollToNextRound()

      const vaultStateAfter = await vault.vaultState()

      expect(vaultStateBefore.round + 1).to.be.eq(vaultStateAfter.round)
    })
  })
}); 
