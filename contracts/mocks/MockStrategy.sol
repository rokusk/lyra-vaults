//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";

contract MockStrategy is IVaultStrategy {
  uint public mockedListingId;
  uint public mockedSize;
  uint public mockedMinPremium;

  function setStrategy(
    bytes memory /*strategyBytes*/
  ) external override {}

  function setMockedTradeRequest(
    uint _listingId,
    uint _size,
    uint _minPremium
  ) public {
    mockedListingId = _listingId;
    mockedSize = _size;
    mockedMinPremium = _minPremium;
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
    return (mockedListingId, mockedSize, mockedMinPremium);
  }

  /**
   * @dev this should be executed after the vault execute trade on OptionMarket
   */
  function checkPostTrade() external pure override returns (bool isValid) {
    isValid = true;
  }
}
