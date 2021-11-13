// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import {ISynthetix} from "../interfaces/ISynthetix.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSynthetix is ISynthetix {
  mapping(bytes32 => address) private addressMap;

  mapping(address => uint) private mockedTradeAmount;

  constructor() {
    // really
  }

  function setMockedKeyToAddress(bytes32 _key, address _address) external {
    addressMap[_key] = _address;
  }

  function setMockedTradeAmount(address _outToken, uint _outAmount) external {
    mockedTradeAmount[_outToken] = _outAmount;
  }

  function exchange(
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) external override returns (uint amountReceived) {
    // pull source currency
    IERC20(addressMap[sourceCurrencyKey]).transferFrom(msg.sender, address(this), sourceAmount);

    // pay destination currency
    address destinationCurrency = addressMap[destinationCurrencyKey];
    amountReceived = mockedTradeAmount[destinationCurrency];
    IERC20(destinationCurrency).transfer(msg.sender, amountReceived);
  }

  function exchangeOnBehalf(
    address exchangeForAddress,
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) external override returns (uint amountReceived) {
    // pull source currency
    IERC20(addressMap[sourceCurrencyKey]).transferFrom(exchangeForAddress, address(this), sourceAmount);

    // pay destination currency
    address destinationCurrency = addressMap[destinationCurrencyKey];
    amountReceived = mockedTradeAmount[destinationCurrency];
    IERC20(destinationCurrency).transfer(exchangeForAddress, amountReceived);
  }
}
