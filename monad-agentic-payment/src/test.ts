/**
 * 基础测试脚本
 *
 * 测试 Policy Engine 和 Session Key Manager 的核心功能
 */

import { PolicyEngine } from './policy-engine.js';
import { SessionKeyManager } from './session-key-manager.js';
import { parseEthAmount } from './types.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ 断言失败：${message}`);
  }
  console.log(`✅ ${message}`);
}

async function testPolicyEngine(): Promise<void> {
  console.log('\n📋 测试 Policy Engine...');
  console.log('────────────────────────────────────────────────────────');

  const engine = new PolicyEngine();

  // 创建测试策略
  const policy = {
    id: 'test-policy',
    name: 'Test Policy',
    maxSinglePayment: 10, // $10
    dailyBudget: 50,      // $50
    requireHumanAbove: 5, // $5
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  engine.addPolicy(policy);

  // 测试 1: 小额支付应该通过
  const smallPayment = {
    id: 'payment-1',
    recipient: '0x1234567890123456789012345678901234567890',
    amount: parseEthAmount('0.001'), // ~$2
    agentId: 'agent-1',
    userId: 'user-1',
    reason: 'Small payment',
    createdAt: new Date(),
  };

  const smallResult = await engine.checkPayment(smallPayment, policy);
  assert(smallResult.passed, '小额支付应该通过策略检查');
  assert(smallResult.riskLevel === 'low', '小额支付应该是低风险');

  // 测试 2: 大额支付应该需要人工确认
  const largePayment = {
    id: 'payment-2',
    recipient: '0x1234567890123456789012345678901234567890',
    amount: parseEthAmount('0.01'), // ~$20
    agentId: 'agent-1',
    userId: 'user-1',
    reason: 'Large payment',
    createdAt: new Date(),
  };

  const largeResult = await engine.checkPayment(largePayment, policy);
  assert(!largeResult.checks.singleLimit.passed, '大额支付应该超过单笔限额');
  assert(largeResult.checks.humanApproval.required, '大额支付应该需要人工确认');
  assert(largeResult.riskLevel === 'high', '大额支付应该是高风险');

  // 测试 3: 超过每日预算应该拒绝
  const budgetPayment = {
    id: 'payment-3',
    recipient: '0x1234567890123456789012345678901234567890',
    amount: parseEthAmount('0.03'), // ~$60
    agentId: 'agent-1',
    userId: 'user-1',
    reason: 'Budget test',
    createdAt: new Date(),
  };

  const budgetResult = await engine.checkPayment(budgetPayment, policy);
  assert(!budgetResult.checks.dailyBudget.passed, '超过每日预算应该被拒绝');

  console.log('✅ Policy Engine 测试通过\n');
}

async function testSessionKeyManager(): Promise<void> {
  console.log('\n🔑 测试 Session Key Manager...');
  console.log('────────────────────────────────────────────────────────');

  const manager = new SessionKeyManager();

  // 注册 Agent
  manager.registerAgent({
    id: 'test-agent',
    name: 'Test Agent',
    type: 'assistant',
    sessionKeys: [],
    createdAt: new Date(),
  });

  // 创建 Session Key
  const sessionKey = manager.createSessionKey(
    'test-agent',
    'user-1',
    'test-policy',
    { ttlHours: 24 }
  );

  assert(sessionKey.id.startsWith('session-'), 'Session Key ID 格式正确');
  assert(sessionKey.publicKey.startsWith('0x'), '公钥格式正确');
  assert(!!sessionKey.privateKey, '私钥存在（仅创建时返回）');
  assert(sessionKey.isActive, 'Session Key 初始状态为活跃');
  assert(!sessionKey.isRevoked, 'Session Key 初始未撤销');

  // 验证 Session Key
  const validation = manager.validateSessionKey(sessionKey.id);
  assert(validation.valid, 'Session Key 应该有效');

  // 撤销 Session Key
  const revokeSuccess = manager.revokeSessionKey(sessionKey.id, 'Test revocation');
  assert(revokeSuccess, '撤销应该成功');

  const afterRevoke = manager.validateSessionKey(sessionKey.id);
  assert(!afterRevoke.valid, '撤销后 Session Key 应该失效');

  // 测试批量撤销
  const session2 = manager.createSessionKey('test-agent', 'user-1', 'test-policy');
  const session3 = manager.createSessionKey('test-agent', 'user-1', 'test-policy');

  const batchRevoke = manager.revokeAllAgentSessions('test-agent', 'Batch test');
  assert(batchRevoke, '批量撤销应该成功');

  console.log('✅ Session Key Manager 测试通过\n');
}

async function runTests(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Monad Agentic Payment - 测试套件                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    await testPolicyEngine();
    await testSessionKeyManager();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   所有测试通过 ✅                                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   测试失败 ❌                                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.error(error);
    process.exit(1);
  }
}

runTests().catch(console.error);
