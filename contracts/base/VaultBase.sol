//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VaultBase is ERC20, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using SafeMath for uint;

  address public asset;

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}
}
