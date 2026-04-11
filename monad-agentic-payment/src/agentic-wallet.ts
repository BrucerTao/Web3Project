/**
 * AgenticWallet - AI Agent 原生的安全钱包
 *
 * 整合所有核心模块，提供统一的钱包接口：
 * - Policy Engine: 策略验证
 * - Session Key Manager: 会话密钥管理
 * - Payment Executor: 支付执行
 * - Audit Logger: 审计日志
 */

import { Wallet } from 'ethers';
import {
  Policy,
  SessionKey,
  Agent,
  PaymentRequest,
  PaymentResult,
  MONAD_CONFIG,
  parseEthAmount,
  formatEthAmount,
} from './types.js';
import { PolicyEngine } from './policy-engine.js';
import { SessionKeyManager } from './session-key-manager.js';
import { PaymentExecutor } from './payment-executor.js';
import { AuditLogger } from './audit-logger.js';

export interface AgenticWalletConfig {
  // 用户主钱包（不可直接使用，仅用于部署/授权）
  ownerWallet: Wallet;

  // 可选：MPP 合约地址
  mppContractAddress?: string;

  // 可选：自定义 RPC
  rpcUrl?: string;

  // 可选：用户 ID
  userId?: string;

  // 可选：审计日志数据目录（默认 ./data）
  dataDir?: string;
}

export interface CreateAgentResult {
  agent: Agent;
  sessionKey: SessionKey;
  policy: Policy;
}

export interface PaymentContext {
  taskId?: string;
  conversationId?: string;
  description?: string;
}

export class AgenticWallet {
  private config: AgenticWalletConfig;
  private policyEngine: PolicyEngine;
  private sessionKeyManager: SessionKeyManager;
  private paymentExecutor: PaymentExecutor;
  private auditLogger: AuditLogger;

  private userId: string;
  private walletAddress: string;

  constructor(config: AgenticWalletConfig) {
    this.config = config;
    this.userId = config.userId || `user-${Date.now()}`;
    this.walletAddress = config.ownerWallet.address;

    // 初始化各模块
    this.policyEngine = new PolicyEngine();
    this.sessionKeyManager = new SessionKeyManager();
    this.paymentExecutor = new PaymentExecutor(
      this.policyEngine,
      config.rpcUrl || MONAD_CONFIG.RPC_URL,
      config.mppContractAddress
    );
    this.auditLogger = new AuditLogger({
      dataDir: config.dataDir,
      walletAddress: this.walletAddress,
    });
  }

  /**
   * 注册一个新的 Agent 并为其创建 Session Key
   */
  registerAgent(
    agentName: string,
    agentType: 'assistant' | 'automation' | 'service' = 'assistant',
    options?: {
      policy?: Partial<Policy>;
      sessionTtlHours?: number;
      description?: string;
    }
  ): CreateAgentResult {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. 创建 Agent
    const agent: Agent = {
      id: agentId,
      name: agentName,
      type: agentType,
      description: options?.description,
      sessionKeys: [],
      createdAt: new Date(),
    };
    this.sessionKeyManager.registerAgent(agent);

    // 2. 创建默认策略
    const policy = PolicyEngine.createDefaultPolicy(agentId);
    if (options?.policy) {
      Object.assign(policy, options.policy);
    }
    this.policyEngine.addPolicy(policy);

    // 3. 创建 Session Key
    const sessionKey = this.sessionKeyManager.createSessionKey(
      agentId,
      this.userId,
      policy.id,
      {
        ttlHours: options?.sessionTtlHours ?? 24,
      }
    );

    console.log(`[Wallet] Registered agent: ${agentName} (${agentId})`);
    console.log(`[Wallet] Session Key: ${sessionKey.publicKey}`);
    console.log(`[Wallet] Policy: ${policy.name}`);

    return { agent, sessionKey, policy };
  }

