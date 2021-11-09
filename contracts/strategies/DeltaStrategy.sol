//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DeltaStrategy is IVaultStrategy, Ownable {
  address public immutable blackScholes;
  address public immutable optionMarketViwer;
  address public immutable vault;

  // example strategy detail
  struct DeltaStrategyDetail {
    uint128 maxIv; // should not trade is iv is above this number
    uint128 minIv; // should not trade is iv is below this number
    uint128 size;
    uint128 minInterval;
  }

  DeltaStrategyDetail public currentStrategy;

  constructor(
    address _vault,
    address _blackScholes,
    address _optionMarketViewer
  ) {
    vault = _vault;
    blackScholes = _blackScholes;
    optionMarketViwer = _optionMarketViewer;
  }

  /**
   * @dev update the strategy for the new round.
   * @param strategyBytes decoded strategy data
   */
  function setStrategy(bytes memory strategyBytes) external override onlyOwner {
    //todo: check that the vault is in a state that allow changing strategy
    (uint128 maxIv, uint128 minIv, uint128 size, uint128 minInterval) = abi.decode(
      strategyBytes,
      (uint128, uint128, uint128, uint128)
    );
    currentStrategy = DeltaStrategyDetail({maxIv: maxIv, minIv: minIv, size: size, minInterval: minInterval});
    //todo: set the round status on vault
    // vault.startWithdrawPeriod
  }

  /**
   * request trade detail according to the strategy.
   */
  function requestTrade()
    external
    view
    override
    returns (
      uint listingId,
      uint size,
      uint minPremium
    )
  {
    listingId = _getListing();
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
   * with delta vault strategy, this will be looping through all potential listings and find the closest iv
   */
  function _getListing() internal pure returns (uint listingId) {
    listingId = 0;
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
  function _getMinPremium(uint /*listingId*/, uint /*size*/) internal pure returns (uint minPremium) {
    // todo: request blacksholes to get premium without fee
    // todo: apply constant logic to get min premium
    minPremium = 0;
  }
}
