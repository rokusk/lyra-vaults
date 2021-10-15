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
    uint128 maxIv;
    uint128 size;
  }

  mapping(uint => bool) public isReadyForRound;
  mapping(uint => DeltaStrategyDetail) public strategyForRound;

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
   
   */
  function setStrategy(uint roundId, bytes memory strategyBytes) external override onlyOwner {
    isReadyForRound[roundId] = true;

    //todo: set the round status on vault
    // vault.startWithdrawPeriod
  }

  /**
   * request trade detail according to the strategy.
   */
  function requestTrade()
    external
    pure
    override
    returns (
      uint listingId,
      uint size,
      uint minPremium
    )
  {
    listingId = _getListing();
    size = _getSize();
    minPremium = _getExpectedPremium(listingId, size);
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
  function _getSize() internal pure returns (uint size) {
    size = 0;
  }

  function _getExpectedPremium(uint listingId, uint size) internal pure returns (uint minPremium) {
    // todo: request blacksholes to get premium without fee
    // todo: apply constant logic to get min premium
    minPremium = 0;
  }
}
