//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
import {IOptionMarket} from "../interfaces/IOptionMarket.sol";

/// @notice LyraVault help users run option-selling strategies on Lyra AMM.
contract LyraVault is Ownable {
  IOptionMarket public immutable optionMarket;

  IVaultStrategy public strategy;

  event StrategyUpdated(address strategy);

  constructor(address _optionMarket) {
    optionMarket = IOptionMarket(_optionMarket);
  }

  /// @dev set strategy contract. This function can only be called by owner.
  function setStrategy(address _strategy) external onlyOwner {
    strategy = IVaultStrategy(_strategy);
    emit StrategyUpdated(_strategy);
  }

  /// @dev anyone can trigger a trade
  function trade() external {
    // get trade detail from strategy
    (uint listingId, uint amount, uint minPremium) = strategy.requestTrade();

    // open a short call position on lyra and collect premium
    uint realPremium = optionMarket.openPosition(listingId, IOptionMarket.TradeType.SHORT_CALL, amount);

    require(realPremium > minPremium, "premium too low");
    require(strategy.checkPostTrade(), "bad trade");
  }
}
