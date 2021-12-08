import 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Networks } from '../tasks/network-config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  // if networks already have Lyra deployments, return early
  if (chainId === Networks.KOVAN_OVM) {
    console.log(`already have mocked contracts`);
    return;
  }

  // deploy mocked OptionMarket
  await deploy('MockOptionMarket', {
    from: deployer,
    args: [],
    log: true,
  });

  await deploy('MockSynthetix', {
    from: deployer,
    args: [],
    log: true,
  });

  // deploy mock Tokens
  await deploy('TestSUSD', {
    // name of the deployed contract
    contract: 'MockERC20',
    from: deployer,
    args: ['Synth USD', 'sUSD', 18],
    log: true,
  });

  await deploy('TestSETH', {
    // name of the deployed contract
    contract: 'MockERC20',
    from: deployer,
    args: ['Synth ETH', 'sETH', 18],
    log: true,
  });
};

export default func;
