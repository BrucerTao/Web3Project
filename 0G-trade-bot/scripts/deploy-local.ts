const hre = require("hardhat");

async function main() {
  console.log('🚀 部署 TradingAgent 合约...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📡 部署账户：${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`   余额：${hre.ethers.formatEther(balance)} ETH\n`);

  // 编译并部署
  console.log('📦 编译合约...');
  const TradingAgent = await hre.ethers.getContractFactory('TradingAgent');

  console.log('   正在部署...');
  const contract = await TradingAgent.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log('\n✅ 部署成功!\n');
  console.log('📋 部署信息:');
  console.log(`   合约地址：${address}`);
  console.log(`   部署交易：${deploymentTx.hash}`);

  // 网络信息
  const network = await hre.ethers.provider.getNetwork();
  console.log(`   网络 Chain ID: ${network.chainId}`);

  if (network.chainId === 16602n) {
    console.log(`   区块浏览器：https://chainscan-galileo.0g.ai/address/${address}`);
  }

  console.log();

  // 保存部署信息
  const fs = require('fs');
  const deployInfo = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    contractAddress: address,
    deployer: deployer.address,
    deploymentTx: deploymentTx.hash,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('deploy-info.json', JSON.stringify(deployInfo, null, 2));
  console.log('💾 部署信息已保存到 deploy-info.json');

  // 更新 .env 文件
  updateEnvFile('TRADING_AGENT_CONTRACT', address);
  console.log('📝 合约地址已写入 .env 文件\n');

  console.log('💡 下一步:');
  console.log('   1. 运行测试：npm run test:local');
  console.log('   2. 运行演示：npm run dev');
  console.log('   3. 打开 UI: open demo.html\n');
}

function updateEnvFile(key, value) {
  let content = '';
  try {
    content = require('fs').readFileSync('.env', 'utf-8');
    if (content.includes(`${key}=`)) {
      content = content.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  } catch {
    content = `${key}=${value}\n`;
  }
  require('fs').writeFileSync('.env', content);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 部署失败:', error);
    process.exit(1);
  });
