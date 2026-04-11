#!/usr/bin/env node
/**
 * CLI - 命令行工具
 *
 * 提供命令行方式的钱包操作
 */

import { Wallet } from 'ethers';
import { AgenticWallet } from './agentic-wallet.js';
import { MONAD_CONFIG } from './types.js';

function printHelp(): void {
  console.log(`
🔐 Agentic Wallet CLI - AI Agent 原生的安全支付系统

用法：
  agentic-pay <command> [options]

命令:
  init                    初始化钱包
  register-agent         注册新的 Agent
  request-payment        请求支付
  approve                批准支付
  revoke                 撤销 Agent
  sessions               列出会话
  policies               列出策略
  logs                   查看审计日志
  receipt                生成收据
  stats                  显示统计
  help                   显示帮助

示例:
  agentic-pay init
  agentic-pay register-agent --name "coding-assistant"
  agentic-pay request-payment --session <id> --to <address> --amount 0.01 --reason "API call"
  agentic-pay logs --agent <id>
`);
}

function log(...args: any[]): void {
  console.log(...args);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  // 加载私钥
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey && command !== 'init') {
    console.error('❌ 错误：请设置 PRIVATE_KEY 环境变量');
    console.error('   export PRIVATE_KEY=your_private_key');
    process.exit(1);
  }

  const wallet = privateKey ? new Wallet(privateKey) : undefined;

  if (!wallet && command !== 'init') {
    console.error('❌ 错误：请设置 PRIVATE_KEY 环境变量');
    console.error('   export PRIVATE_KEY=your_private_key');
    process.exit(1);
  }

  if (!wallet) {
    // init 命令不需要真实钱包
    console.log('🔐 Agentic Wallet 初始化');
    console.log('');
    console.log(`链 ID: ${MONAD_CONFIG.CHAIN_ID}`);
    console.log(`RPC: ${MONAD_CONFIG.RPC_URL}`);
    console.log('');
    console.log('⚠️  请确保：');
    console.log('   1. 已设置 PRIVATE_KEY 环境变量');
    console.log('   2. 钱包有足够的 Monad 测试币');
    console.log('   3. 已领取测试币：https://testnet.monad.xyz/');
    return;
  }

  const agenticWallet = new AgenticWallet({
    ownerWallet: wallet,
    userId: process.env.USER_ID || `user-${wallet.address.slice(0, 8)}`,
  });

  switch (command) {
    case 'init': {
      break;
    }

    case 'register-agent': {
      const nameIdx = args.indexOf('--name');
      const name = nameIdx !== -1 ? args[nameIdx + 1] : 'default-agent';

      const typeIdx = args.indexOf('--type');
      const type = typeIdx !== -1 ? args[typeIdx + 1] : 'assistant';

      const maxIdx = args.indexOf('--max');
      const maxSinglePayment = maxIdx !== -1 ? parseFloat(args[maxIdx + 1]) : undefined;

      const dailyIdx = args.indexOf('--daily');
      const dailyBudget = dailyIdx !== -1 ? parseFloat(args[dailyIdx + 1]) : undefined;

      const result = agenticWallet.registerAgent(name, type as any, {
        policy: {
          maxSinglePayment,
          dailyBudget,
        },
      });

      log('✅ Agent 注册成功');
      log('');
      log(`Agent ID: ${result.agent.id}`);
      log(`Agent 名称：${result.agent.name}`);
      log(`Session Key: ${result.sessionKey.publicKey}`);
      log(`Session 过期：${result.sessionKey.expiresAt}`);
      log('');
      log('策略配置:');
      log(`  - 单笔上限：$${result.policy.maxSinglePayment}`);
      log(`  - 每日预算：$${result.policy.dailyBudget}`);
      log(`  - 人工确认阈值：$${result.policy.requireHumanAbove}`);
      break;
    }

    case 'request-payment': {
      const sessionIdx = args.indexOf('--session');
      const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : '';

      const toIdx = args.indexOf('--to');
      const recipient = toIdx !== -1 ? args[toIdx + 1] : '';

      const amountIdx = args.indexOf('--amount');
      const amountEth = amountIdx !== -1 ? parseFloat(args[amountIdx + 1]) : 0;

      const reasonIdx = args.indexOf('--reason');
      const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : '';

      if (!sessionId || !recipient || !amountEth || !reason) {
        console.error('❌ 错误：缺少必要参数');
        console.error('用法：agentic-pay request-payment --session <id> --to <address> --amount <eth> --reason <reason>');
        process.exit(1);
      }

      log('📤 请求支付...');
      log('');

      const result = await agenticWallet.requestPayment(
        sessionId,
        recipient,
        amountEth,
        reason
      );

      if (result.success) {
        log('✅ 支付成功!');
        log(`TX Hash: ${result.result?.txHash}`);
        if (result.auditLogId) {
          log(`审计 ID: ${result.auditLogId}`);
        }
      } else if (result.requiresHumanApproval) {
        log('⚠️  需要人工确认');
        log(`原因：${result.error}`);
        if (result.auditLogId) {
          log(`审计 ID: ${result.auditLogId}`);
          log('使用以下命令批准:');
          log(`  agentic-pay approve --log ${result.auditLogId}`);
        }
      } else {
        log('❌ 支付失败');
        log(`原因：${result.error}`);
      }
      break;
    }

    case 'approve': {
      const logIdx = args.indexOf('--log');
      const auditLogId = logIdx !== -1 ? args[logIdx + 1] : '';

      const reject = args.includes('--reject');

      if (!auditLogId) {
        console.error('❌ 错误：请提供审计日志 ID');
        console.error('用法：agentic-pay approve --log <audit_log_id>');
        process.exit(1);
      }

      log(`${reject ? '❌ 拒绝' : '✅ 批准'} 支付...`);

      const result = await agenticWallet.approvePayment(auditLogId, !reject);

      if (result.success) {
        log('✅ 已批准并执行支付');
        if (result.txHash) {
          log(`TX Hash: ${result.txHash}`);
        }
      } else {
        log(`❌ 失败：${result.error}`);
      }
      break;
    }

    case 'revoke': {
      const agentIdx = args.indexOf('--agent');
      const agentId = agentIdx !== -1 ? args[agentIdx + 1] : '';

      const reasonIdx = args.indexOf('--reason');
      const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : 'User requested';

      if (!agentId) {
        console.error('❌ 错误：请提供 Agent ID');
        process.exit(1);
      }

      const success = agenticWallet.revokeAgent(agentId, reason);

      if (success) {
        log(`✅ 已撤销 Agent ${agentId} 的所有权限`);
        log(`原因：${reason}`);
      } else {
        log(`❌ 撤销失败：Agent ${agentId} 不存在`);
      }
      break;
    }

    case 'sessions': {
      const agentIdx = args.indexOf('--agent');
      const agentId = agentIdx !== -1 ? args[agentIdx + 1] : '';

      if (!agentId) {
        console.error('❌ 错误：请提供 Agent ID');
        process.exit(1);
      }

      const sessions = agenticWallet.getActiveSessions(agentId);

      if (sessions.length === 0) {
        log(`Agent ${agentId} 没有活跃会话`);
      } else {
        log(`Agent ${agentId} 的活跃会话:`);
        log('');
        sessions.forEach((s, i) => {
          log(`${i + 1}. ${s.id}`);
          log(`   公钥：${s.publicKey}`);
          log(`   过期：${s.expiresAt}`);
          log(`   已用：$${s.totalSpent} (${s.transactionCount} 笔)`);
          log('');
        });
      }
      break;
    }

    case 'policies': {
      const policies = agenticWallet.listPolicies();

      log('当前策略:');
      log('');
      policies.forEach((p, i) => {
        log(`${i + 1}. ${p.name}`);
        log(`   ID: ${p.id}`);
        log(`   单笔上限：$${p.maxSinglePayment ?? '无'}`);
        log(`   每日预算：$${p.dailyBudget ?? '无'}`);
        log(`   人工确认：>$${p.requireHumanAbove ?? '无'}`);
        log('');
      });
      break;
    }

    case 'logs': {
      const agentIdx = args.indexOf('--agent');
      const agentId = agentIdx !== -1 ? args[agentIdx + 1] : undefined;

      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 10;

      const logs = agenticWallet.getAuditLogs({ agentId, limit });

      if (logs.length === 0) {
        log('没有审计日志');
      } else {
        log(`最近的审计日志 (${logs.length} 条):`);
        log('');
        logs.forEach((l, i) => {
          const status = l.paymentResult.success ? '✅' : '❌';
          log(`${i + 1}. ${status} ${l.paymentRequest.reason}`);
          log(`   时间：${l.timestamp}`);
          log(`   Agent: ${l.agentId}`);
          log(`   金额：${l.paymentRequest.amount.toString()} wei`);
          log(`   风险：${l.riskLevel}`);
          log(`   ID: ${l.id}`);
          log('');
        });
      }
      break;
    }

    case 'receipt': {
      const logIdx = args.indexOf('--log');
      const auditLogId = logIdx !== -1 ? args[logIdx + 1] : '';

      if (!auditLogId) {
        console.error('❌ 错误：请提供审计日志 ID');
        process.exit(1);
      }

      const receipt = agenticWallet.generateReceipt(auditLogId);
      log(receipt);
      break;
    }

    case 'stats': {
      const stats = agenticWallet.getStats();

      log('📊 钱包统计');
      log('');
      log(`总支付数：${stats.totalPayments}`);
      log(`成功：${stats.successfulPayments}`);
      log(`失败：${stats.failedPayments}`);
      log(`总量：${stats.totalVolume}`);
      log(`活跃 Agent 数：${stats.activeAgents}`);
      log(`活跃会话数：${stats.activeSessions}`);
      break;
    }

    default:
      console.error(`❌ 未知命令：${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 错误:', error instanceof Error ? error.message : error);
  process.exit(1);
});
