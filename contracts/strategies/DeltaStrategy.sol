//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// Vault Adapter
import {VaultAdapter} from "@lyrafinance/core/contracts/periphery/VaultAdapter.sol";

// Libraries
import "../synthetix/SafeDecimalMath.sol";
import "../synthetix/SignedSafeDecimalMath.sol";

contract DeltaStrategy is VaultAdapter {
  using SafeMath for uint;
  using SafeDecimalMath for uint;
  using SignedSafeMath for int;
  using SignedSafeDecimalMath for int;

  address public immutable vault;

  // example strategy detail
  struct DeltaStrategyDetail {
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

  constructor(address _vault) VaultAdapter() {
    vault = _vault;
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
   * request trade detail according to the strategy.
   */
  function doTrade() external view returns (uint positionId, uint premium) {
    // todo: check whether minInterval has passed
    uint boardId = 1;
    uint listingId = _getListing(boardId);
    uint amount = _getTradeAmount();
    uint minPremium = _getMinPremium(listingId);

    premium = 100e18; // todo: fix
    positionId = 1;
  }

  /**
   * @dev this should be executed after the vault execute trade on OptionMarket
   */
  function checkPostTrade() external pure returns (bool isValid) {
    isValid = true;
  }

  function _getBoard() internal view returns (uint boardId) {
    uint[] memory liveBoards = getLiveBoards();
  }


  /**
   * @dev get the target listing id to trade on.
   * with delta vault strategy, this will check whether board is valid and
   * loop through all listingIds until target delta is found
   */
  function _getListing(uint boardId) internal view returns (uint listingId) {
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

    return 1;
  }

  /**
   * @dev get minimum premium that the vault should receive.
   * param listingId lyra option listing id
   * param size size of trade in Lyra standard sizes
   */
  function _getMinPremium(uint listingId) internal view returns (uint minPremium) {
    // // todo: can we use lyraGlobals.skewAdjustmentFactor()?
    // (, uint strike, uint skew, , , , , , , , uint boardId) = greekCache.listingCaches(listingId);
    // (, uint expiry, uint boardIv, ) = optionMarket.optionBoards(boardId);
    // uint timeToExpirySec = expiry.sub(block.timestamp);
    // ILyraGlobals.PricingGlobals memory pricingGlobals = lyraGlobals.getPricingGlobals(address(optionMarket));

    // uint impactedIv = _getImpactedIv(boardIv, skew, pricingGlobals.skewAdjustmentFactor);

    // // getting pure black scholes price without Lyra/SNX fees
    // (uint callPremium, uint putPremium) = blackScholes.optionPrices(
    //   timeToExpirySec,
    //   impactedIv,
    //   pricingGlobals.spotPrice, //todo: need to generalize to any asset
    //   strike, // todo: need to resolve stack too deep errors
    //   pricingGlobals.rateAndCarry
    // );

    // minPremium = callPremium; // todo: generalize to calls and puts;
    return 100e18;
  }

  function _getImpactedIv(
    uint boardIv,
    uint skew,
    uint skewAdjustmentFactor
  ) internal view returns (uint impactedIv) {
    uint orderMoveBaseIv = currentStrategy.size / 100;
    uint baseIvSlip = boardIv.sub(orderMoveBaseIv);
    uint skewSlip = skew.sub(skewAdjustmentFactor.multiplyDecimal(currentStrategy.size));
    impactedIv = baseIvSlip.multiplyDecimal(skewSlip);
  }

  /**
   * @dev convert size (denominated in standard sizes) to actual contract amount.
   */
  function _getTradeAmount() internal view returns (uint amount) {
    // need to check if lyraGlobals.standardSize can be used instead to save on cost.
    uint standardSize = 1;
    amount = currentStrategy.size.multiplyDecimal(standardSize);
  }

  function abs(int val) internal pure returns (int) {
    return val >= 0 ? val : -val;
  }
}
