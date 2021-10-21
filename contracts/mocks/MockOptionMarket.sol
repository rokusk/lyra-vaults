//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {IOptionMarket} from "../interfaces/IOptionMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockOptionMarket {
  address public token;
  uint public cost;

  function setMockCost(address _token, uint _cost) external {
    token = _token;
    cost = _cost;
  }

  function openPosition(
    uint, /*_listingId*/
    IOptionMarket.TradeType, /*tradeType*/
    uint /*amount*/
  ) external returns (uint totalCost) {
    IERC20(token).transferFrom(msg.sender, address(this), cost);
    // todo: mint mocked certificate?
    return cost;
  }
}
