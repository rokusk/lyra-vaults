//SPDX-License-Identifier:MIT
pragma solidity ^0.7.6;

import {IOptionMarket} from "./IOptionMarket.sol";

interface IVaultStrategy {

  function setStrategy(uint256 roundId, bytes memory strategyBytes) external;

  function getExpectedPremium(
    uint256 listingId,
    uint256 amount
  ) external view returns (uint256);

  function checkPostTrade() external view returns (bool);

}
