//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma abicoder v2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BaseVault} from "./BaseVault.sol";
import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {Vault} from "../libraries/Vault.sol";

/// @notice LyraVault help users run option-selling strategies on Lyra AMM.
contract LyraVault is Ownable, BaseVault {
  IOptionMarket public immutable optionMarket;

  IVaultStrategy public strategy;

  // Amount locked for scheduled withdrawals last week;
  uint128 public lastQueuedWithdrawAmount;
  // % of funds to be used for weekly option purchase
  uint public optionAllocation;
  // Delta vault equivalent of lockedAmount
  uint public balanceBeforePremium;

  event StrategyUpdated(address strategy);

  constructor(
    address _optionMarket,
    address _weth,
    address _feeRecipient,
    uint _managementFee,
    uint _performanceFee,
    string memory _tokenName,
    string memory _tokenSymbol,
    Vault.VaultParams memory _vaultParams
  ) BaseVault(_weth, _feeRecipient, _managementFee, _performanceFee, _tokenName, _tokenSymbol, _vaultParams) {
    optionMarket = IOptionMarket(_optionMarket);

    IERC20(_vaultParams.asset).approve(_optionMarket, uint(-1));
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

    require(realPremium >= minPremium, "premium too low");

    // todo: exchange sUSD => sETH
    require(strategy.checkPostTrade(), "bad trade");
  }

  /// @notice settle outstanding short positions.
  /// @dev anyone can call the function to settle outstanding expired positions
  function settle(uint listingId) external {
    // eth call options are settled in eth
    optionMarket.settleOptions(listingId, IOptionMarket.TradeType.SHORT_CALL);
  }

  /// @notice roll to next round
  function rollToNextRound() external {
    vaultState.lastLockedAmount = uint104(balanceBeforePremium);
    
    // todo: cannot roll over anytime. This should be done after settlement

    (uint lockedBalance, uint queuedWithdrawAmount) = _rollToNextRound(uint(lastQueuedWithdrawAmount));

    lastQueuedWithdrawAmount = uint128(queuedWithdrawAmount);
    balanceBeforePremium = lockedBalance;
  }
}
