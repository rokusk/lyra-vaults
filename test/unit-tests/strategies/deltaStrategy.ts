import { ethers } from 'hardhat';
import { DeltaStrategy } from '../../../typechain';
import { expect } from "chai";

describe('Delta Vault Strategy', async () => {

  it('deploy', async() => {
    const DeltaStrategy = await ethers.getContractFactory("DeltaStrategy");
    const vault = await DeltaStrategy.deploy() as DeltaStrategy;

    const address1 = await vault.lyra();
    expect(address1).to.be.eq(ethers.constants.AddressZero)
  })
})