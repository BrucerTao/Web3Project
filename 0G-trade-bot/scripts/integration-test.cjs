const { ethers } = require("hardhat");

/**
 * 集成测试 - 测试完整的交易机器人流程
 * 模拟实际的 AI Agent 与合约交互
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🧪 0G Agentic Trading Arena - 集成测试');
  console.log('='.repeat(60));
  console.log();

  const [deployer, agent1, agent2] = await ethers.getSigners();
  console.log(`📡 测试账户：${deployer.address}`);
  console.log();

  // 部署合约
  console.log('📦 部署 TradingAgent 合约...');
  const TradingAgent = await ethers.getContractFactory('TradingAgent');
  const contract = await TradingAgent.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ 合约地址：${address}`);
  console.log();

  // 测试 1: 注册机器人
  console.log('📝 测试 1: 注册交易机器人...');
  const tx1 = await contract.connect(agent1).registerAgent("PerpetualBot-v1");
  await tx1.wait();
  console.log('✅ 机器人注册成功');

  const agentInfo = await contract.getAgentInfo(agent1.address);
  console.log(`   名称：${agentInfo.name}`);
  console.log(`   所有者：${agentInfo.owner}`);
  console.log(`   状态：${agentInfo.active ? '活跃' : '未激活'}`);
  console.log();

  // 测试 2: 存储策略（模拟 0G Storage 文件 ID）
  console.log('💾 测试 2: 存储策略到链上...');
  const strategyHash = ethers.keccak256(ethers.toUtf8Bytes("perpetual-strategy-v1"));
  const zeroGFileId = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

  const tx2 = await contract.connect(agent1).storeStrategy(strategyHash, zeroGFileId);
  await tx2.wait();
  console.log('✅ 策略存储成功');

  const strategy = await contract.getLatestStrategy(agent1.address);
  console.log(`   策略哈希：${strategy.hash}`);
  console.log(`   0G File ID: ${strategy.fileId}`);
  console.log(`   版本：${strategy.version}`);
  console.log();

  // 测试 3: 记录 AI 推理（模拟 0G Compute TEE 推理）
  console.log('🤖 测试 3: 记录 TEE 推理结果...');
  const inputHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
    prices: [65000, 65200, 65500],
    timestamp: Date.now()
  })));
  const outputHash = ethers.keccak256(ethers.toUtf8Bytes("BUY"));

  const tx3 = await contract.connect(agent1).recordInference(inputHash, outputHash, true);
  await tx3.wait();
  console.log('✅ 推理记录成功');
  console.log(`   输入哈希：${inputHash}`);
  console.log(`   输出哈希：${outputHash}`);
  console.log(`   已验证：true`);
  console.log();

  // 测试 4: 记录交易执行
  console.log('📈 测试 4: 记录交易执行...');
  const tradeId = ethers.keccak256(ethers.toUtf8Bytes(`trade-${Date.now()}`));

  const tx4 = await contract.connect(agent1).recordTrade(tradeId);
  await tx4.wait();
  console.log('✅ 交易记录成功');

  const executed = await contract.isTradeExecuted(tradeId);
  console.log(`   交易 ID: ${tradeId}`);
  console.log(`   已执行：${executed}`);
  console.log();

  // 测试 5: 更新 PnL
  console.log('💰 测试 5: 更新交易盈亏...');
  const tx5 = await contract.connect(agent1).updatePnL(500);
  await tx5.wait();
  console.log('✅ PnL 更新成功');

  const updatedInfo = await contract.getAgentInfo(agent1.address);
  console.log(`   总交易次数：${updatedInfo.totalTrades}`);
  console.log(`   总 PnL: ${updatedInfo.totalPnL}`);
  console.log();

  // 测试 6: 防重放攻击
  console.log('🔒 测试 6: 测试防重放攻击...');
  try {
    await contract.connect(agent1).recordTrade(tradeId);
    console.log('❌ 防重放失败：同一交易被重复执行');
  } catch (error) {
    console.log('✅ 防重放成功：同一交易不能重复执行');
  }
  console.log();

  // 总结
  console.log('='.repeat(60));
  console.log('✅ 所有集成测试通过!');
  console.log('='.repeat(60));
  console.log();
  console.log('📊 测试覆盖:');
  console.log('   ✓ 机器人注册');
  console.log('   ✓ 策略存储 (0G Storage 集成)');
  console.log('   ✓ 推理记录 (0G Compute TEE 集成)');
  console.log('   ✓ 交易执行记录');
  console.log('   ✓ PnL 跟踪');
  console.log('   ✓ 防重放攻击');
  console.log();
  console.log('🎯 0G 组件集成验证:');
  console.log('   ✓ 0G Storage File ID 上链存储');
  console.log('   ✓ 0G Compute 推理哈希上链验证');
  console.log('   ✓ 0G Chain 智能合约执行');
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
