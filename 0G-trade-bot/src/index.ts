/**
 * 0G Agentic Trading Arena
 *
 * 基于 0G 模块化基础设施的 AI 交易机器人系统
 *
 * 核心功能:
 * - 永续合约策略代理 (Perpetual Strategy Agent)
 * - 智能收益优化器 (Yield Optimizer)
 * - 0G Storage 持久化存储
 * - 0G Compute TEE 密封推理
 * - 0G Chain 链上验证
 *
 * @author 0G APAC Hackathon Team
 */

import { PerpetualStrategyAgent } from './agents/PerpetualStrategyAgent.js';
import { YieldOptimizer } from './agents/YieldOptimizer.js';
import { StorageService } from './services/zeroGStorage.js';
import { ComputeService } from './services/zeroGCompute.js';

async function main() {
  console.log('='.repeat(60));
  console.log('🤖 0G Agentic Trading Arena');
  console.log('   Built on 0G Modular Infrastructure');
  console.log('='.repeat(60));
  console.log();

  // 初始化服务
  console.log('📦 初始化 0G 服务...');
  const storageService = new StorageService();
  const computeService = new ComputeService();
  console.log('✅ 0G 服务初始化完成');
  console.log();

  // 创建策略代理
  console.log('🚀 启动永续策略代理...');
  const perpetualAgent = new PerpetualStrategyAgent();
  await perpetualAgent.start();

  // 执行一次交易决策演示
  console.log('\n📊 执行交易决策演示...');
  const marketData = {
    prices: [65000, 65200, 65100, 65300, 65500, 65800],
    volumes: [1000000, 1200000, 900000, 1100000, 1300000, 1400000],
    high: [65500, 65600, 65400, 65700, 65800, 66000],
    low: [64800, 65000, 64900, 65100, 65300, 65500]
  };

  const tradeRecord = await perpetualAgent.executeTradingDecision(
    marketData,
    'BTC/USDT'
  );

  if (tradeRecord) {
    console.log('\n✅ 交易决策执行成功:');
    console.log(`   操作：${tradeRecord.action}`);
    console.log(`   数量：${tradeRecord.amount} USDT`);
    console.log(`   价格：${tradeRecord.price} USDT`);
  }

  // 创建收益优化器
  console.log('\n💰 启动收益优化器...');
  const yieldOptimizer = new YieldOptimizer();

  // 添加策略
  yieldOptimizer.addStrategy('conservative', {
    name: '保守策略',
    targetAPY: 0.05,
    riskLevel: 'LOW',
    assets: ['USDC', 'USDT', 'DAI']
  });

  yieldOptimizer.addStrategy('aggressive', {
    name: '激进策略',
    targetAPY: 0.12,
    riskLevel: 'MEDIUM',
    assets: ['ETH', 'WBTC', 'LINK']
  });

  // 执行收益优化
  const optimizationResult = await yieldOptimizer.optimize();
  if (optimizationResult.success) {
    console.log('\n✅ 收益优化执行成功:');
    console.log(`   协议：${optimizationResult.protocol}`);
    console.log(`   资产：${optimizationResult.asset}`);
    console.log(`   APY: ${(optimizationResult.apy! * 100).toFixed(2)}%`);
    console.log(`   预估年收益：${optimizationResult.estimatedAnnualReturn} USDT`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('🎉 演示完成！');
  console.log('='.repeat(60));
  console.log();
  console.log('📚 0G 组件使用说明:');
  console.log('   1. 0G Storage: 交易策略和记录已持久化存储');
  console.log('   2. 0G Compute: AI 推理通过 TEE 密封执行，防止抢先交易');
  console.log('   3. 0G Chain: 部署 TradingAgent 合约进行链上验证');
  console.log();
  console.log('🔗 相关链接:');
  console.log('   - 0G Docs: https://docs.0g.ai/');
  console.log('   - Builder Hub: https://build.0g.ai/');
  console.log('   - ChainScan: https://chainscan-testnet.0g.ai/');
  console.log();
}

// 错误处理
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 发生错误:', error);
    process.exit(1);
  });
