//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";

contract MockStrategy {
  uint public mockedListingId;
  uint public mockedSize;
  uint public mockedMinPremium;

  bytes public mockedStrategyBytes;

  bool public isValid;

  function setStrategy(bytes memory _strategyBytes) external {
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
  function requestTrade()
    external
    view
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
  function checkPostTrade() external view returns (bool) {
    return isValid;
  }
}
