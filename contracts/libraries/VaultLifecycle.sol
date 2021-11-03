// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault} from "./Vault.sol";
import {ShareMath} from "./ShareMath.sol";

import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

library VaultLifecycle {
  using SafeMath for uint;
  using SafeERC20 for IERC20;

  struct CloseParams {
    address OTOKEN_FACTORY;
    address USDC;
    address currentOption;
    uint delay;
    uint16 lastStrikeOverrideRound;
    uint overriddenStrikePrice;
  }

  /**
     * @notice Calculate the shares to mint, new price per share, and
      amount of funds to re-allocate as collateral for the new round
     * @param currentShareSupply is the total supply of shares
     * @param asset is the address of the vault's asset
     * @param decimals is the decimals of the asset
     * @param pendingAmount is the amount of funds pending from recent deposits
     * @return newLockedAmount is the amount of funds to allocate for the new round
     * @return queuedWithdrawAmount is the amount of funds set aside for withdrawal
     * @return newPricePerShare is the price per share of the new round
     * @return mintShares is the amount of shares to mint from deposits
     */
  function rollover(
    uint currentShareSupply,
    address asset,
    uint decimals,
    uint pendingAmount,
    uint queuedWithdrawShares
  )
    external
    view
    returns (
      uint newLockedAmount,
      uint queuedWithdrawAmount,
      uint newPricePerShare,
      uint mintShares
    )
  {
    uint currentBalance = IERC20(asset).balanceOf(address(this));

    newPricePerShare = ShareMath.pricePerShare(currentShareSupply, currentBalance, pendingAmount, decimals);

    // After closing the short, if the options expire in-the-money
    // vault pricePerShare would go down because vault's asset balance decreased.
    // This ensures that the newly-minted shares do not take on the loss.
    uint _mintShares = ShareMath.assetToShares(pendingAmount, newPricePerShare, decimals);

    uint newSupply = currentShareSupply.add(_mintShares);

    uint queuedWithdraw = newSupply > 0 ? ShareMath.sharesToAsset(queuedWithdrawShares, newPricePerShare, decimals) : 0;

    return (currentBalance.sub(queuedWithdraw), queuedWithdraw, newPricePerShare, _mintShares);
  }

  /**
     * @notice Close the existing short otoken position. Currently this implementation is simple.
     * It closes the most recent vault opened by the contract. This assumes that the contract will
     * only have a single vault open at any given time. Since calling `_closeShort` deletes vaults by
     calling SettleVault action, this assumption should hold.
     * @param gammaController is the address of the opyn controller contract
     * @return amount of collateral redeemed from the vault
     */
  function settleShort(address gammaController) external returns (uint) {}

  /**
   * @notice Exercises the ITM option using existing long otoken position. Currently this implementation is simple.
   * It calls the `Redeem` action to claim the payout.
   * @param gammaController is the address of the opyn controller contract
   * @param oldOption is the address of the old option
   * @param asset is the address of the vault's asset
   * @return amount of asset received by exercising the option
   */
  function settleLong(
    address gammaController,
    address oldOption,
    address asset
  ) external returns (uint) {}

  /**
   * @notice Calculates the performance and management fee for this week's round
   * @param vaultState is the struct with vault accounting state
   * @param currentLockedBalance is the amount of funds currently locked in opyn
   * @param performanceFeePercent is the performance fee pct.
   * @param managementFeePercent is the management fee pct.
   * @return performanceFeeInAsset is the performance fee
   * @return managementFeeInAsset is the management fee
   * @return vaultFee is the total fees
   */
  function getVaultFees(
    Vault.VaultState storage vaultState,
    uint currentLockedBalance,
    uint performanceFeePercent,
    uint managementFeePercent
  )
    external
    view
    returns (
      uint performanceFeeInAsset,
      uint managementFeeInAsset,
      uint vaultFee
    )
  {
    uint prevLockedAmount = vaultState.lastLockedAmount;

    uint lockedBalanceSansPending = currentLockedBalance.sub(vaultState.totalPending);

    uint _performanceFeeInAsset;
    uint _managementFeeInAsset;
    uint _vaultFee;

    // Take performance fee and management fee ONLY if difference between
    // last week and this week's vault deposits, taking into account pending
    // deposits and withdrawals, is positive. If it is negative, last week's
    // option expired ITM past breakeven, and the vault took a loss so we
    // do not collect performance fee for last week
    if (lockedBalanceSansPending > prevLockedAmount) {
      _performanceFeeInAsset = performanceFeePercent > 0
        ? lockedBalanceSansPending.sub(prevLockedAmount).mul(performanceFeePercent).div(100 * Vault.FEE_MULTIPLIER)
        : 0;
      _managementFeeInAsset = managementFeePercent > 0
        ? lockedBalanceSansPending.mul(managementFeePercent).div(100 * Vault.FEE_MULTIPLIER)
        : 0;

      _vaultFee = _performanceFeeInAsset.add(_managementFeeInAsset);
    }

    return (_performanceFeeInAsset, _managementFeeInAsset, _vaultFee);
  }

  /**
   * @notice Verify the constructor params satisfy requirements
   * @param owner is the owner of the vault with critical permissions
   * @param feeRecipient is the address to recieve vault performance and management fees
   * @param performanceFee is the perfomance fee pct.
   * @param tokenName is the name of the token
   * @param tokenSymbol is the symbol of the token
   * @param _vaultParams is the struct with vault general data
   */
  function verifyInitializerParams(
    address owner,
    address keeper,
    address feeRecipient,
    uint performanceFee,
    uint managementFee,
    string calldata tokenName,
    string calldata tokenSymbol,
    Vault.VaultParams calldata _vaultParams
  ) external pure {
    require(owner != address(0), "!owner");
    require(keeper != address(0), "!keeper");
    require(feeRecipient != address(0), "!feeRecipient");
    require(performanceFee < 100 * Vault.FEE_MULTIPLIER, "performanceFee >= 100%");
    require(managementFee < 100 * Vault.FEE_MULTIPLIER, "managementFee >= 100%");
    require(bytes(tokenName).length > 0, "!tokenName");
    require(bytes(tokenSymbol).length > 0, "!tokenSymbol");

    require(_vaultParams.asset != address(0), "!asset");
    require(_vaultParams.underlying != address(0), "!underlying");
    require(_vaultParams.minimumSupply > 0, "!minimumSupply");
    require(_vaultParams.cap > 0, "!cap");
    require(_vaultParams.cap > _vaultParams.minimumSupply, "cap has to be higher than minimumSupply");
  }

  /**
   * @notice Gets the next options expiry timestamp
   * @param currentExpiry is the expiry timestamp of the current option
   * Reference: https://codereview.stackexchange.com/a/33532
   * Examples:
   * getNextFriday(week 1 thursday) -> week 1 friday
   * getNextFriday(week 1 friday) -> week 2 friday
   * getNextFriday(week 1 saturday) -> week 2 friday
   */
  function getNextFriday(uint currentExpiry) internal pure returns (uint) {
    // dayOfWeek = 0 (sunday) - 6 (saturday)
    uint dayOfWeek = ((currentExpiry / 1 days) + 4) % 7;
    uint nextFriday = currentExpiry + ((7 + 5 - dayOfWeek) % 7) * 1 days;
    uint friday8am = nextFriday - (nextFriday % (24 hours)) + (8 hours);

    // If the passed currentExpiry is day=Friday hour>8am, we simply increment it by a week to next Friday
    if (currentExpiry >= friday8am) {
      friday8am += 7 days;
    }
    return friday8am;
  }
}
