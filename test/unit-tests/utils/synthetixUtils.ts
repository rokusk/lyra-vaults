import { ethers } from 'hardhat';

export const toBytes32 = (msg: string) => {
  return ethers.utils.formatBytes32String(msg);
};
