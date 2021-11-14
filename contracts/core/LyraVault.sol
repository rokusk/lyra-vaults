//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma abicoder v2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {BaseVault} from "./BaseVault.sol";
import {IVaultStrategy} from "../interfaces/IVaultStrategy.sol";
import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {ISynthetix} from "../interfaces/ISynthetix.sol";
import {Vault} from "../libraries/Vault.sol";

import "hardhat/console.sol";

/// @notice LyraVault help users run option-selling strategies on Lyra AMM.
contract LyraVault is Ownable, BaseVault {
  using SafeMath for uint;

  IOptionMarket public immutable optionMarket;

  ISynthetix public immutable synthetix;

  IVaultStrategy public strategy;

  // Amount locked for scheduled withdrawals last week;
  uint128 public lastQueuedWithdrawAmount;
  // % of funds to be used for weekly option purchase
  uint public optionAllocation;

  /// @dev Synthetix currency key for sUSD
  bytes32 private immutable premiumCurrencyKey;

  /// @dev Synthetix currency key for WETH
  bytes32 private immutable wethCurrencyKey;

  event StrategyUpdated(address strategy);

  constructor(
    address _optionMarket,
    address _weth,
    address _susd,
    address _feeRecipient,
    address _synthetix,
    string memory _tokenName,
    string memory _tokenSymbol,
    Vault.VaultParams memory _vaultParams,
    bytes32 _premiumCurrencyKey,
    bytes32 _wethCurrencyKey
  ) BaseVault(_weth, _feeRecipient, 0, 0, _tokenName, _tokenSymbol, _vaultParams) {
    optionMarket = IOptionMarket(_optionMarket);
    synthetix = ISynthetix(_synthetix);
    IERC20(_vaultParams.asset).approve(_optionMarket, uint(-1));

    premiumCurrencyKey = _premiumCurrencyKey;
    wethCurrencyKey = _wethCurrencyKey;

    // allow synthetix to trade sUSD for WETH
    IERC20(_susd).approve(_synthetix, uint(-1));
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
    uint collateralBefore = IERC20(vaultParams.asset).balanceOf(address(this));
    uint realPremium = optionMarket.openPosition(listingId, IOptionMarket.TradeType.SHORT_CALL, amount);
    uint collateralAfter = IERC20(vaultParams.asset).balanceOf(address(this));

    uint assetUsed = collateralBefore.sub(collateralAfter);
    
    // update the remaining locked amount
    vaultState.lockedAmountLeft = vaultState.lockedAmountLeft.sub(assetUsed);

    require(realPremium >= minPremium, "premium too low");

    require(strategy.checkPostTrade(), "bad trade");

    // exhcnage sUSD to WETH
    synthetix.exchange(premiumCurrencyKey, realPremium, wethCurrencyKey);

  }

  /// @notice settle outstanding short positions.
  /// @dev anyone can call the function to settle outstanding expired positions
  function settle(uint listingId) external {
    // eth call options are settled in eth
    optionMarket.settleOptions(listingId, IOptionMarket.TradeType.SHORT_CALL);
  }

  function closeRound() external onlyOwner {
    vaultState.lastLockedAmount = vaultState.lockedAmount;
    vaultState.lockedAmountLeft = 0;
    vaultState.lockedAmount = 0;
  }

  /// @notice roll to next round
  function rollToNextRound() external {

    // todo: cannot roll over anytime. This should be done after settlement

    (uint lockedBalance, uint queuedWithdrawAmount) = _rollToNextRound(uint(lastQueuedWithdrawAmount));

    vaultState.lockedAmount = uint104(lockedBalance);
    vaultState.lockedAmountLeft = lockedBalance;
    lastQueuedWithdrawAmount = uint128(queuedWithdrawAmount);
  }

  /// @dev get eth from weth
  receive() external payable {}
}
