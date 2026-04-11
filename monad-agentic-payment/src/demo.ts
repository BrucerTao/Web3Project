/**
 * Demo Script - 端到端演示
 *
 * 展示完整的 Agent 支付流程：
 * 1. 初始化钱包
 * 2. 注册 Agent
 * 3. Agent 请求支付
 * 4. 策略检查
 * 5. 执行支付
 * 6. 生成审计记录
 */

import { ethers, Wallet } from 'ethers';
import { AgenticWallet } from './agentic-wallet.js';
import { MONAD_CONFIG } from './types.js';

async function demo(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Monad Agentic Payment - 端到端演示                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ==================== 步骤 1: 初始化钱包 ====================
  console.log('📍 步骤 1: 初始化钱包');
  console.log('────────────────────────────────────────────────────────');

  // 注意：在实际使用中，请从环境变量加载真实的私钥
  // 这里使用随机生成的钱包用于演示
  const demoWallet = process.env.PRIVATE_KEY
    ? new Wallet(process.env.PRIVATE_KEY)
    : Wallet.createRandom();
  console.log(`钱包地址：${demoWallet.address}`);
  console.log(`链 ID: ${MONAD_CONFIG.CHAIN_ID}`);
  console.log(`RPC: ${MONAD_CONFIG.RPC_URL}`);
  console.log('');
  console.log('⚠️  注意：这是演示生成的随机钱包，实际使用请设置 PRIVATE_KEY');
  console.log('');

  // 确保使用 Wallet 类型（ethers v6 中 createRandom 返回 HDNodeWallet）
  const agenticWallet = new AgenticWallet({
    ownerWallet: process.env.PRIVATE_KEY
      ? new Wallet(process.env.PRIVATE_KEY)
      : Wallet.createRandom() as any,
    userId: 'demo-user-001',
  });

  // ==================== 步骤 2: 注册 Agent ====================
  console.log('📍 步骤 2: 注册 Agent');
  console.log('────────────────────────────────────────────────────────');

  const agentResult = agenticWallet.registerAgent(
    'Coding Assistant',
    'assistant',
    {
      policy: {
        maxSinglePayment: 0.005 * 2000, // $10 (假设 1 ETH = $2000)
        dailyBudget: 0.025 * 2000,      // $50
        requireHumanAbove: 0.0025 * 2000, // $5 需要人工确认
      },
      sessionTtlHours: 24,
      description: 'AI 编程助手，用于支付 API 调用和云服务',
    }
  );

  console.log('');
  console.log(`✅ Agent 已注册:`);
  console.log(`   ID: ${agentResult.agent.id}`);
  console.log(`   名称：${agentResult.agent.name}`);
  console.log(`   Session Key: ${agentResult.sessionKey.publicKey}`);
  console.log(`   过期时间：${agentResult.sessionKey.expiresAt}`);
  console.log('');
  console.log(`📋 策略配置:`);
  console.log(`   单笔上限：$${agentResult.policy.maxSinglePayment}`);
  console.log(`   每日预算：$${agentResult.policy.dailyBudget}`);
  console.log(`   人工确认阈值：$${agentResult.policy.requireHumanAbove}`);
  console.log('');

  // ==================== 步骤 3: 模拟 Agent 请求支付 ====================
  console.log('📍 步骤 3: Agent 请求支付 (小额，自动批准)');
  console.log('────────────────────────────────────────────────────────');

  const sessionId = agentResult.sessionKey.id;

  // 模拟支付场景 1：小额 API 调用（自动批准）
  const payment1 = await agenticWallet.requestPayment(
    sessionId,
    '0x1234567890123456789012345678901234567890', // 模拟收款方
    0.001, // 0.001 ETH = ~$2 (小于$5 阈值，自动批准)
    'API call to external service',
    {
      taskId: 'task-001',
      description: '调用 GitHub API 获取代码',
    }
  );

  // 检查策略是否通过（不管实际支付是否成功）
  if (payment1.success) {
    console.log('✅ 支付成功 (自动批准)');
    console.log(`   TX Hash: ${payment1.result?.txHash || 'N/A'}`);
    console.log(`   审计 ID: ${payment1.auditLogId}`);
  } else if (payment1.requiresHumanApproval) {
    console.log('⚠️  需要人工确认');
    console.log(`   原因：${payment1.error}`);
    console.log(`   审计 ID: ${payment1.auditLogId}`);
  } else {
    // 策略通过但支付执行失败（因为没有真实私钥/RPC）
    if (payment1.error && payment1.error.includes('Policy check failed')) {
      console.log(`❌ 策略检查失败：${payment1.error}`);
    } else {
      console.log('✅ 策略检查通过（这是预期行为）');
      console.log(`   ⚠️  支付执行失败（没有真实私钥，这是正常的）`);
      console.log(`   错误：${payment1.error || 'unknown'}`);
      console.log(`   审计 ID: ${payment1.auditLogId || 'N/A'}`);
    }
  }
  console.log('');

  // ==================== 步骤 4: 大额支付测试 ====================
  console.log('📍 步骤 4: Agent 请求支付 (大额，超过单笔上限)');
  console.log('────────────────────────────────────────────────────────');

  const payment2 = await agenticWallet.requestPayment(
    sessionId,
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    0.01, // 0.01 ETH = ~$20 (超过$10 单笔上限)
    'Cloud service monthly subscription',
    {
      taskId: 'task-002',
      description: '支付云服务月费',
    }
  );

  // 这笔支付应该被策略拒绝（超过单笔上限）
  if (!payment2.success && payment2.error?.includes('Policy check failed')) {
    console.log('✅ 策略生效：支付被拒绝（预期行为）');
    console.log(`   原因：${payment2.error}`);
    console.log(`   审计 ID: ${payment2.auditLogId}`);
  } else if (payment2.requiresHumanApproval) {
    console.log('⚠️  需要人工确认');
    console.log(`   原因：${payment2.error}`);
    console.log(`   审计 ID: ${payment2.auditLogId}`);
  } else {
    console.log(`⚠️  支付未被子拒绝（策略可能配置有误）`);
    console.log(`   结果：${payment2.success ? '成功' : '失败'}`);
  }
  console.log('');

  // ==================== 步骤 4.5: 测试需要人工确认的支付 ====================
  console.log('📍 步骤 4.5: Agent 请求支付 (需要人工确认)');
  console.log('────────────────────────────────────────────────────────');

  const payment2b = await agenticWallet.requestPayment(
    sessionId,
    '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd',
    0.004, // 0.004 ETH = ~$8 (在$10 限额内，但超过$5 确认阈值)
    'Premium API subscription',
    {
      taskId: 'task-002b',
      description: '购买高级 API 服务',
    }
  );

  if (payment2b.requiresHumanApproval) {
    console.log('⚠️  需要人工确认（这是预期的）');
    console.log(`   原因：金额 $8 > 阈值 $5`);
    console.log(`   审计 ID: ${payment2b.auditLogId}`);
    console.log('');
    console.log('   现在模拟用户批准...');

    const approveResult = await agenticWallet.approvePayment(
      payment2b.auditLogId!,
      true
    );

    if (approveResult.success) {
      console.log('   ✅ 用户已批准，支付已执行');
      console.log(`   TX Hash: ${approveResult.txHash || 'N/A'}`);
    } else {
      console.log(`   ⚠️  支付执行失败（没有真实私钥/RPC，这是正常的）`);
      console.log(`   错误：${approveResult.error}`);
    }
  } else {
    console.log(`⚠️  应该需要人工确认但未触发`);
  }
  console.log('');

  // ==================== 步骤 5: 测试策略限制 ====================
  console.log('📍 步骤 5: 测试策略限制 (超出单笔上限)');
  console.log('────────────────────────────────────────────────────────');

  // 这笔支付和步骤 4 重复了，跳过
  console.log('   (此步骤与步骤 4 类似，已跳过)');
  console.log('');

  // ==================== 步骤 6: 查看审计日志 ====================
  console.log('📍 步骤 6: 查看审计日志');
  console.log('────────────────────────────────────────────────────────');

  const logs = agenticWallet.getAuditLogs({ limit: 10 });
  console.log(`共有 ${logs.length} 条审计记录:`);
  console.log('');

  logs.forEach((log, i) => {
    const status = log.paymentResult.success ? '✅' : log.paymentResult.requiredHumanApproval ? '⏳' : '❌';
    console.log(`${i + 1}. ${status} ${log.paymentRequest.reason}`);
    console.log(`   时间：${log.timestamp.toLocaleString()}`);
    console.log(`   Agent: ${log.agentId}`);
    console.log(`   金额：${log.paymentRequest.amount.toString()} wei`);
    console.log(`   风险等级：${log.riskLevel}`);
    console.log(`   ID: ${log.id}`);
    console.log('');
  });

  // ==================== 步骤 7: 生成支付收据 ====================
  console.log('📍 步骤 7: 生成支付收据');
  console.log('────────────────────────────────────────────────────────');

  if (logs.length > 0) {
    const receipt = agenticWallet.generateReceipt(logs[0].id);
    console.log(receipt);
    console.log('');
  }

  // ==================== 步骤 8: 查看统计信息 ====================
  console.log('📍 步骤 8: 查看统计信息');
  console.log('────────────────────────────────────────────────────────');

  const stats = agenticWallet.getStats();
  console.log(`总支付数：${stats.totalPayments}`);
  console.log(`成功：${stats.successfulPayments}`);
  console.log(`失败：${stats.failedPayments}`);
  console.log(`总量：${stats.totalVolume}`);
  console.log(`活跃 Agent 数：${stats.activeAgents}`);
  console.log('');

  // ==================== 步骤 9: 撤销 Agent ====================
  console.log('📍 步骤 9: 演示撤销 Agent 权限');
  console.log('────────────────────────────────────────────────────────');

  const revokeSuccess = agenticWallet.revokeAgent(
    agentResult.agent.id,
    '演示结束'
  );

  if (revokeSuccess) {
    console.log(`✅ 已撤销 Agent ${agentResult.agent.id} 的所有权限`);
  }

  // 尝试使用已撤销的 Session
  const paymentAfterRevoke = await agenticWallet.requestPayment(
    sessionId,
    '0x1111111111111111111111111111111111111111',
    0.001,
    'Payment after revoke test',
  );

  if (!paymentAfterRevoke.success) {
    console.log(`✅ Session 已失效：${paymentAfterRevoke.error}`);
  }
  console.log('');

  // ==================== 演示结束 ====================
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   演示结束                                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📚 下一步：');
  console.log('   1. 设置 PRIVATE_KEY 环境变量使用真实钱包');
  console.log('   2. 在 Monad 测试网领取测试币');
  console.log('   3. 运行 `npm run mcp` 启动 MCP Server');
  console.log('   4. 在 Claude Code 中配置使用 agentic-wallet');
  console.log('');
}

// 运行演示
demo().catch((error) => {
  console.error('演示失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
