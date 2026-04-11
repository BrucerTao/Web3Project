/**
 * 本地 Hardhat 网络集成测试
 *
 * 使用 Hardhat Network 模拟完整的链上支付流程
 * 无需真实私钥和测试币
 */

import { ethers } from "hardhat";
import { Wallet, parseEther, formatEther } from "ethers";
import { AgenticWallet } from "./src/agentic-wallet.js";
import { MONAD_CONFIG } from "./src/types.js";

async function runHardhatTest() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Hardhat 本地网络集成测试                              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // 获取 Hardhat 提供的测试账户
  const [deployer, recipient] = await ethers.getSigners();
  console.log(`📍 部署账户：${deployer.address}`);
  console.log(`📍 收款账户：${recipient.address}`);

  // 部署 Mock MPP 合约
  console.log("");
  console.log("📦 部署 Mock MPP 合约...");
  const MockMPPFactory = await ethers.getContractFactory("MockMPP");
  const mockMPP = await MockMPPFactory.deploy();
  await mockMPP.waitForDeployment();
  const mppAddress = await mockMPP.getAddress();
  console.log(`✅ MPP 合约：${mppAddress}`);

  // 创建测试钱包（使用 Hardhat 账户的私钥）
  const testWallet = new Wallet(
    deployer.privateKey,
    ethers.provider
  );

  console.log("");
  console.log("💰 钱包余额：" + formatEther(await ethers.provider.getBalance(testWallet.address)) + " ETH");

  // 初始化 Agentic Wallet
  const agenticWallet = new AgenticWallet({
    ownerWallet: testWallet,
    userId: "hardhat-test-user",
    rpcUrl: "http://127.0.0.1:8545", // Hardhat 默认端口
    mppContractAddress: mppAddress,
  });

  // ========== 测试 1: 注册 Agent ==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 1: 注册 Agent");
  console.log("══════════════════════════════════════════════════════════");

  const { agent, sessionKey, policy } = agenticWallet.registerAgent(
    "Hardhat Test Agent",
    "assistant",
    {
      policy: {
        maxSinglePayment: 0.01 * 2000, // $20
        dailyBudget: 0.05 * 2000,      // $100
        requireHumanAbove: 0.005 * 2000, // $10
      },
      sessionTtlHours: 24,
    }
  );

  console.log(`✅ Agent ID: ${agent.id}`);
  console.log(`✅ Session Key: ${sessionKey.publicKey}`);

  // ========== 测试 2: 小额支付（自动批准）==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 2: 小额支付 - 自动批准");
  console.log("══════════════════════════════════════════════════════════");

  const payment1Result = await agenticWallet.requestPayment(
    sessionKey.id,
    recipient.address,
    0.001, // 0.001 ETH = ~$2 (小于$10 阈值，自动批准)
    "Test API payment",
    { taskId: "hardhat-test-1" }
  );

  if (payment1Result.success) {
    console.log("✅ 支付成功！");
    console.log(`   TX Hash: ${payment1Result.result?.txHash}`);
    console.log(`   审计 ID: ${payment1Result.auditLogId}`);
  } else if (payment1Result.requiresHumanApproval) {
    console.log("⏳ 需要人工确认");
    console.log(`   原因：${payment1Result.error}`);
  } else {
    console.log(`❌ 支付失败：${payment1Result.error}`);
  }

  // ========== 测试 3: 需要人工确认的支付 ==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 3: 中等金额 - 需要人工确认");
  console.log("══════════════════════════════════════════════════════════");

  const payment2Result = await agenticWallet.requestPayment(
    sessionKey.id,
    recipient.address,
    0.008, // 0.008 ETH = ~$16 (超过$10 阈值，需要确认)
    "Premium service",
    { taskId: "hardhat-test-2" }
  );

  if (payment2Result.requiresHumanApproval) {
    console.log("⏳ 需要人工确认（预期行为）");
    console.log(`   审计 ID: ${payment2Result.auditLogId}`);
    console.log("");
    console.log("   模拟用户批准...");

    const approveResult = await agenticWallet.approvePayment(
      payment2Result.auditLogId!,
      true
    );

    if (approveResult.success) {
      console.log("   ✅ 已批准并执行");
      console.log(`   TX Hash: ${approveResult.txHash}`);
    } else {
      console.log(`   ❌ 执行失败：${approveResult.error}`);
    }
  }

  // ========== 测试 4: 超过限额的支付（应该被拒绝）==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 4: 大额支付 - 策略拒绝");
  console.log("══════════════════════════════════════════════════════════");

  const payment3Result = await agenticWallet.requestPayment(
    sessionKey.id,
    recipient.address,
    0.02, // 0.02 ETH = ~$40 (超过$20 单笔上限)
    "Large payment test",
    { taskId: "hardhat-test-3" }
  );

  if (!payment3Result.success && payment3Result.error?.includes("Policy check failed")) {
    console.log("✅ 策略正确拒绝了支付（预期行为）");
    console.log(`   原因：${payment3Result.error}`);
  } else {
    console.log(`⚠️  支付未被拒绝：${payment3Result.success ? "成功" : "失败"}`);
  }

  // ========== 测试 5: 查看审计日志 ==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 5: 查看审计日志");
  console.log("══════════════════════════════════════════════════════════");

  const logs = agenticWallet.getAuditLogs({ limit: 10 });
  console.log(`共有 ${logs.length} 条审计记录:`);
  console.log("");

  logs.forEach((log: any, i: number) => {
    const status = log.paymentResult.success
      ? "✅"
      : log.paymentResult.requiredHumanApproval
      ? "⏳"
      : "❌";
    console.log(`${i + 1}. ${status} ${log.paymentRequest.reason}`);
    console.log(`   金额：${log.paymentRequest.amount.toString()} wei`);
    console.log(`   风险：${log.riskLevel}`);
    console.log(`   TX: ${log.paymentResult.txHash || "N/A"}`);
    console.log("");
  });

  // ========== 测试 6: 统计信息 ==========
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 6: 统计信息");
  console.log("══════════════════════════════════════════════════════════");

  const stats = agenticWallet.getStats();
  console.log(`总支付数：${stats.totalPayments}`);
  console.log(`成功：${stats.successfulPayments}`);
  console.log(`失败：${stats.failedPayments}`);
  console.log(`总量：${stats.totalVolume}`);

  // ========== 测试 7: 撤销 Agent ==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 7: 撤销 Agent 权限");
  console.log("══════════════════════════════════════════════════════════");

  const revokeSuccess = agenticWallet.revokeAgent(agent.id, "测试完成");
  if (revokeSuccess) {
    console.log(`✅ Agent ${agent.id} 已撤销`);

    // 尝试使用已撤销的 Session
    const afterRevoke = await agenticWallet.requestPayment(
      sessionKey.id,
      recipient.address,
      0.001,
      "After revoke test"
    );
    if (!afterRevoke.success) {
      console.log(`✅ Session 已失效：${afterRevoke.error}`);
    }
  }

  // ========== 完成 ==========
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   测试完成 ✅                                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
}

runHardhatTest().catch(console.error);
