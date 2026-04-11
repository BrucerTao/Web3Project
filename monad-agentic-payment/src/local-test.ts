/**
 * 本地测试脚本（无需 Hardhat）
 *
 * 使用 ethers.js Provider 直接测试支付流程
 * 可以连接：
 *   - Hardhat Network (npx hardhat node)
 *   - Foundry Anvil (anvil)
 *   - Ganache
 */

import { config } from "dotenv";
import { Wallet, JsonRpcProvider, parseEther, formatEther } from "ethers";
import { AgenticWallet } from "./agentic-wallet.js";

// 加载 .env 文件
config();

// 硬编码的测试用私钥（仅用于测试，不要用于生产！）
// 默认使用 Hardhat/Anvil 的标准账户
// 如果使用 Ganache，请使用 Ganache 提供的私钥
const ANVIL_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Anvil/Hardhat 账户 0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6e786908", // Anvil/Hardhat 账户 1
];

// Ganache 默认账户私钥
const GANACHE_PRIVATE_KEYS = [
  "0xf0ccfc07f4e6b1998669d53952c2d91e398d4b278c5c23f24938a1541e7cb7f9", // Ganache 账户 0
  "0x4b3299ff52ac1860dc06e17f1b8ce469fc309c4dfff07fa572115af40cba8b87", // Ganache 账户 1
];

// 从环境变量获取私钥（优先从 .env 读取）
function getTestPrivateKeys(): string[] {
  // 1. 优先使用环境变量（从 .env 加载）
  if (process.env.TEST_PRIVATE_KEY) {
    const keys = [process.env.TEST_PRIVATE_KEY];
    if (process.env.TEST_PRIVATE_KEY_2) {
      keys.push(process.env.TEST_PRIVATE_KEY_2);
    }
    return keys;
  }

  // 2. 其次使用环境变量 PRIVATE_KEY（通用配置）
  if (process.env.PRIVATE_KEY) {
    // 如果只有一个账户，第二个账户用随机生成的
    const keys = [process.env.PRIVATE_KEY];
    return keys;
  }

  // 3. 默认使用 Ganache 的私钥
  return GANACHE_PRIVATE_KEYS;
}

const TEST_PRIVATE_KEYS = getTestPrivateKeys();

const RPC_URL = process.env.TEST_RPC_URL || "http://127.0.0.1:8545";

async function runLocalTest() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   本地网络测试（Hardhat/Anvil/Ganache）                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // 检查是否能连接到本地节点
  const provider = new JsonRpcProvider(RPC_URL);

  try {
    await provider.getNetwork();
    console.log(`✅ 已连接到：${RPC_URL}`);
  } catch (error) {
    console.log("❌ 无法连接到本地节点");
    console.log("");
    console.log("请先启动本地节点：");
    console.log("  Hardhat: npx hardhat node");
    console.log("  Anvil:   anvil");
    console.log("  Ganache: ganache");
    console.log("");
    console.log("或者设置 TEST_RPC_URL 环境变量指向远程节点");
    process.exit(1);
  }

  // 获取测试账户
  const deployer = new Wallet(TEST_PRIVATE_KEYS[0], provider);

  // 如果有第二个私钥则使用，否则使用 Ganache 默认的第二个账户
  const recipientKey = TEST_PRIVATE_KEYS[1] || GANACHE_PRIVATE_KEYS[1];
  const recipient = new Wallet(recipientKey, provider);

  console.log(`📍 测试账户 0: ${deployer.address}`);
  console.log(`📍 收款账户 1: ${recipient.address}`);

  // 检查余额
  const balance = await provider.getBalance(deployer.address);
  console.log(`💰 账户余额：${formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("⚠️  账户余额为 0，请确保本地节点已正确初始化");
    process.exit(1);
  }

  // 初始化 Agentic Wallet
  const agenticWallet = new AgenticWallet({
    ownerWallet: deployer,
    userId: "local-test-user",
    rpcUrl: RPC_URL,
  });

  // ========== 测试 1: 注册 Agent ==========
  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("测试 1: 注册 Agent");
  console.log("══════════════════════════════════════════════════════════");

  const { agent, sessionKey, policy } = agenticWallet.registerAgent(
    "Local Test Agent",
    "assistant",
    {
      policy: {
        maxSinglePayment: 10,    // $10
        dailyBudget: 50,         // $50
        requireHumanAbove: 5,    // $5
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
    0.001, // ~$2 (小于$5 阈值，自动批准)
    "Test API payment",
    { taskId: "local-test-1" }
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
    0.004, // ~$8 (在$10 限额内，但超过$5 阈值，需要人工确认)
    "Premium service",
    { taskId: "local-test-2" }
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
    0.02, // ~$40 (超过$10 单笔上限)
    "Large payment test",
    { taskId: "local-test-3" }
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

runLocalTest().catch(console.error);
