import 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { lyraOptionMarket, Networks, sETHAddress, sUSDAddress, synthetixAddress } from '../tasks/network-config';
import { toBytes32 } from '../test/unit-tests/utils/synthetixUtils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkId = (await getChainId()) as Networks;

  // get addresses
  const lyraOptionMarketAddress = lyraOptionMarket[networkId] || (await ethers.getContract('MockOptionMarket')).address;
  const sETH = sETHAddress[networkId] || (await ethers.getContract('TestSETH')).address;
  const sUSD = sUSDAddress[networkId] || (await ethers.getContract('TestSUSD')).address;
  const synthetix = synthetixAddress[networkId] || (await ethers.getContract('MockSynthetix')).address;

  const vaultParam = {
    decimals: 18,
    cap: ethers.utils.parseEther('100').toString(), // cap at 100 eth
    asset: sETH,
  };

  const args = [
    lyraOptionMarketAddress,
    sUSD,
    deployer, // feeRecipient
    synthetix,
    86400 * 7, // round duration
    'Lyra Delta Vault',
    'VOLT',
    vaultParam,
    toBytes32('sUSD'), // sUSD key
    toBytes32('sETH'),
  ];

  // deploy core vault
  const { newlyDeployed } = await deploy('LyraVault', {
    // name of the deployed contract
    from: deployer,
    args,
    log: true,
  });

  // get deployed vault contract
  const contract = await ethers.getContract('LyraVault');

  // delay 30 secs for it to confirm
  if (newlyDeployed) {
    console.log(`waitig for contract to be confirmed by etherscan`);
    await delay(30000);
  }

  // verify contract
  try {
    await hre.run('verify:verify', {
      address: contract.address,
      constructorArguments: args,
    });
  } catch (error) {
    console.log(`verification error`, error);
  }
};

export default func;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
