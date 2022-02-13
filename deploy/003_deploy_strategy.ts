import 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // todo: change this to Delta strategy when it's ready
  const { newlyDeployed } = await deploy('MockStrategy', {
    from: deployer,
    log: true,
  });

  // get deployed vault contract
  const lyraVault = await ethers.getContract('LyraVault');
  const strategy = await ethers.getContract('MockStrategy');

  // link vault to strategy
  await lyraVault.setStrategy(strategy.address);

  // delay 30 secs for it to confirm
  if (newlyDeployed) {
    console.log(`waitig for contract to be confirmed by etherscan`);
    await delay(30000);
  }

  // verify strategy contract
  try {
    await hre.run('verify:verify', {
      address: strategy.address,
    });
  } catch (error) {
    console.log(`verification error`, error);
  }
};

export default func;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
