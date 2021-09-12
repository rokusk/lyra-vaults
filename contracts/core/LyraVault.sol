//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

contract LyraVault {
  address public immutable lyra;

  constructor(address _lyra) {
    lyra = _lyra;
  }
}
