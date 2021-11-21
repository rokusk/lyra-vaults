//SPDX-License-Identifier:MIT
pragma solidity ^0.7.6;

import {IOptionMarket} from "./IOptionMarket.sol";

interface IVaultStrategy {
  function setStrategy(bytes memory strategyBytes) external;

  function requestTrade(uint boardId)
    external
    view
    returns (
      uint listingId,
      uint size,
      uint minPremium
    );

  function checkPostTrade() external view returns (bool);
}
