//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";

contract MockStrategy is IVaultStrategy {
  uint public mockedListingId;
  uint public mockedSize;
  uint public mockedMinPremium;

  bytes public mockedStrategyBytes;

  bool public isValid;

  function setStrategy(bytes memory _strategyBytes) external override {
    mockedStrategyBytes = _strategyBytes;
  }

  function setMockedTradeRequest(
    uint _listingId,
    uint _size,
    uint _minPremium
  ) public {
    mockedListingId = _listingId;
    mockedSize = _size;
    mockedMinPremium = _minPremium;
  }

  function setMockedPostCheck(bool _isValid) external {
    isValid = _isValid;
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
    return (mockedListingId, mockedSize, mockedMinPremium);
  }

  /**
   * @dev this should be executed after the vault execute trade on OptionMarket
   */
  function checkPostTrade() external view override returns (bool) {
    return isValid;
  }
}
