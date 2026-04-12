/**
 * Policy Engine - 策略引擎
 *
 * 负责验证支付请求是否符合配置的安全策略
 * 支持：额度限制、白名单、方法限制、风险评级
 */

import {
  Policy,
  PaymentRequest,
  PolicyCheckResult,
  SessionKey,
} from './types.js';

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private dailySpent: Map<string, { date: string; amount: number }> = new Map();

  /**
   * 添加策略
   */
  addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * 获取策略
   */
  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * 列出所有策略
   */
  listPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * 删除策略
   */
  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * 检查支付请求是否符合策略
   */
  async checkPayment(
    request: PaymentRequest,
    policy: Policy,
    sessionKey?: SessionKey,
    requireAllForAIReview: boolean = false  // AI 审批开启时，所有交易都需要人工审批
  ): Promise<PolicyCheckResult> {
    const checks: PolicyCheckResult['checks'] = {
      singleLimit: { passed: true, amount: this.weiToUSD(request.amount) },
      dailyBudget: { passed: true, spent: 0, amount: this.weiToUSD(request.amount) },
      recipientWhitelist: { passed: true },
      methodAllowed: { passed: true },
      humanApproval: { required: false, amount: this.weiToUSD(request.amount) },
    };

    const riskFactors: string[] = [];
    const amountUSD = this.weiToUSD(request.amount);

    // 1. 检查单笔限额
    if (policy.maxSinglePayment !== undefined) {
      checks.singleLimit.limit = policy.maxSinglePayment;
      if (amountUSD > policy.maxSinglePayment) {
        checks.singleLimit.passed = false;
        riskFactors.push(`Amount exceeds single payment limit ($${amountUSD} > $${policy.maxSinglePayment})`);
      }
    }

    // 2. 检查每日预算
    if (policy.dailyBudget !== undefined) {
      const today = new Date().toDateString();
      const spent = this.dailySpent.get(policy.id);

      if (spent && spent.date === today) {
        checks.dailyBudget.spent = spent.amount;
      } else {
        checks.dailyBudget.spent = 0;
      }

      if (checks.dailyBudget.spent + amountUSD > policy.dailyBudget) {
        checks.dailyBudget.passed = false;
        riskFactors.push(`Would exceed daily budget ($${checks.dailyBudget.spent + amountUSD} > $${policy.dailyBudget})`);
      }
    }

    // 3. 检查收款方白名单
    if (policy.allowedRecipients && policy.allowedRecipients.length > 0) {
      const isWhitelisted = policy.allowedRecipients.some(
        addr => addr.toLowerCase() === request.recipient.toLowerCase()
      );
      checks.recipientWhitelist.isWhitelisted = isWhitelisted;
      checks.recipientWhitelist.passed = isWhitelisted;

      if (!isWhitelisted) {
        riskFactors.push(`Recipient not in whitelist: ${request.recipient}`);
      }
    }

    // 4. 检查收款方黑名单
    if (policy.blockedRecipients && policy.blockedRecipients.length > 0) {
      const isBlocked = policy.blockedRecipients.some(
        addr => addr.toLowerCase() === request.recipient.toLowerCase()
      );
      if (isBlocked) {
        checks.recipientWhitelist.passed = false;
        riskFactors.push(`Recipient is blacklisted: ${request.recipient}`);
      }
    }

    // 5. 检查方法限制
    if (policy.blockedMethods && policy.blockedMethods.length > 0) {
      const method = request.category || 'transfer';
      if (policy.blockedMethods.includes(method)) {
        checks.methodAllowed.passed = false;
        checks.methodAllowed.method = method;
        riskFactors.push(`Method blocked: ${method}`);
      }
    }

    if (policy.allowedMethods && policy.allowedMethods.length > 0) {
      const method = request.category || 'transfer';
      if (!policy.allowedMethods.includes(method)) {
        checks.methodAllowed.passed = false;
        checks.methodAllowed.method = method;
        riskFactors.push(`Method not allowed: ${method}`);
      }
    }

    // 6. 检查是否需要人工确认
    if (policy.requireHumanAbove !== undefined) {
      checks.humanApproval.threshold = policy.requireHumanAbove;
      // 当 AI 审批开启时，所有交易都需要人工审批；否则按阈值判断
      if (requireAllForAIReview || amountUSD > policy.requireHumanAbove) {
        checks.humanApproval.required = true;
      }
      // 风险因素只按实际是否超过阈值添加（用于风险等级计算）
      if (amountUSD > policy.requireHumanAbove) {
        riskFactors.push(`Requires human approval ($${amountUSD} > $${policy.requireHumanAbove})`);
      }
    }

    // 7. 检查策略有效期
    const now = new Date();
    if (policy.validFrom && now < policy.validFrom) {
      riskFactors.push('Policy not yet valid');
    }
    if (policy.validUntil && now > policy.validUntil) {
      riskFactors.push('Policy has expired');
    }

    // 8. 检查 Session Key 状态
    if (sessionKey) {
      if (!sessionKey.isActive) {
        riskFactors.push('Session key is inactive');
      }
      if (sessionKey.isRevoked) {
        riskFactors.push(`Session key has been revoked: ${sessionKey.revokedReason}`);
      }
      if (new Date() > sessionKey.expiresAt) {
        riskFactors.push('Session key has expired');
      }
    }

    // 计算风险等级
    const riskLevel = this.calculateRiskLevel(riskFactors, amountUSD, policy);

    // 检查 Session Key 是否有效
    const sessionKeyValid = !sessionKey ||
      (!sessionKey.isRevoked && new Date() <= sessionKey.expiresAt);

    // 计算是否通过：
    // 严重问题（直接拒绝）：黑名单、策略过期、Session Key 无效/被撤销
    const hasCriticalIssues =
      riskFactors.some(f => f.includes('blacklist') || f.includes('blocked')) ||
      riskFactors.some(f => f.includes('expired')) ||
      !sessionKeyValid;

    if (hasCriticalIssues) {
      return {
        passed: false,
        policyId: policy.id,
        checks,
        riskLevel,
        riskFactors,
      };
    }

    // 非严重问题：单笔超额、每日预算超额、白名单外、需要人工审批
    // 如果需要人工审批，允许进入待审批流程（给人工或 AI 审批机会）
    if (checks.humanApproval.required) {
      return {
        passed: true,  // 需要人工审批，保持 passed=true 进入待审批列表
        policyId: policy.id,
        checks,
        riskLevel,
        riskFactors,
      };
    }

    // 不需要人工审批，按正常逻辑判断
    return {
      passed: checks.singleLimit.passed &&
              checks.dailyBudget.passed &&
              checks.recipientWhitelist.passed &&
              checks.methodAllowed.passed,
      policyId: policy.id,
      checks,
      riskLevel,
      riskFactors,
    };
  }

  /**
   * 记录支出（用于每日预算跟踪）
   */
  recordSpend(policyId: string, amountUSD: number): void {
    const today = new Date().toDateString();
    const current = this.dailySpent.get(policyId);

    if (current && current.date === today) {
      this.dailySpent.set(policyId, {
        date: today,
        amount: current.amount + amountUSD,
      });
    } else {
      this.dailySpent.set(policyId, {
        date: today,
        amount: amountUSD,
      });
    }
  }

  /**
   * 重置每日支出（应在每天开始时调用）
   */
  resetDailySpent(): void {
    this.dailySpent.clear();
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    riskFactors: string[],
    amountUSD: number,
    policy: Policy
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (riskFactors.some(f => f.includes('blacklist') || f.includes('blocked'))) {
      return 'critical';
    }

    if (riskFactors.some(f => f.includes('whitelist') || f.includes('expired'))) {
      return 'high';
    }

    if (amountUSD > (policy.maxSinglePayment || 1000) * 0.8) {
      return 'high';
    }

    if (riskFactors.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 将 wei 转换为近似 USD（简化版本，实际应使用价格预言机）
   */
  private weiToUSD(wei: bigint): number {
    // 假设 1 ETH = $2000（简化处理）
    const ethAmount = Number(wei) / 1e18;
    return ethAmount * 2000;
  }

  /**
   * 创建默认策略（适合大多数 Agent 场景）
   */
  static createDefaultPolicy(agentId: string): Policy {
    const now = new Date();
    return {
      id: `policy-${agentId}-${Date.now()}`,
      name: `Default Policy for ${agentId}`,
      description: '安全默认的 Agent 支付策略',
      maxSinglePayment: 10,      // 单笔 $10
      dailyBudget: 50,           // 每日 $50
      weeklyBudget: 200,         // 每周 $200
      requireHumanAbove: 5,      // 超过 $5 需要人工确认
      allowedMethods: ['transfer', 'api_payment', 'service_payment'],
      blockedMethods: ['personal_transfer', 'gambling', 'high_risk'],
      agentIds: [agentId],
      createdAt: now,
      updatedAt: now,
    };
  }
}
