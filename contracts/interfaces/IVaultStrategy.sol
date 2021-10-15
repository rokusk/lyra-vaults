//SPDX-License-Identifier:MIT
pragma solidity ^0.7.6;

import {IOptionMarket} from "./IOptionMarket.sol";

interface IVaultStrategy {
  function setStrategy(uint roundId, bytes memory strategyBytes) external;

  function getExpectedPremium(uint listingId, uint amount) external view returns (uint);

  function checkPostTrade() external view returns (bool);
}
