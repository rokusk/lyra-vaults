//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

// Hardhat
import "hardhat/console.sol";

// Interfaces
import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
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

  address public immutable blackScholes;
  IOptionMarket public immutable optionMarket;
  IOptionGreekCache public immutable greekCache;
  address public immutable vault;

  // example strategy detail
  struct DeltaStrategyDetail {
    uint maxTimeToExpiry;
    uint minTimeToExpiry;
    int targetDelta;
    int maxDeltaGap;
    uint maxIv;
    uint minIv;
    uint size;
    uint minInterval;
  }

  DeltaStrategyDetail public currentStrategy;

  constructor(
    address _vault,
    address _blackScholes,
    IOptionMarket _optionMarket,
    IOptionGreekCache _greekCache
  ) {
    vault = _vault;
    blackScholes = _blackScholes;
    optionMarket = _optionMarket;
    greekCache = _greekCache;
  }

  /**
   * @dev update the strategy for the new round.
   * @param strategyBytes decoded strategy data
   */
  function setStrategy(bytes memory strategyBytes) external override onlyOwner {
    //todo: check that the vault is in a state that allow changing strategy
    (
      uint maxTimeToExpiry,
      uint minTimeToExpiry,
      int targetDelta,
      int maxDeltaGap,
      uint maxIv,
      uint minIv,
      uint size,
      uint minInterval
    ) = abi.decode(strategyBytes, (uint, uint, int, int, uint, uint, uint, uint));
    currentStrategy = DeltaStrategyDetail({
      maxTimeToExpiry: maxTimeToExpiry,
      minTimeToExpiry: minTimeToExpiry,
      targetDelta: targetDelta,
      maxDeltaGap: maxDeltaGap,
      maxIv: maxIv,
      minIv: minIv,
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
      uint size,
      uint minPremium
    )
  {
    // todo: check whether minInterval has passed
    listingId = _getListing(boardId);
    size = _getSize();
    minPremium = _getMinPremium(listingId, size);
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
    (uint id, uint expiry, uint boardIV, ) = optionMarket.optionBoards(boardId);
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
    int optimalDeltaGap = 10**10;

    // need to start from smallest delta, run a test to see if listings are ordered.
    for (uint i = 0; i < listings.length; i++) {
      (currentListingId, , skew, , callDelta, , , , , , ) = greekCache.listingCaches(listings[i]);
      listingIv = boardIV.multiplyDecimal(skew);
      console.log("Current listing: %s, IV: %i", currentListingId, listingIv);

      // calculate the gap to the target delta
      deltaGap = abs(callDelta.sub(currentStrategy.targetDelta));

      //
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
    return currentListingId;
  }

  /**
   * @dev get the size of trade.
   */
  function _getSize() internal view returns (uint size) {
    size = currentStrategy.size;
  }

  /**
   * @dev get minimum premium that the vault should receive.
   * param listingId lyra option listing id
   * param size size of trade
   * @return minPremium the min amount of sUSD the vault should receive
   */
  function _getMinPremium(
    uint, /*listingId*/
    uint /*size*/
  ) internal pure returns (uint minPremium) {
    // todo: request blacksholes to get premium without fee
    // todo: apply constant logic to get min premium
    minPremium = 0;
  }

  function abs(int val) internal pure returns (int) {
    return val >= 0 ? val : -val;
  }
}
