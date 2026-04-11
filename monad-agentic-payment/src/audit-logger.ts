/**
 * Audit Logger - 审计日志模块
 *
 * 记录所有支付活动的详细信息，支持：
 * - 结构化存储
 * - 查询和导出
 * - 可解释性（每笔支付的决策过程）
 */

import {
  AuditLog,
  PaymentRequest,
  PaymentResult,
  PolicyCheckResult,
} from './types.js';

export class AuditLogger {
  private logs: Map<string, AuditLog> = new Map();
  private logsByUser: Map<string, Set<string>> = new Map();
  private logsByAgent: Map<string, Set<string>> = new Map();
  private logsByTask: Map<string, Set<string>> = new Map();

  /**
   * 记录审计日志
   */
  log(
    userId: string,
    agentId: string,
    paymentRequest: PaymentRequest,
    paymentResult: PaymentResult,
    policyId: string,
    policyChecks: PolicyCheckResult,
    options?: {
      sessionId?: string;
      taskContext?: string;
      conversationId?: string;
    }
  ): AuditLog {
    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      agentId,
      sessionId: options?.sessionId,
      paymentRequest,
      paymentResult,
      policyId,
      policyChecks,
      taskContext: options?.taskContext,
      conversationId: options?.conversationId,
      riskLevel: policyChecks.riskLevel,
      riskFactors: policyChecks.riskFactors,
      timestamp: new Date(),
    };

    // 存储日志
    this.logs.set(auditLog.id, auditLog);

    // 建立索引
    this.indexByUser(userId, auditLog.id);
    this.indexByAgent(agentId, auditLog.id);
    if (paymentRequest.taskId) {
      this.indexByTask(paymentRequest.taskId, auditLog.id);
    }

    console.log(`[AUDIT] ${auditLog.id}: ${paymentResult.success ? 'SUCCESS' : 'FAILED'} - ${paymentRequest.reason}`);

