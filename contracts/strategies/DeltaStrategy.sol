//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// Lyra
import {VaultAdapter} from "@lyrafinance/core/contracts/periphery/VaultAdapter.sol";
import {OptionMarket} from "@lyrafinance/core/contracts/OptionMarket.sol";
import {OptionToken} from "@lyrafinance/core/contracts/OptionToken.sol";
import {DecimalMath} from "@lyrafinance/core/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/core/contracts/synthetix/SignedDecimalMath.sol";


contract DeltaStrategy is VaultAdapter {
  using DecimalMath for uint;
  using SignedDecimalMath for int;

  address public immutable vault;
  OptionMarket.OptionType public immutable optionType;

  uint public lastTradeTimestamp;
  uint public lastAdjustmentTimestamp;
  uint public activeExpiry;
  uint[] public activeStrikeIds;
  mapping(uint => uint) public strikeToPositionId;
 
  // example strategy detail
  struct DeltaStrategyDetail {
    uint collatBuffer; // multiple of vaultAdapter.minCollateral(): 1.1 -> 110% * minCollat
    uint collatPercent; // partial collateral: 0.9 -> 90% * fullCollat
    uint minTimeToExpiry;
    uint maxTimeToExpiry;
    int targetDelta;
    int maxDeltaGap;
    uint minVol;
    uint maxVol;
    uint size;
    uint minTradeInterval;
    uint minReducePositionInterval;
  }

  DeltaStrategyDetail public currentStrategy;

  ///////////
  // ADMIN //
  ///////////

  constructor(address _vault, OptionMarket.OptionType _optionType) VaultAdapter() {
    vault = _vault;
    optionType = _optionType;

    quoteAsset.approve(vault, type(uint).max);
    baseAsset.approve(vault, type(uint).max);
  }

  /**
   * @dev update the strategy for the new round.
   */
  function setStrategy(DeltaStrategyDetail memory _deltaStrategy) external onlyOwner {
    //todo: add requires to params
    currentStrategy = _deltaStrategy;
    //todo: set the round status on vault
    // vault.startWithdrawPeriod
  }

  ///////////////////
  // VAULT ACTIONS //
  ///////////////////

  function setBoard(uint boardId) external onlyVault {
    Board memory board = getBoard(boardId);
    require(isValidBoard(board), "invalid board");
    activeExpiry = board.expiry;
  }

  function returnFundsAndClearStrikes() external onlyVault {
    uint quoteBal = quoteAsset.balanceOf(address(this));
    uint baseBal = baseAsset.balanceOf(address(this));

    if (_isBaseCollat()) {
      exchangeToBase(amountBase, quoteBal)
    }

    quoteAsset.transfer(vault, quoteBal);
    baseAsset.transfer(vault, baseBal);



    _clearAllActiveStrikes();
  }

  /**
   * @dev convert size (denominated in standard sizes) to actual contract amount.
   */
  function getRequiredCollateral(uint strikeId) 
    external view 
    returns (uint requiredCollat) {
    Strike memory strike = getStrikes([strikeId])[0];
    uint sellAmount = currentStrategy.size;
    ExchangeRateParams memory exchangeParams = getExchangeParams();
    
    requiredCollat = _getRequiredCollateral(
      strike.strikePrice, 
      strike.expiry, 
      exchangeParams.spotPrice, 
      sellAmount);
  }

  /**
   * request trade detail according to the strategy. Keeps premiums in contract
   * For puts, since premium is added to collateral, basically premium amount 
   * is not used from the funds that are sent
   */
  // todo: need to store several positionIds, decide how to balance collateral
  function doTrade(
    uint strikeId, 
    uint collateralToAdd, 
    address lyraRewardRecipient) 
    external onlyVault returns (uint, uint) {
    Strike memory strike = getStrikes([strikeId])[0];
    require(lastTradeTimestamp + currentStrategy.minInterval <= block.timestamp, 
      "min time interval not passed");
    require(isValidStrike(strike), "invalid strike");

    // get minimum expected premium based on minIv
    uint minExpectedPremium = _getPremiumLimit(strike, true);
    uint existingCollateral = 0;
    if (_isActiveStrike(strike)) {
      OptionToken.PositionWithOwner position = getPositions([strikeToPositionId[strikeId]])[0];
      uint existingCollateral = position.collateral;
    }

    // perform trade
    uint beforeBal = quoteAsset.balanceOf(address(this));
    TradeResult memory result = openPosition(
      TradeInputParameters ({
        strikeId: strike.id,
        positionId: strikeToPositionId[strike.id],
        iterations: 3,
        optionType: optionType,
        amount: currentStrategy.size,
        setCollateralTo: existingCollateral + collateralToAdd,
        minTotalCost: minExpectedPremium,
        maxTotalCost: type(uint).max,
        rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
      }));
    lastTradeTimestamp = block.timestamp;

    // update active strikes
    _addActiveStrike(strike, result.positionId);

    // check balances and keep premiums in vault in case reducePosition() is called
    _checkPostTrade(beforeBal, minExpectedPremium);

    return(result.positionId, result.totalCost);
  }

  function reducePosition(uint positionId, address lyraRewardRecipient) external onlyVault {
    OptionToken.PositionWithOwner position = getPositions([positionId])[0];
    Strike memory strike = getStrikes([position.strikeId])[0];
    ExchangeRateParams memory exchangeParams = getExchangeParams();

    require(strikeToPositionId[position.strikeId] != positionId, "invalid positionId");

    // limit frequency of position adjustments
    require(lastAdjustmentTimestamp + currentStrategy.minReducePositionInterval <= block.timestamp, 
      "min time interval not passed");
    
    // only allows closing if collat < minBuffer
    uint minCollatPerAmount = _getRequiredCollateral(
      strike.strikePrice, 
      strike.expiry, 
      exchangeParams.spotPrice, 
      1e18);
    require(position.collateral < minCollatPerAmount.multiplyDecimal(position.amount), 
      "position properly collateralized");

    // closes excess position with premium balance
    uint closeAmount = position.amount - position.collateral.divideDecimal(minCollatPerAmount);
    TradeResult memory result = closePosition(
      TradeInputParameters({
        strikeId: position.strikeId,
        positionId: position.positionId,
        iterations: 3,
        optionType: optionType,
        amount: closeAmount,
        setCollateralTo: position.collateral,
        minTotalCost: type(uint).min,
        maxTotalCost: _getPremiumLimit(strike, false),
        rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
      }));
    lastAdjustmentTimestamp = block.timestamp;

    // return closed collateral amount
    if (_isBaseCollat()) {
      uint currentBal = baseAsset.balanceOf(address(this));
      baseAsset.transfer(vault, currentBal);
    } else { // quote collateral
      quoteAsset.transfer(vault, closeAmount);
    }
  }

  /////////////
  // HELPERS //
  /////////////

  function isValidBoard(Board memory board) public view returns (bool isValid) {
    uint secondsToExpiry = _getSecondsToExpiry(board.expiry);
    isValid = (secondsToExpiry >= currentStrategy.minTimeToExpiry 
      && secondsToExpiry <= currentStrategy.maxTimeToExpiry)
      ? true
      : false;
  }

  /**
   * @dev get the target listing id to trade on.
   * with delta vault strategy, this will check whether board is valid and
   * loop through all listingIds until target delta is found
   */
  function isValidStrike(Strike memory strike) public view returns (bool isValid) {
    uint vol = getVols([strike.id])[0];
    uint delta = _isCall()
      ? getDeltas([strike.id])[0] - SignedDecimalMath.UNIT
      : getDeltas([strike.id])[0];

    uint deltaGap = _abs(currentStrategy.targetDelta - delta);

    if (vol >= currentStrategy.minVol 
        && vol <= currentStrategy.maxVol 
        && deltaGap < currentStrategy.maxDeltaGap) {
        return true;
    } else {
      return false;
    }

    return getStrikes([strike.id])[0];
  }

  function _getRequiredCollateral(
    uint strikePrice, 
    uint expiry, 
    uint spotPrice, 
    uint amount) 
    internal view returns (uint requiredCollat) {
    // calculate required collat based on collatBuffer and collatPercent
    uint minCollat = getMinCollateral(
        optionType, 
        strikePrice, 
        expiry, 
        spotPrice, 
        amount);
    uint minCollatWithBuffer = minCollat.multiplyDecimal(currentStrategy.collatBuffer);

    uint fullCollat = _isBaseCollat()
      ? amount
      : amount.multiplyDecimal(spotPrice);

    uint targetCollat = fullCollat.multiplyDecimal(currentStrategy.collatPercent);
    
    // make sure never exceeds full collat
    requiredCollat = _min(fullCollat, _max(minCollatWithBuffer, targetCollat));
}

  /**
   * @dev get minimum premium that the vault should receive.
   * param listingId lyra option listing id
   * param size size of trade in Lyra standard sizes
   */
  function _getPremiumLimit(Strike memory strike, bool isMin) internal view returns (uint limitPremium) {
    ExchangeRateParams memory exchangeParams = getExchangeParams();
    uint limitVol = isMin ? currentStrategy.minVol : currentStrategy.maxVol;
    (uint minCallPremium, uint minPutPremium) = getPurePremium(
      _getSecondsToExpiry(strike.expiry), 
      limitVol,
      exchangeParams.spotPrice,
      strike.strikePrice);

    limitPremium = _isCall() ? minCallPremium : minPutPremium;
  }

  /**
   * @dev this should be executed after the vault execute trade on OptionMarket
   */
  function _checkPostTrade(uint beforeBalance, uint minExpectedPremium) 
    internal view {
    uint quoteBalance = quoteAsset.balanceOf(address(this));
    require(quoteBalance >= beforeBalance + minExpectedPremium, "invalid post trade balance");
  }

  function _addActiveStrike(Strike memory strike, uint tradedPositionId) 
    internal returns (uint currentPositionId) {
    if (!_isActiveStrike(strike.id)) {
      strikeToPositionId[strike.id] = tradedPositionId;
      activeStrikeIds.push(strike.id);
    }
  }

  function _clearAllActiveStrikes() internal {
    // todo: take care of i = 0 case
    for (uint i = 0; i < activeStrikeIds.length; i++) {
      OptionToken.PositionWithOwner position = getPositions([strikeToPositionId[i]])[0];
      require(position.state != OptionToken.PositionState.ACTIVE, "cannot clear active position");
      delete strikeToPositionId[i];
    }
    delete activeStrikeIds;
  }

  function _isActiveStrike(uint strikeId) internal view returns (bool isActive) {
    isActive = strikeToPositionId[strikeId] != 0
      ? true
      : false;
  }

  function _isBaseCollat() internal view returns (bool isBase) {
    isBase = (optionType == OptionMarket.OptionType.SHORT_CALL_BASE)
      ? true
      : false;
  }

  function _isCall() internal view returns (bool isCall) {
    isCall = (optionType == OptionMarket.OptionType.SHORT_PUT_QUOTE)
      ? false
      : true;
  }


  function _abs(int val) internal pure returns (uint) {
    return val >= 0 ? uint(val) : uint(-val);
  }

  function _min(uint x, uint y) internal pure returns (uint) {
    return (x < y) ? x : y;
  }

  function _max(uint x, uint y) internal pure returns (uint) {
    return (x > y) ? x : y;
  }

  function _getSecondsToExpiry(uint expiry) internal view returns (uint) {
    require(block.timestamp <= expiry, "timestamp expired");
    return expiry - block.timestamp;
  }

  modifier onlyVault() virtual {
    require(msg.sender == address(vault), "only Vault");
    _;
  }
}
