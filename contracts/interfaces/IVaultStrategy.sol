//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IVaultStrategy {
  struct DeltaStrategyDetail {
    uint minTimeToExpiry;
    uint maxTimeToExpiry;
    int targetDelta;
    int maxDeltaGap;
    uint minIv;
    uint maxIv;
    uint size;
    uint minInterval;
  }

  ///////////
  // Admin //
  ///////////

  function setStrategy(DeltaStrategyDetail memory _deltaStrategy) external;

  ///////////
  // Trade //
  ///////////

  function doTrade() external view returns (uint realPremium, uint positionId);

  function checkPostTrade() external view returns (bool);

  //////////////
  // Internal //
  //////////////
}
