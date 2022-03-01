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

  /// @dev Synthetix currency key for sETH
  bytes32 private immutable sETHCurrencyKey;

  event StrategyUpdated(address strategy);

  event Trade(address user, uint contractSize, uint collateralAmount, uint listingId, uint premium);

  event RoundStarted(uint16 roundId, uint104 lockAmount);

  event RoundClosed(uint16 roundId, uint104 lockAmount);

  constructor(
    address _optionMarket,
    address _susd,
    address _feeRecipient,
    address _synthetix,
    uint _roundDuration,
    string memory _tokenName,
    string memory _tokenSymbol,
    Vault.VaultParams memory _vaultParams,
    bytes32 _premiumCurrencyKey,
    bytes32 _sETHCurrencyKey
  ) BaseVault(_feeRecipient, _roundDuration, _tokenName, _tokenSymbol, _vaultParams) {
    optionMarket = IOptionMarket(_optionMarket);
    synthetix = ISynthetix(_synthetix);
    IERC20(_vaultParams.asset).approve(_optionMarket, uint(-1));

    premiumCurrencyKey = _premiumCurrencyKey;
    sETHCurrencyKey = _sETHCurrencyKey;

    // allow synthetix to trade sUSD for sETH
    IERC20(_susd).approve(_synthetix, uint(-1));
  }

  /// @dev set strategy contract. This function can only be called by owner.
  function setStrategy(address _strategy) external onlyOwner {
    strategy = IVaultStrategy(_strategy);
    emit StrategyUpdated(_strategy);
  }

  /// @dev anyone can trigger a trade
  function trade() external {
    require(vaultState.roundInProgress, "round closed");
    // get trade detail from strategy
    (uint listingId, uint amount, uint minPremium) = strategy.requestTrade();

    // open a short call position on lyra and collect premium
    uint collateralBefore = IERC20(vaultParams.asset).balanceOf(address(this));

    // todo: update to Avalon interface
    uint realPremium = optionMarket.openPosition(listingId, IOptionMarket.TradeType.SHORT_CALL, amount);
    uint collateralAfter = IERC20(vaultParams.asset).balanceOf(address(this));

    uint assetUsed = collateralBefore.sub(collateralAfter);

    // update the remaining locked amount
    vaultState.lockedAmountLeft = vaultState.lockedAmountLeft.sub(assetUsed);

    require(realPremium >= minPremium, "premium too low");

    require(strategy.checkPostTrade(), "bad trade");

    // exhcnage sUSD to sETH
    synthetix.exchange(premiumCurrencyKey, realPremium, sETHCurrencyKey);

    emit Trade(msg.sender, amount, assetUsed, listingId, realPremium);
  }

  /// @notice settle outstanding short positions.
  /// @dev anyone can call the function to settle outstanding expired positions
  /// @param listingIds an array of listingId that the vault traded with in the last round.
  function settle(uint[] memory listingIds) external {
    // eth call options are settled in eth
    // todo: update to Avalon interface
    for (uint i = 0; i < listingIds.length; i++) {
      optionMarket.settleOptions(listingIds[i], IOptionMarket.TradeType.SHORT_CALL);
    }
  }

  /// @dev close the current round, enable user to deposit for the next round
  function closeRound() external onlyOwner {
    uint104 lockAmount = vaultState.lockedAmount;
    vaultState.lastLockedAmount = lockAmount;
    vaultState.lockedAmountLeft = 0;
    vaultState.lockedAmount = 0;
    vaultState.nextRoundReadyTimestamp = block.timestamp.add(Vault.ROUND_DELAY);
    vaultState.roundInProgress = false;

    emit RoundClosed(vaultState.round, lockAmount);
  }

  /// @notice start the next round
  function startNextRound() external {
    require(!vaultState.roundInProgress, "round opened");
    require(block.timestamp > vaultState.nextRoundReadyTimestamp, "CD");

    (uint lockedBalance, uint queuedWithdrawAmount) = _rollToNextRound(uint(lastQueuedWithdrawAmount));

    vaultState.lockedAmount = uint104(lockedBalance);
    vaultState.lockedAmountLeft = lockedBalance;
    vaultState.roundInProgress = true;
    lastQueuedWithdrawAmount = uint128(queuedWithdrawAmount);

    emit RoundStarted(vaultState.round, uint104(lockedBalance));
  }
}
