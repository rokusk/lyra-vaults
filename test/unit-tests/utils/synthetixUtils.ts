import { ethers } from 'ethers';

export const toBytes32 = (msg: string): string => {
  return ethers.utils.formatBytes32String(msg);
};
