//SPDX-License-Identifier:MIT
pragma solidity ^0.7.6;

import {IOptionMarket} from "./IOptionMarket.sol";

interface IVaultStrategy {
  function setStrategy(uint roundId, bytes memory strategyBytes) external;

  function requestTrade()
    external
    view
    returns (
      uint listingId,
      uint amount,
      uint minPremium
    );

  function checkPostTrade() external view returns (bool);
}
