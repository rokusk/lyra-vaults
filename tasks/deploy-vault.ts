import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

import { Networks, sUSDAddress, sETHAddress, synthetixAddress, lyraOptionMarket } from './network-config'
import { toBytes32 } from '../test/unit-tests/utils/synthetixUtils'
import { constants } from "ethers";

/**
 * example command: 
 * npx hardhat compile --network kovan-ovm
 * npx hardhat deploy-vault --network kovan-ovm
 */
task("deploy-vault", "Deploy vault contract")
  .addParam("feeRecipient", "fee recipient address", constants.AddressZero, types.string)
  .addParam("roundDuration", "round duration in seconds", 604800, types.int)
  .addParam("tokenName", "Name for the Lyra Vault share token", 'Lyra Vault Share', types.string)
  .addParam("tokenSymbol", "symbol for the Lyra Vault share token", 'VOLT', types.string)
  .addParam("decimals", "decimals for theh share token", 18, types.int)
  .addParam("cap", "how much eth the init cap should be", '200', types.string)
  .setAction(async ({feeRecipient, roundDuration, tokenName, tokenSymbol, decimals, cap}, hre) => {
    const {ethers} = hre
    const network = hre.network.name as Networks

    const LyraVault = await ethers.getContractFactory('LyraVault');

    const vaultParam = {
      decimals,
      cap: ethers.utils.parseEther(cap),
      asset: sETHAddress[network]
    }

    console.log(`vaultParam`, vaultParam.asset)
    console.log(`sUSDAddress`, sUSDAddress[network])
    console.log(`lyraOptionMarket`, lyraOptionMarket[network])

    try {
      const lyraVault = await LyraVault.deploy(
        lyraOptionMarket[network],
        sUSDAddress[network],
        feeRecipient,
        synthetixAddress[network],
        roundDuration,
        tokenName,
        tokenSymbol,
        vaultParam,
        toBytes32('sUSD'),
        toBytes32('sETH'),
        { gasLimit: 10000000 }
      );
  
      console.log(`Deploying LyraVault contract to address ${lyraVault.address}`)
    } catch (error) {
      let message = error
      if ((error as any).reason) message = (error as any).reason
      console.error(`Deploying Error`, message)
    }
    
  });
