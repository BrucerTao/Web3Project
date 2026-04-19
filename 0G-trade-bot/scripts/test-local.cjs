#!/usr/bin/env node

/**
 * 本地测试脚本 - 在 Hardhat 本地网络上测试完整流程
 * 无需 Ganache，一键运行所有测试
 */

const { execSync } = require('child_process');
const fs = require('fs');

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 0G Agentic Trading Arena - 本地测试');
  console.log('='.repeat(60));
  console.log();

  // 步骤 1: 编译合约
  console.log('📦 步骤 1/4: 编译合约...');
  try {
    execSync('npx hardhat compile', { stdio: 'inherit' });
    console.log('✅ 合约编译完成\n');
  } catch (error) {
    console.error('❌ 合约编译失败，请确保已安装依赖：npm install');
    process.exit(1);
  }

  // 步骤 2: 运行单元测试
  console.log('🧪 步骤 2/4: 运行单元测试...');
  try {
    execSync('npx hardhat test test/TradingAgent.test.cjs --network hardhat', { stdio: 'inherit' });
    console.log('✅ 单元测试通过\n');
  } catch (error) {
    console.error('❌ 单元测试失败');
    process.exit(1);
  }

  // 步骤 3: 部署到本地网络
  console.log('🚀 步骤 3/4: 部署到本地网络...');
  try {
    execSync('npx hardhat run scripts/deploy-local.cjs --network hardhat', { stdio: 'inherit' });
    console.log('✅ 合约部署完成\n');
  } catch (error) {
    console.error('❌ 合约部署失败');
    process.exit(1);
  }

  // 步骤 4: 读取部署信息
  console.log('📋 步骤 4/4: 读取部署信息...');
  try {
    const deployInfo = JSON.parse(fs.readFileSync('deploy-info.json', 'utf-8'));
    console.log();
    console.log('部署信息:');
    console.log(`   合约地址：${deployInfo.contractAddress}`);
    console.log(`   网络：${deployInfo.network}`);
    console.log(`   Chain ID: ${deployInfo.chainId}`);
    console.log();
  } catch (error) {
    console.log('⚠️  无法读取部署信息，但部署可能已成功\n');
  }

  console.log('='.repeat(60));
  console.log('✅ 所有测试通过!');
  console.log('='.repeat(60));
  console.log();
  console.log('💡 下一步:');
  console.log('   1. 运行交易机器人演示：npm run dev');
  console.log('   2. 打开 Web UI: open demo.html');
  console.log('   3. 部署到 0G 测试网：npm run deploy:testnet');
  console.log();
  console.log('🔗 0G 测试网 faucet: https://faucet.0g.ai/');
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
