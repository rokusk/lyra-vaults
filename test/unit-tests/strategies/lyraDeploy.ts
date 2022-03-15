import { constants, evm, lyraMarkets, TestSystemContractsType, utils } from '@lyrafinance/core';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
chai.use(solidity);

describe('Integration Test', () => {
  let account: SignerWithAddress;
  let testSystem: TestSystemContractsType;

  let boardIds: BigNumber[];
  let strikeIds: BigNumber[];

  let snap: number;

  before(async () => {
    [account] = await ethers.getSigners();
    testSystem = await lyraMarkets.deploy(account, true);
    await lyraMarkets.seed(account, testSystem);
  });

  beforeEach(async () => {
    snap = await evm.takeSnapshot();
  });

  afterEach(async () => {
    await evm.restoreSnapshot(snap);
  });

  it('will pay out long calls', async () => {
    boardIds = await testSystem.optionMarket.getLiveBoards();
    strikeIds = await testSystem.optionMarket.getBoardStrikes(boardIds[0]);

    // One long call
    await testSystem.optionMarket.openPosition({
      strikeId: strikeIds[0],
      positionId: 0,
      amount: utils.toBN('1'),
      setCollateralTo: 0,
      iterations: 1,
      minTotalCost: 0,
      maxTotalCost: constants.MAX_UINT,
      optionType: lyraMarkets.OptionType.LONG_CALL,
    });

    await evm.fastForward(constants.MONTH_SEC);
    await testSystem.mockSNX.exchangeRates.mockLatestPrice(utils.toBN('2000'));

    await testSystem.optionMarket.settleExpiredBoard(boardIds[0]);
    expect(await testSystem.liquidityPool.totalOutstandingSettlements()).to.eq(utils.toBN('500'));

    const preBalance = await testSystem.mockSNX.quoteAsset.balanceOf(account.address);
    await testSystem.shortCollateral.settleOptions([strikeIds[0]]);
    const postBalance = await testSystem.mockSNX.quoteAsset.balanceOf(account.address);
    expect(postBalance.sub(preBalance)).to.eq(utils.toBN('500'));
  });
});