  /**
   * Agent 请求支付
   */
  async requestPayment(
    sessionId: string,
    recipient: string,
    amountEth: number,
    reason: string,
    context?: PaymentContext
  ): Promise<{
    success: boolean;
    result?: PaymentResult;
    auditLogId?: string;
    requiresHumanApproval?: boolean;
    error?: string;
  }> {
    // 1. 验证 Session Key
    const validation = this.sessionKeyManager.validateSessionKey(sessionId);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid session: ${validation.reason}`,
      };
    }

    const sessionKey = this.sessionKeyManager.getSessionKey(sessionId)!;

    // 2. 获取策略
    const policy = this.policyEngine.getPolicy(sessionKey.policyId);
    if (!policy) {
      return {
        success: false,
        error: 'Policy not found',
      };
    }

    // 3. 创建支付请求
    const paymentRequest: PaymentRequest = {
      id: `payment-${Date.now()}`,
      recipient,
      amount: parseEthAmount(amountEth.toString()),
      agentId: sessionKey.agentId,
      userId: this.userId,
      reason,
      taskId: context?.taskId,
      category: 'transfer',
      createdAt: new Date(),
    };

    // 4. 策略检查
    const policyCheckResult = await this.policyEngine.checkPayment(
      paymentRequest,
      policy,
      sessionKey
    );

    // 5. 如果策略检查失败，记录审计日志并返回
    if (!policyCheckResult.passed) {
      const auditLog = this.auditLogger.log(
        this.userId,
        sessionKey.agentId,
        paymentRequest,
        {
          success: false,
          policyChecks: policyCheckResult,
          requiredHumanApproval: false,
          error: 'Policy check failed',
          timestamp: new Date(),
        },
        policy.id,
        policyCheckResult,
        {
          sessionId: sessionKey.id,
          taskContext: context?.description,
          conversationId: context?.conversationId,
        }
      );

      return {
        success: false,
        requiresHumanApproval: false, // 策略失败，不是需要人工确认
        error: `Policy check failed: ${policyCheckResult.riskFactors.join(', ')}`,
        auditLogId: auditLog.id,
      };
    }

    // 6. 如果需要人工确认
    if (policyCheckResult.checks.humanApproval.required) {
      const auditLog = this.auditLogger.log(
        this.userId,
        sessionKey.agentId,
        paymentRequest,
        {
          success: false,
          policyChecks: policyCheckResult,
          requiredHumanApproval: true,
          timestamp: new Date(),
        },
        policy.id,
        policyCheckResult,
        {
          sessionId: sessionKey.id,
          taskContext: context?.description,
          conversationId: context?.conversationId,
        }
      );

      return {
        success: false,
        requiresHumanApproval: true,
        error: `Requires human approval (>$${policy.requireHumanAbove})`,
        auditLogId: auditLog.id,
      };
    }

    // 7. 执行支付
    const paymentResult = await this.paymentExecutor.executePayment(
      paymentRequest,
      this.config.ownerWallet,
      policyCheckResult
    );

    // 8. 更新 Session Key 使用统计
    if (paymentResult.success) {
      const amountUSD = this.weiToUSD(paymentRequest.amount);
      this.sessionKeyManager.updateUsage(sessionId, amountUSD);
    }

    // 9. 记录审计日志
    const auditLog = this.auditLogger.log(
      this.userId,
      sessionKey.agentId,
      paymentRequest,
      paymentResult,
      policy.id,
      policyCheckResult,
      {
        sessionId: sessionKey.id,
        taskContext: context?.description,
        conversationId: context?.conversationId,
      }
    );

    return {
      success: paymentResult.success,
      result: paymentResult,
      auditLogId: auditLog.id,
    };
  }

  /**
   * 人工批准支付（用于超过阈值的支付）
   */
  async approvePayment(
    auditLogId: string,
    approved: boolean
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const auditLog = this.auditLogger.getLog(auditLogId);
    if (!auditLog) {
      return { success: false, error: 'Audit log not found' };
    }

    if (!auditLog.paymentResult.requiredHumanApproval) {
      return { success: false, error: 'Payment does not require human approval' };
    }

    if (!approved) {
      // 用户拒绝，更新审计日志为失败状态
      this.auditLogger.updateLog(auditLogId, {
        success: false,
        error: 'Rejected by user',
        requiredHumanApproval: false, // 已拒绝，不再需要人工审批
      });

      return {
        success: false,
        error: 'User rejected payment',
      };
    }

    // 创建修改后的策略检查结果，标记人工确认已完成
    const updatedPolicyChecks = {
      ...auditLog.policyChecks,
      checks: {
        ...auditLog.policyChecks.checks,
        humanApproval: {
          ...auditLog.policyChecks.checks.humanApproval,
          required: false, // 用户已批准，不再需要
          approved: true,
        },
      },
    };

    // 执行支付
    const paymentResult = await this.paymentExecutor.executePayment(
      auditLog.paymentRequest,
      this.config.ownerWallet,
      updatedPolicyChecks
    );

    // 更新审计日志（无论成功还是失败）
    auditLog.paymentResult = paymentResult;

    // 持久化到文件
    this.auditLogger.saveLogs();

    if (paymentResult.success) {
      return {
        success: true,
        txHash: paymentResult.txHash,
      };
    }

    return {
      success: false,
      error: paymentResult.error,
    };
  }

  /**
   * 撤销 Agent 的所有权限
   */
  revokeAgent(agentId: string, reason: string = 'User requested'): boolean {
    return this.sessionKeyManager.revokeAllAgentSessions(agentId, reason);
  }

  /**
   * 撤销单个 Session Key
   */
  revokeSession(sessionId: string, reason: string = 'User requested'): boolean {
    return this.sessionKeyManager.revokeSessionKey(sessionId, reason);
  }

  /**
   * 获取 Agent 的活跃会话
   */
  getActiveSessions(agentId: string): SessionKey[] {
    return this.sessionKeyManager.getActiveSessions(agentId);
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(options?: {
    limit?: number;
    userId?: string;
    agentId?: string;
  }): any[] {
    const limit = options?.limit ?? 50;

    if (options?.agentId) {
      return this.auditLogger.getLogsByAgent(options.agentId, limit);
    }
    if (options?.userId) {
      return this.auditLogger.getLogsByUser(options.userId, limit);
    }

    // 返回所有日志（不仅仅是成功的）
    const allLogs = this.auditLogger.exportLogs();
    return JSON.parse(allLogs).slice(-limit);
  }

  /**
   * 获取钱包统计信息
   */
  getStats(): {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalVolume: string;
    activeAgents: number;
    activeSessions: number;
  } {
    const auditStats = this.auditLogger.getStats();
    const sessionStats = this.sessionKeyManager.getUserStats(this.userId);

    return {
      totalPayments: auditStats.totalLogs,
      successfulPayments: auditStats.successfulPayments,
      failedPayments: auditStats.failedPayments,
      totalVolume: formatEthAmount(auditStats.totalVolume) + ' ETH',
      activeAgents: sessionStats.activeSessions,
      activeSessions: sessionStats.activeSessions,
    };
  }

  /**
   * 获取钱包余额
   */
  async getBalance(): Promise<string> {
    const balance = await this.paymentExecutor.getBalance(
      this.config.ownerWallet.address
    );
    return formatEthAmount(balance);
  }

  /**
   * 获取钱包地址
   */
  getAddress(): string {
    return this.config.ownerWallet.address;
  }

  /**
   * 导出审计日志
   */
  exportAuditLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.auditLogger.exportToCSV();
    }
    return this.auditLogger.exportLogs();
  }

  /**
   * 生成支付收据
   */
  generateReceipt(auditLogId: string): string {
    return this.auditLogger.generateReceipt(auditLogId);
  }

  /**
   * 获取策略列表
   */
  listPolicies(): Policy[] {
    return this.policyEngine.listPolicies();
  }

  /**
   * 更新策略
   */
  updatePolicy(
    policyId: string,
    updates: Partial<Policy>
  ): boolean {
    const policy = this.policyEngine.getPolicy(policyId);
    if (!policy) {
      return false;
    }

    Object.assign(policy, updates, { updatedAt: new Date() });
    this.policyEngine.addPolicy(policy);
    return true;
  }

  /**
   * 清理过期的 Session Keys
   */
  cleanupExpiredSessions(): number {
    return this.sessionKeyManager.cleanupExpiredSessions();
  }

  // ==================== 私有方法 ====================

  private weiToUSD(wei: bigint): number {
    const ethAmount = Number(wei) / 1e18;
    return ethAmount * 2000; // 假设 1 ETH = $2000
  }
}
