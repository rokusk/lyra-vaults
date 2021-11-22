import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';

export function encodeDeltaStrategy(
  minTimeToExpiry: BigNumber,
  maxTimeToExpiry: BigNumber,
  targetDelta: BigNumber,
  maxDeltaGap: BigNumber,
  minIv: BigNumber,
  maxIv: BigNumber,
  size: BigNumber,
  minInterval: BigNumber,
): string {
  const encoder = new ethers.utils.AbiCoder();
  return encoder.encode(
    ['uint', 'uint', 'int', 'int', 'uint', 'uint', 'uint', 'uint'],
    [minTimeToExpiry, maxTimeToExpiry, targetDelta, maxDeltaGap, minIv, maxIv, size, minInterval],
  );
}
