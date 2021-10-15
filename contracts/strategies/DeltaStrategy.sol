//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DeltaStrategy is IVaultStrategy, Ownable {
  address public immutable blackScholes;
  address public immutable optionMarketViwer;

  // example strategy detail
  struct DeltaStrategyDetail {
    uint128 maxIv;
    uint128 maxSize;
  }

  mapping(uint => bool) public isReadyForRound;
  mapping(uint => DeltaStrategyDetail) public strategyForRound;

  constructor(address _blackScholes, address _optionMarketViewer) {
    blackScholes = _blackScholes;
    optionMarketViwer = _optionMarketViewer;
  }

  function setStrategy(uint roundId, bytes memory strategyBytes) external override onlyOwner {
    isReadyForRound[roundId] = true;
  }

  function getExpectedPremium(uint listingId, uint amount) external view override returns (uint expectedPremium) {
    expectedPremium = 0;
  }

  function checkPostTrade() external view override returns (bool isValid) {
    isValid = true;
  }
}