    return auditLog;
  }

  /**
   * 获取审计日志
   */
  getLog(logId: string): AuditLog | undefined {
    return this.logs.get(logId);
  }

  /**
   * 按用户查询日志
   */
  getLogsByUser(userId: string, limit: number = 50): AuditLog[] {
    const logIds = this.logsByUser.get(userId);
    if (!logIds) {
      return [];
    }

    return Array.from(logIds)
      .slice(-limit)
      .map(id => this.logs.get(id))
      .filter((log): log is AuditLog => log !== undefined);
  }

  /**
   * 按 Agent 查询日志
   */
  getLogsByAgent(agentId: string, limit: number = 50): AuditLog[] {
    const logIds = this.logsByAgent.get(agentId);
    if (!logIds) {
      return [];
    }

    return Array.from(logIds)
      .slice(-limit)
      .map(id => this.logs.get(id))
      .filter((log): log is AuditLog => log !== undefined);
  }

  /**
   * 按任务查询日志
   */
  getLogsByTask(taskId: string, limit: number = 50): AuditLog[] {
    const logIds = this.logsByTask.get(taskId);
    if (!logIds) {
      return [];
    }

    return Array.from(logIds)
      .slice(-limit)
      .map(id => this.logs.get(id))
      .filter((log): log is AuditLog => log !== undefined);
  }

  /**
   * 查询成功的日志
   */
  getSuccessfulLogs(limit: number = 50): AuditLog[] {
    return Array.from(this.logs.values())
      .filter(log => log.paymentResult.success)
      .slice(-limit);
  }

  /**
   * 查询失败的日志
   */
  getFailedLogs(limit: number = 50): AuditLog[] {
    return Array.from(this.logs.values())
      .filter(log => !log.paymentResult.success)
      .slice(-limit);
  }

  /**
   * 查询高风险日志
   */
  getHighRiskLogs(limit: number = 50): AuditLog[] {
    return Array.from(this.logs.values())
      .filter(log => ['high', 'critical'].includes(log.riskLevel))
      .slice(-limit);
  }

  /**
   * 导出日志为 JSON
   */
  exportLogs(options?: {
    userId?: string;
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
  }): string {
    let logs = Array.from(this.logs.values());

    if (options?.userId) {
      logs = logs.filter(log => log.userId === options.userId);
    }
    if (options?.agentId) {
      logs = logs.filter(log => log.agentId === options.agentId);
    }
    if (options?.startDate) {
      logs = logs.filter(log => log.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      logs = logs.filter(log => log.timestamp <= options.endDate!);
    }

    // 自定义序列化 BigInt
    return JSON.stringify(logs, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, null, 2);
  }

  /**
   * 导出日志为 CSV
   */
  exportToCSV(options?: {
    userId?: string;
    agentId?: string;
  }): string {
    const logs = this.exportLogs(options);
    const parsedLogs = JSON.parse(logs);

    const headers = [
      'Timestamp',
      'Log ID',
      'User ID',
      'Agent ID',
      'Recipient',
      'Amount (wei)',
      'Reason',
      'Success',
      'TX Hash',
      'Risk Level',
      'Policy ID',
    ];

    const rows = parsedLogs.map((log: AuditLog) => [
      log.timestamp.toISOString(),
      log.id,
      log.userId,
      log.agentId,
      log.paymentRequest.recipient,
      log.paymentRequest.amount.toString(),
      log.paymentRequest.reason,
      log.paymentResult.success ? 'Yes' : 'No',
      log.paymentResult.txHash || '',
      log.riskLevel,
      log.policyId,
    ]);

    return [
      headers.join(','),
      ...rows.map((row: string[]) =>
        row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalLogs: number;
    successfulPayments: number;
    failedPayments: number;
    totalVolume: bigint;
    averageRiskLevel: string;
    logsByRiskLevel: Record<string, number>;
  } {
    const logs = Array.from(this.logs.values());
    const successful = logs.filter(log => log.paymentResult.success);
    const failed = logs.filter(log => !log.paymentResult.success);
    const totalVolume = logs.reduce(
      (sum, log) => sum + log.paymentRequest.amount,
      0n
    );

    const riskLevelCounts: Record<string, number> = {};
    logs.forEach(log => {
      riskLevelCounts[log.riskLevel] = (riskLevelCounts[log.riskLevel] || 0) + 1;
    });

    return {
      totalLogs: logs.length,
      successfulPayments: successful.length,
      failedPayments: failed.length,
      totalVolume,
      averageRiskLevel: this.calculateAverageRiskLevel(logs),
      logsByRiskLevel: riskLevelCounts,
    };
  }

  /**
   * 清除旧日志（保留最近 N 条）
   */
  pruneLogs(keepCount: number = 1000): number {
    const allLogs = Array.from(this.logs.entries()).sort(
      (a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime()
    );

    if (allLogs.length <= keepCount) {
      return 0;
    }

    const toRemove = allLogs.slice(keepCount);
    for (const [id, log] of toRemove) {
      this.logs.delete(id);
      this.removeFromIndex(log);
    }

    return toRemove.length;
  }

  /**
   * 生成支付收据（用于给用户的确认信息）
   */
  generateReceipt(logId: string): string {
    const log = this.logs.get(logId);
    if (!log) {
      return 'Log not found';
    }

    const receipt = `
╔══════════════════════════════════════════════════════════╗
║                  PAYMENT RECEIPT                          ║
╠══════════════════════════════════════════════════════════╣
║ Receipt ID: ${log.id.padEnd(44)}║
╠══════════════════════════════════════════════════════════╣
║ Status: ${log.paymentResult.success ? '✅ SUCCESS' : '❌ FAILED'.padEnd(49)}║
║                                                          ║
║ User: ${log.userId.padEnd(50)}║
║ Agent: ${log.agentId.padEnd(49)}║
║ Task: ${log.paymentRequest.taskId || 'N/A'.padEnd(50)}║
╠══════════════════════════════════════════════════════════╣
║ Recipient: ${log.paymentRequest.recipient.padEnd(45)}║
║ Amount: ${log.paymentRequest.amount.toString().padEnd(48)}wei
║ Reason: ${log.paymentRequest.reason.padEnd(48)}║
╠══════════════════════════════════════════════════════════╣
║ Risk Level: ${log.riskLevel.toUpperCase().padEnd(44)}║
║ Policy: ${log.policyId.padEnd(48)}║
╠══════════════════════════════════════════════════════════╣
║ TX Hash: ${log.paymentResult.txHash || 'N/A'.padEnd(48)}║
║ Time: ${log.timestamp.toISOString().padEnd(49)}║
╚══════════════════════════════════════════════════════════╝
`.trim();

    return receipt;
  }

  // ==================== 私有方法 ====================

  private indexByUser(userId: string, logId: string): void {
    if (!this.logsByUser.has(userId)) {
      this.logsByUser.set(userId, new Set());
    }
    this.logsByUser.get(userId)!.add(logId);
  }

  private indexByAgent(agentId: string, logId: string): void {
    if (!this.logsByAgent.has(agentId)) {
      this.logsByAgent.set(agentId, new Set());
    }
    this.logsByAgent.get(agentId)!.add(logId);
  }

  private indexByTask(taskId: string, logId: string): void {
    if (!this.logsByTask.has(taskId)) {
      this.logsByTask.set(taskId, new Set());
    }
    this.logsByTask.get(taskId)!.add(logId);
  }

  private removeFromIndex(log: AuditLog): void {
    this.logsByUser.get(log.userId)?.delete(log.id);
    this.logsByAgent.get(log.agentId)?.delete(log.id);
    if (log.paymentRequest.taskId) {
      this.logsByTask.get(log.paymentRequest.taskId)?.delete(log.id);
    }
  }

  private calculateAverageRiskLevel(logs: AuditLog[]): string {
    const riskScores: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const totalScore = logs.reduce(
      (sum, log) => sum + (riskScores[log.riskLevel] || 0),
      0
    );

    const avgScore = totalScore / logs.length || 0;

    if (avgScore >= 3.5) return 'critical';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }
}
