
import { parseEther } from '@ethersproject/units';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LyraVault, MockOptionMarket, MockStrategy, WETH9 } from '../../../typechain';

describe('Unit test: share calculating for pending deposit and withdraw', async () => {
  // contract instances
  let vault: LyraVault;

  // mocked contracts
  let mockedStrategy: MockStrategy;
  let mockedMarket: MockOptionMarket;
  
  let weth: WETH9

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

    const WETH9Factory = await ethers.getContractFactory("WETH9");
    weth = (await WETH9Factory.deploy()) as WETH9;
  });

  before('setup LyraVault instance, link to a mocked strategy', async() => {
    const LyraVaultFactory = await ethers.getContractFactory('LyraVault');
      
    const cap = parseEther('5000');
    const decimals = 18
    
    vault = (await LyraVaultFactory.deploy(
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

    // set strategy
    await vault.connect(owner).setStrategy(mockedStrategy.address);
  })

  describe('basic deposit and withdraw in round 1.', async() => {
    it('should deposit weth into the contract and update the receipt', async() => {
      const initState = await vault.vaultState();
      const initReceipt = await vault.depositReceipts(depositor.address);
      
      await weth.connect(depositor).deposit({value: depositAmount})
      await weth.connect(depositor).approve(vault.address, ethers.constants.MaxUint256)
      await vault.connect(depositor).deposit(depositAmount)

      const newState = await vault.vaultState();
      const newReceipt = await vault.depositReceipts(depositor.address);

      expect(newState.totalPending.sub(initState.totalPending)).to.be.eq(depositAmount)
      expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount)
      expect(newReceipt.unredeemedShares).to.be.eq(initReceipt.unredeemedShares)
    })
    it('should be able to use depositFor to do the same thing for depositor', async() => {
      const initReceipt = await vault.depositReceipts(depositor.address);
      
      await weth.connect(anyone).deposit({value: depositAmount})
      await weth.connect(anyone).approve(vault.address, ethers.constants.MaxUint256)
      await vault.connect(anyone).depositFor(depositAmount, depositor.address)

      const newReceipt = await vault.depositReceipts(depositor.address);

      expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount)
      expect(newReceipt.unredeemedShares).to.be.eq(initReceipt.unredeemedShares)
    })
    it('should deposit eth into the contract and update the receipt', async() => {
      const initState = await vault.vaultState();
      const initReceipt = await vault.depositReceipts(depositor.address);
      
      await vault.connect(depositor).depositETH({value: depositAmount})

      const newState = await vault.vaultState();
      const newReceipt = await vault.depositReceipts(depositor.address);

      expect(newState.totalPending.sub(initState.totalPending)).to.be.eq(depositAmount)
      expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount)
      expect(newReceipt.unredeemedShares).to.be.eq(initReceipt.unredeemedShares)
    })
    it('should be able to use depositFor to do the same thing for depositor', async() => {
      const initReceipt = await vault.depositReceipts(depositor.address);
      
      await weth.connect(anyone).deposit({value: depositAmount})
      await weth.connect(anyone).approve(vault.address, ethers.constants.MaxUint256)
      await vault.connect(anyone).depositFor(depositAmount, depositor.address)

      const newReceipt = await vault.depositReceipts(depositor.address);

      expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount)
      expect(newReceipt.unredeemedShares).to.be.eq(initReceipt.unredeemedShares)
    })

    it('should revert when using initiateWithdraw becuase user has no shares', async() => {
      const sharesToWithdraw = depositAmount
      await expect(vault.connect(depositor).initiateWithdraw(sharesToWithdraw)).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('should revert when calling competeWithdraw becuase user has no pending withdraw', async() => {
      await expect(vault.connect(depositor).completeWithdraw()).to.be.revertedWith('Not initiated')
    })

    it('should revert when calling redeem becuase depositor has no unreedemed shares', async() => {
      const sharesToWithdraw = depositAmount
      await expect(vault.connect(depositor).redeem(sharesToWithdraw)).to.be.revertedWith('Exceeds available')
    })

    it('should get 0 share out by calling maxRedeem becuase depositor has no unreedemed shares', async() => {
      const sharesBefore = await vault.balanceOf(depositor.address)
      await vault.connect(depositor).maxRedeem()
      const sharesAfter = await vault.balanceOf(depositor.address)
      expect(sharesAfter).to.be.eq(sharesBefore)
    })

    // test share calculations during vault 1.
    it('should return 0 for shares before round ends', async() => {
      const balances = await vault.shareBalances(depositor.address)
      expect(balances.heldByVault).to.be.eq(0)
      expect(balances.heldByAccount).to.be.eq(0)

      const shares = await vault.shares(depositor.address)
      expect(shares).to.be.eq(0)
    })
    it('should return constant for price per share before first share is minted', async() => {
      const oneShare = parseEther('1')
      const price = await vault.pricePerShare()
      expect(price).to.be.eq(oneShare)
    })
    it('shuold return 0 for total balance ', async() => {
      const balance = await vault.accountVaultBalance(depositor.address)
      expect(balance).to.be.eq(0)
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
