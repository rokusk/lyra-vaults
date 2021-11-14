//SPDX-License-Identifier:MIT
pragma solidity ^0.7.6;

interface IWETH {
  function deposit() external payable;

  function withdraw(uint) external;

  function balanceOf(address account) external view returns (uint);

  function transfer(address recipient, uint amount) external returns (bool);

  function allowance(address owner, address spender) external view returns (uint);

  function approve(address spender, uint amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint amount
  ) external returns (bool);

  function decimals() external view returns (uint);
}
