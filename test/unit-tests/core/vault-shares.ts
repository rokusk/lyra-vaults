
import { BigNumber } from '@ethersproject/bignumber';
import { parseEther, parseUnits } from '@ethersproject/units';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LyraVault, MockERC20, MockOptionMarket, MockStrategy, MockSynthetix } from '../../../typechain';
import { toBytes32 } from '../utils/synthetixUtils';

describe('Unit test: share calculating for pending deposit and withdraw', async () => {
  // contract instances
  let vault: LyraVault;

  // mocked contracts
  let mockedStrategy: MockStrategy;
  let mockedMarket: MockOptionMarket;
  let mockedSynthetix: MockSynthetix
  
  let seth: MockERC20
  let susd: MockERC20

  // signers
  let anyone: SignerWithAddress;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress

  // fix deposit amount at 1 eth
  const depositAmount = parseEther('1')


  // mocked key for synthetix
  const susdKey = toBytes32('sUSD');
  const sethKey = toBytes32('wETH');

  // constants across tests

  // initiate withdraw 1/4 of total shares
  const initiateWithdrawSharePercentage = 0.25
  const round3PremiumInEth = parseEther('0.1')

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

    const MockSynthetixFactory = await ethers.getContractFactory('MockSynthetix');
    mockedSynthetix = (await MockSynthetixFactory.deploy()) as MockSynthetix;

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    seth = (await MockERC20Factory.deploy('Synth ETH', 'sETH', 18)) as MockERC20;
    susd = (await MockERC20Factory.deploy('Synth USD', 'sUSD', 18)) as MockERC20;
  });

  before('setup LyraVault instance, link to a mocked strategy', async() => {
    const LyraVaultFactory = await ethers.getContractFactory('LyraVault');
      
    const cap = parseEther('5000');
    const decimals = 18
    
    vault = (await LyraVaultFactory.deploy(
      mockedMarket.address,
      susd.address,
      owner.address, // feeRecipient,
      mockedSynthetix.address,
      "LyraVault Share",
      "Lyra VS",
      {
        decimals,
        cap,
        asset: seth.address
      },
      susdKey,
      sethKey,
    )) as LyraVault;

    // set strategy
    await vault.connect(owner).setStrategy(mockedStrategy.address);
  })

  before('mint asset for option market and synthetix', async() => {
    await susd.mint(mockedMarket.address, parseUnits('100000'))

    await seth.connect(anyone).mint(mockedSynthetix.address, parseEther('100'))
  })

  before('setup mocked synthetix', async() => {
    await mockedSynthetix.setMockedKeyToAddress(susdKey, susd.address)
    await mockedSynthetix.setMockedKeyToAddress(sethKey, seth.address)
  })

  describe('round 1', async() => {

    describe('basic deposit and withdraw in round 1.', async() => {
      it('should return 0 share before any deposit', async() => {
        const {heldByAccount, heldByVault} = await vault.shareBalances(depositor.address)
        expect(heldByAccount).to.be.eq(0)
        expect(heldByVault).to.be.eq(0)
      })
      it('should deposit seth into the contract and update the receipt', async() => {
        const initState = await vault.vaultState();
        const initReceipt = await vault.depositReceipts(depositor.address);
        
        await seth.mint(depositor.address, depositAmount)
        await seth.connect(depositor).approve(vault.address, ethers.constants.MaxUint256)
        await vault.connect(depositor).deposit(depositAmount)
  
        const newState = await vault.vaultState();
        const newReceipt = await vault.depositReceipts(depositor.address);
  
        expect(newState.totalPending.sub(initState.totalPending)).to.be.eq(depositAmount)
        expect(newReceipt.amount.sub(initReceipt.amount)).to.be.eq(depositAmount)
        expect(newReceipt.unredeemedShares).to.be.eq(initReceipt.unredeemedShares)
      })
      it('should be able to use depositFor to do the same thing for depositor', async() => {
        const initReceipt = await vault.depositReceipts(depositor.address);
        
        await seth.connect(anyone).mint(anyone.address,  depositAmount)
        await seth.connect(anyone).approve(vault.address, ethers.constants.MaxUint256)
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
  
      // test share calculations during round 1.
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
  
    describe('trade during first round', async () => {
      it('should revert because the first round is not started yet', async() => {
        // set mocked asset only
        await mockedMarket.setMockCollateral(seth.address, parseEther('1'))
        await mockedMarket.setMockPremium(susd.address, 0)
        await expect(vault.trade()).to.be.revertedWith('SafeMath: subtraction overflow')
      })
    });
  })

  describe('round 2: vault makes profit', async() => {
    describe('start the second round', async()=> {
      it('should be able to close the previous round', async() => {
        await vault.connect(owner).closeRound()
      })
      it('should be able to rollover the position', async() => {
        const roundBefore = await vault.vaultState()
        await vault.connect(owner).rollToNextRound()
        const roundAfter = await vault.vaultState()
        expect(roundBefore.round).to.be.eq(1)
        expect(roundAfter.round).to.be.eq(2)
      })
    })
  
    describe('redeem shares', async() => {
      it('should has some share balance after rollover', async() => {
        const {heldByVault, heldByAccount} =  await vault.shareBalances(depositor.address)
        expect(heldByAccount).to.be.eq(0)
  
        // has deposited 4 in total
        const expectedShares = parseEther('2')
        expect(heldByVault).to.be.eq(expectedShares)
      })
  
      it('should redeem some shares', async() => {
        const totalShares = await vault.shares(depositor.address)
  
        const redeemAmount = totalShares.div(4)
        const shareBefore = await vault.balanceOf(depositor.address)
        await vault.connect(depositor).redeem(redeemAmount)
        const shareAfter = await vault.balanceOf(depositor.address)
        
        expect(shareAfter.sub(shareBefore)).to.be.eq(redeemAmount)
      })
    })
  
    describe('initiate withdraw', async() => {
      let sharesToInitaiteWithrawSecond: BigNumber
      it('should be able to initiate a withdraw, this will trigger a max redeem', async() => {
        const totalShares = await vault.shares(depositor.address)
        const totalSharesToInitiateWithdraw = totalShares.div((1/initiateWithdrawSharePercentage))
        
        // only que withraw 1/8 of total shares
        const sharesToInitaiteWithrawFirst = totalSharesToInitiateWithdraw.div(2)
        sharesToInitaiteWithrawSecond = totalSharesToInitiateWithdraw.sub(sharesToInitaiteWithrawFirst)

        await vault.connect(depositor).initiateWithdraw(sharesToInitaiteWithrawFirst)

        const {heldByVault, heldByAccount} =  await vault.shareBalances(depositor.address)
        expect(heldByAccount.add(sharesToInitaiteWithrawFirst)).to.be.eq(totalShares)

        expect(heldByVault).to.be.eq(0)
      })
      it('should be able to que more withdraw share amount', async() => {
        // only que withraw another 1/8
        const withdrawReceiptBefore = await vault.withdrawals(depositor.address)
        await vault.connect(depositor).initiateWithdraw(sharesToInitaiteWithrawSecond)
        const withdrawReceiptAfter = await vault.withdrawals(depositor.address)

        expect(withdrawReceiptAfter.shares.sub(withdrawReceiptBefore.shares)).to.be.eq(sharesToInitaiteWithrawSecond)
        expect(withdrawReceiptAfter.round).to.be.eq(withdrawReceiptBefore.round)

      })
    })
  
    describe('stimulate trade', async () => {
      const size = parseUnits('1')
      const collateralAmount = parseUnits('1')
      // mock premium to 300 USD
      const minPremium = parseUnits('300')
  
      before('set mocked response from strategy', async() => {
        // set request and check result
        await mockedStrategy.setMockedTradeRequest(0, size, minPremium)
        await mockedStrategy.setMockedPostCheck(true)
      })
  
      before('set mocked premium', async() => {
        await mockedMarket.setMockCollateral(seth.address, collateralAmount)
        await mockedMarket.setMockPremium(susd.address, minPremium)
      })
  
      before('set mocked synthetix return', async() => {
        await mockedSynthetix.setMockedTradeAmount(seth.address, round3PremiumInEth)
      })
  
      it('should successfully trade', async() => {
        const sethBefore = await seth.balanceOf(vault.address)
        await vault.trade()
        const sethAfter = await seth.balanceOf(vault.address)
        expect(sethBefore.sub(collateralAmount).add(round3PremiumInEth)).to.be.eq(sethAfter)
      })
  
    });
  
    describe('settle and close', async() => {

      // assume option expires OTM, settlement will return the origianl collateral amount
      const settlementPayout = parseEther('1')
      before('simulate time pass', async() => {
        await ethers.provider.send("evm_increaseTime", [86400*7])
        await ethers.provider.send("evm_mine", [])
      })
      before('set mock settle data', async() => {
        await mockedMarket.setMockSettlement(settlementPayout)
  
        // send seth to mock mark
        await seth.connect(anyone).mint(mockedMarket.address, settlementPayout)
      })
      it('should settle a specific listing and get back collateral (seth)', async() => {
        const vaultBalanceBefore = await seth.balanceOf(vault.address)
        const listingId = 0
        await vault.settle(listingId)
        const vaultBalanceAfter = await seth.balanceOf(vault.address)
        expect(vaultBalanceAfter.sub(vaultBalanceBefore)).to.be.eq(settlementPayout)
      })
      it('should revert if trying to completeWithdraw', async() => {
        await expect(vault.connect(depositor).completeWithdraw()).to.be.revertedWith('Round not closed')
      })
      it('should rollover the vault to the next round', async() => {
        await vault.closeRound()
      })
    })
  })

  describe('round 3', async() => {
    before('rollover to round 3', async() => {
      await vault.connect(owner).rollToNextRound()
      const {round} = await vault.vaultState()
      expect(round).to.be.eq(3)
    })
    describe('after rollover', async() => {
      it('should be able to complete withdraw from previous rounds', async() => {
        const sethBalanceBefore = await seth.balanceOf(vault.address)
        await vault.connect(depositor).completeWithdraw()
        const sethBalanceAfter = await seth.balanceOf(vault.address)

        const withdrawnAmount = sethBalanceBefore.sub(sethBalanceAfter)
        const expectedWithrawnAmount = depositAmount.div(2).add(round3PremiumInEth.div(1/initiateWithdrawSharePercentage))
        expect(expectedWithrawnAmount).to.be.eq(withdrawnAmount)
      })
    })
  })

  
}); 
