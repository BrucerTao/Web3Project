import { exec } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 部署脚本 - 部署 TradingAgent 合约到 0G Chain
 */
async function deploy() {
  console.log('🚀 部署 TradingAgent 合约到 0G Chain...');
  console.log();

  const rpcUrl = process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai';
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error('❌ 错误：请在 .env 文件中配置 PRIVATE_KEY');
    console.log('   可以从 faucet 获取测试币：https://faucet.0g.ai/');
    process.exit(1);
  }

  console.log(`📡 RPC: ${rpcUrl}`);

  // 编译合约
  console.log('\n📦 编译合约...');
  await runCommand('npx solc contracts/TradingAgent.sol --bin --abi -o build/');

  // 读取编译产物
  const bytecode = await readFile('build/TradingAgent.bin', 'utf-8');
  const abi = await readFile('build/TradingAgent.abi', 'utf-8');

  console.log('✅ 合约编译完成');

  // 使用 ethers 部署
  console.log('\n📝 部署合约...');

  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  // 检查余额
  const balance = await provider.getBalance(wallet.address);
  console.log(`   部署地址：${wallet.address}`);
  console.log(`   余额：${ethers.formatEther(balance)} 0G`);

  if (balance === 0n) {
    console.error('\n❌ 余额不足！请从 faucet 获取测试币:');
    console.log('   https://faucet.0g.ai/');
    process.exit(1);
  }

  // 部署合约
  const factory = new ethers.ContractFactory(
    JSON.parse(abi),
    bytecode,
    wallet
  );

  console.log('   正在部署...');
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log('\n✅ 部署成功!');
  console.log();
  console.log('📋 部署信息:');
  console.log(`   合约地址：${address}`);
  console.log(`   部署交易：${deploymentTx?.hash}`);
  console.log(`   区块浏览器：https://chainscan-testnet.0g.ai/address/${address}`);
  console.log();

  // 更新 .env 文件
  await updateEnvFile('TRADING_AGENT_CONTRACT', address);

  console.log('💡 下一步:');
  console.log('   1. 在区块浏览器验证合约：https://chainscan-testnet.0g.ai/address/${address}');
  console.log('   2. 运行演示：npm run dev');
  console.log();
}

async function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function updateEnvFile(key: string, value: string): Promise<void> {
  try {
    let content = await readFile('.env', 'utf-8');
    if (content.includes(`${key}=`)) {
      content = content.replace(
        new RegExp(`${key}=.*`),
        `${key}=${value}`
      );
    } else {
      content += `\n${key}=${value}`;
    }
    await writeFile('.env', content);
  } catch {
    // .env 文件不存在，创建它
    await writeFile('.env', `${key}=${value}\n`);
  }
}

// 运行部署
deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 部署失败:', error);
    process.exit(1);
  });
