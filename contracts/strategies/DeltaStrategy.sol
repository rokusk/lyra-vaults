//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// Lyra
import {VaultAdapter} from "@lyrafinance/core/contracts/periphery/VaultAdapter.sol";
import {OptionMarket} from "@lyrafinance/core/contracts/OptionMarket.sol";
import {DecimalMath} from "@lyrafinance/core/contracts/synthetix/DecimalMath.sol";
import {SignedDecimalMath} from "@lyrafinance/core/contracts/synthetix/SignedDecimalMath.sol";


contract DeltaStrategy is VaultAdapter {
  using DecimalMath for uint;
  using SignedDecimalMath for int;

  address public immutable vault;
  OptionMarket.OptionType public immutable optionType;

  uint public lastTradeTimestamp;
  uint public roundBoardId;
  uint[] public activePositionIds;
 
  // example strategy detail
  struct DeltaStrategyDetail {
    uint collatBuffer; // multiple of vaultAdapter.minCollateral(): 1.1 -> 110% * minCollat
    uint collatPercent; // partial collateral: 0.9 -> 90% * fullCollat
    uint minTimeToExpiry;
    uint maxTimeToExpiry;
    int targetDelta;
    int maxDeltaGap;
    uint minIv;
    uint maxIv;
    uint size;
    uint minInterval;
  }

  DeltaStrategyDetail public currentStrategy;

  constructor(address _vault, OptionMarket.OptionType _optionType) VaultAdapter() {
    vault = _vault;
    optionType = _optionType;
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

  /**
   * @dev convert size (denominated in standard sizes) to actual contract amount.
   */
  function getRequiredCollateral(uint boardId) external view onlyVault returns (Strike memory strike, uint collateralToAdd, uint setCollateralTo) {
    // get market info/minCollat
    require(isValidBoard(boardId), "invalid board");
    uint sellAmount = currentStrategy.size;
    ExchangeRateParams memory exchangeParams = getExchangeParams();
    Strike memory strike = _chooseStrike(boardId);
    uint minCollat = getMinCollateral(
        optionType, 
        strike.strikePrice, 
        strike.expiry, 
        exchangeParams.spotPrice, 
        sellAmount);

    // calculate required collat based on collatBuffer and collatPercent
    uint minCollatWithBuffer = minCollat.multiplyDecimal(currentStrategy.collatBuffer);
    uint targetCollat = optionType == OptionMarket.OptionType.SHORT_CALL_BASE
      ? sellAmount.multiplyDecimal(currentStrategy.collatPercent)
      : sellAmount.multiplyDecimal(currentStrategy.collatPercent)
        .multiplyDecimal(exchangeParams.spotPrice);
    
    collateralToAdd = _max(minCollatWithBuffer, targetCollat);
    setCollateralTo = 0; // todo: finish this
  }

  /**
   * request trade detail according to the strategy.
   */
  // todo: need to store several positionIds, decide how to balance collateral
  function doTrade(
    Strike memory strike, 
    uint positionId, 
    uint setCollateralTo, 
    address lyraRewardRecipient) 
    external onlyVault returns (uint, uint) {
    require(lastTradeTimestamp + currentStrategy.minInterval <= block.timestamp, 
      "min time interval not passed");

    // get minimum expected premium based on minIv
    uint minPremium = _getMinPremium(strike);

    // ensure minimum premium is enforced
    TradeInputParameters memory tradeParams = TradeInputParameters ({
      strikeId: strike.id,
      positionId: positionId, //todo: keep adding to existing position
      iterations: 5, // this can be optimized
      optionType: optionType,
      amount: currentStrategy.size, //todo: allow to scale this down when not enough money? or just don't trade for now
      setCollateralTo: setCollateralTo, // todo: need to adjust increment up...
      minTotalCost: minPremium,
      maxTotalCost: type(uint).max,
      rewardRecipient: lyraRewardRecipient // set to zero address if don't want to wait for whitelist
    });

    // perform trade
    TradeResult memory result = openPosition(tradeParams);
    lastTradeTimestamp = block.timestamp;
    return(result.positionId, result.totalCost);
  }

  /**
   * @dev this should be executed after the vault execute trade on OptionMarket
   */
  function checkPostTrade() external view onlyVault returns (bool isValid) {
    // make sure taken/returned balances are correct
    isValid = true;
  }

  function isValidBoard(uint boardId) public view returns (bool isValid) {
    Board memory board = getBoard(boardId);
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
  function _chooseStrike(uint boardId) internal view returns (Strike memory strike) {
    Strike memory strike;
    //todo: generalize to both calls/puts
    //todo: need to get accurate spot price
    // (uint id, uint expiry, uint boardIV, bool frozen) = optionMarket.optionBoards(boardId);

    // // Ensure board is within expiry limits
    // uint timeToExpiry = expiry.sub(block.timestamp);
    // require(
    //   timeToExpiry < currentStrategy.maxTimeToExpiry && timeToExpiry > currentStrategy.minTimeToExpiry,
    //   "Board is outside of expiry bounds"
    // );

    // uint[] memory listings = optionMarket.getBoardListings(boardId);
    // int deltaGap;
    // uint listingIv;
    // uint currentListingId;
    // uint skew;
    // int callDelta;
    // uint optimalListingId = 0;
    // int optimalDeltaGap = type(int).max;

    // for (uint i = 0; i < listings.length; i++) {
    //   (currentListingId, , skew, , callDelta, , , , , , ) = greekCache.listingCaches(listings[i]);
    //   listingIv = boardIV.multiplyDecimal(skew);

    //   deltaGap = abs(callDelta.sub(currentStrategy.targetDelta));

    //   if (
    //     listingIv < currentStrategy.minIv || listingIv > currentStrategy.maxIv || deltaGap > currentStrategy.maxDeltaGap
    //   ) {
    //     continue;
    //   } else if (deltaGap < optimalDeltaGap) {
    //     optimalListingId = currentListingId;
    //     optimalDeltaGap = deltaGap;
    //   }
    // }
    // require(optimalListingId != 0, "Not able to find valid listing");
    // return optimalListingId;

  }

  /**
   * @dev get minimum premium that the vault should receive.
   * param listingId lyra option listing id
   * param size size of trade in Lyra standard sizes
   */
  function _getMinPremium(Strike memory strike) internal view returns (uint minPremium) {
    ExchangeRateParams memory exchangeParams = getExchangeParams();
    (uint minCallPremium, uint minPutPremium) = getPurePremium(
      _getSecondsToExpiry(strike.expiry), 
      currentStrategy.minIv,
      exchangeParams.spotPrice,
      strike.strikePrice);

    minPremium = optionType ==  OptionMarket.OptionType.SHORT_PUT_QUOTE ? minPutPremium : minCallPremium;
  }

  function _abs(int val) internal pure returns (int) {
    return val >= 0 ? val : -val;
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
