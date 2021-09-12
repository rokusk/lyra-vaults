import { ethers } from 'hardhat';
import { LyraVault } from '../../typechain';
import { expect } from "chai";

describe('Vault', async () => {

  it('deploy', async() => {
    const LyraVault = await ethers.getContractFactory("LyraVault");
    const vault = await LyraVault.deploy(ethers.constants.AddressZero) as LyraVault;

    const address1 = await vault.lyra();
    expect(address1).to.be.eq(ethers.constants.AddressZero)
  })
})