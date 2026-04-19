const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

async function main() {
  console.log('🚀 部署 TradingAgent 合约到 0G Chain...\n');

  const rpcUrl = process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai';
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error('❌ 错误：请在 .env 文件中配置 PRIVATE_KEY');
    console.log('   从 faucet 获取测试币：https://faucet.0g.ai/');
    process.exit(1);
  }

  console.log(`📡 网络：0G Galileo Testnet`);
  console.log(`   RPC: ${rpcUrl}`);
  console.log(`   Chain ID: 16601`);

  // 编译合约
  console.log('\n📦 编译合约...');
  try {
    execSync('npx hardhat compile', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ 编译失败');
    process.exit(1);
  }

  // 部署
  console.log('\n📝 部署合约...');

  const { ethers } = require('hardhat');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`   部署地址：${wallet.address}`);
  console.log(`   余额：${ethers.formatEther(balance)} 0G`);

  if (balance === 0n) {
    console.error('\n❌ 余额不足！从 faucet 获取测试币:');
    console.log('   https://faucet.0g.ai/');
    process.exit(1);
  }

  // 部署合约
  const TradingAgent = await ethers.getContractFactory('TradingAgent');
  console.log('   正在部署...');

  const contract = await TradingAgent.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log('\n✅ 部署成功!\n');
  console.log('📋 部署信息:');
  console.log(`   合约地址：${address}`);
  console.log(`   部署交易：${deploymentTx.hash}`);
  console.log(`   区块浏览器：https://chainscan-galileo.0g.ai/address/${address}`);
  console.log();

  // 更新 .env
  updateEnvFile('TRADING_AGENT_CONTRACT', address);

  console.log('💡 下一步:');
  console.log(`   1. 验证合约：npx hardhat verify --network zerog ${address}`);
  console.log('   2. 运行演示：npm run dev');
  console.log('   3. 打开 UI: open demo.html');
  console.log();
}

function updateEnvFile(key, value) {
  let content = '';
  try {
    content = fs.readFileSync('.env', 'utf-8');
    if (content.includes(`${key}=`)) {
      content = content.replace(
        new RegExp(`${key}=.*`),
        `${key}=${value}`
      );
    } else {
      content += `\n${key}=${value}`;
    }
  } catch {
    content = `${key}=${value}\n`;
  }
  fs.writeFileSync('.env', content);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 部署失败:', error);
    process.exit(1);
  });
