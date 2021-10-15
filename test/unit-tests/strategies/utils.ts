import { BigNumber } from "@ethersproject/bignumber"
import { ethers } from "hardhat"

export function encodeDeltaStrategy(minIv: BigNumber|number, maxIv: BigNumber|number, size: BigNumber|number, interval: BigNumber|number) {
    const encoder = new ethers.utils.AbiCoder()
   return encoder.encode(['uint128', 'uint128', 'uint128', 'uint128'],[minIv, maxIv, size, interval])
}