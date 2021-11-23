//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

// Hardhat
import "hardhat/console.sol";

// Interfaces
import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
import {IBlackScholes} from "../interfaces/IBlackScholes.sol";
import {ILyraGlobals} from "../interfaces/ILyraGlobals.sol";

import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {IOptionGreekCache} from "../interfaces/IOptionGreekCache.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import "../synthetix/SafeDecimalMath.sol";
import "../synthetix/SignedSafeDecimalMath.sol";

contract DeltaStrategy is IVaultStrategy, Ownable {
  using SafeMath for uint;
  using SafeDecimalMath for uint;
  using SignedSafeMath for int;
  using SignedSafeDecimalMath for int;

  address public immutable vault;
  IBlackScholes public immutable blackScholes;
  IOptionMarket public immutable optionMarket;
  IOptionGreekCache public immutable greekCache;
  ILyraGlobals public immutable lyraGlobals;

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

  constructor(
    address _vault,
    IBlackScholes _blackScholes,
    IOptionMarket _optionMarket,
    IOptionGreekCache _greekCache,
    ILyraGlobals _lyraGlobals
  ) {
    vault = _vault;
    blackScholes = _blackScholes;
    optionMarket = _optionMarket;
    greekCache = _greekCache;
    lyraGlobals = _lyraGlobals;
  }

  /**
   * @dev update the strategy for the new round.
   * @param strategyBytes decoded strategy data
   */
  function setStrategy(bytes memory strategyBytes) external override onlyOwner {
    //todo: check that the vault is in a state that allows changing strategy
    (
      uint minTimeToExpiry,
      uint maxTimeToExpiry,
      int targetDelta,
      int maxDeltaGap,
      uint minIv,
      uint maxIv,
      uint size,
      uint minInterval
    ) = abi.decode(strategyBytes, (uint, uint, int, int, uint, uint, uint, uint));
    currentStrategy = DeltaStrategyDetail({
      minTimeToExpiry: minTimeToExpiry,
      maxTimeToExpiry: maxTimeToExpiry,
      targetDelta: targetDelta,
      maxDeltaGap: maxDeltaGap,
      minIv: minIv,
      maxIv: maxIv,
      size: size,
      minInterval: minInterval
    });
    //todo: set the round status on vault
    // vault.startWithdrawPeriod
  }

  /**
   * request trade detail according to the strategy.
   */
  function requestTrade(uint boardId)
    external
    view
    override
    returns (
      uint listingId,
      uint amount,
      uint minPremium
    )
  {
    // todo: check whether minInterval has passed
    listingId = _getListing(boardId);
    amount = _getTradeAmount();
    minPremium = _getMinPremium(listingId);
  }

  /**
   * @dev this should be executed after the vault execute trade on OptionMarket
   */
  function checkPostTrade() external pure override returns (bool isValid) {
    isValid = true;
  }

  /**
   * @dev get the target listing id to trade on.
   * with delta vault strategy, this will check whether board is valid and
   * loop through all listingIds until target delta is found
   */
  function _getListing(uint boardId) internal view returns (uint listingId) {
    //todo: generalize to both calls/puts
    //todo: need to get accurate spot price
    (uint id, uint expiry, uint boardIV, bool frozen) = optionMarket.optionBoards(boardId);

    // Ensure board is within expiry limits
    uint timeToExpiry = expiry.sub(block.timestamp);
    require(
      timeToExpiry < currentStrategy.maxTimeToExpiry && timeToExpiry > currentStrategy.minTimeToExpiry,
      "Board is outside of expiry bounds"
    );

    uint[] memory listings = optionMarket.getBoardListings(boardId);
    int deltaGap;
    uint listingIv;
    uint currentListingId;
    uint skew;
    int callDelta;
    uint optimalListingId = 0;
    int optimalDeltaGap = type(int).max;

    for (uint i = 0; i < listings.length; i++) {
      (currentListingId, , skew, , callDelta, , , , , , ) = greekCache.listingCaches(listings[i]);
      listingIv = boardIV.multiplyDecimal(skew);

      deltaGap = abs(callDelta.sub(currentStrategy.targetDelta));

      if (
        listingIv < currentStrategy.minIv || listingIv > currentStrategy.maxIv || deltaGap > currentStrategy.maxDeltaGap
      ) {
        continue;
      } else if (deltaGap < optimalDeltaGap) {
        optimalListingId = currentListingId;
        optimalDeltaGap = deltaGap;
      }
    }
    require(optimalListingId != 0, "Not able to find valid listing");
    return optimalListingId;
  }

  /**
   * @dev get minimum premium that the vault should receive.
   * param listingId lyra option listing id
   * param size size of trade in Lyra standard sizes
   * @return minPremium the min amount of sUSD the vault should receive
   */
  function _getMinPremium(uint listingId) internal view returns (uint minPremium) {
    // todo: can we use lyraGlobals.skewAdjustmentFactor()?
    (, uint strike, uint skew, , , , , , , , uint boardId) = greekCache.listingCaches(listingId);
    (, uint expiry, uint boardIv, ) = optionMarket.optionBoards(boardId);
    uint timeToExpirySec = expiry.sub(block.timestamp);
    ILyraGlobals.PricingGlobals memory pricingGlobals = lyraGlobals.getPricingGlobals(address(optionMarket));

    uint impactedIv = _getImpactedIv(boardIv, skew, pricingGlobals.skewAdjustmentFactor);

    // getting pure black scholes price without Lyra/SNX fees
    (uint callPremium, uint putPremium) = blackScholes.optionPrices(
      timeToExpirySec,
      impactedIv,
      pricingGlobals.spotPrice, //todo: need to generalize to any asset
      strike, // todo: need to resolve stack too deep errors
      pricingGlobals.rateAndCarry
    );

    minPremium = callPremium; // todo: generalize to calls and puts;
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
    amount = currentStrategy.size.multiplyDecimal(lyraGlobals.standardSize(address(optionMarket)));
  }

  function abs(int val) internal pure returns (int) {
    return val >= 0 ? val : -val;
  }
}
