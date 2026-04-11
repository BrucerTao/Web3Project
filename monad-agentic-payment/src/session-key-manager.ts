/**
 * Session Key Manager - 会话密钥管理
 *
 * 为 Agent 生成和管控临时密钥，支持：
 * - 受限权限（绑定策略）
 * - 自动过期
 * - 使用统计
 * - 紧急撤销
 */

import { Wallet } from 'ethers';
import {
  SessionKey,
  Agent,
  Policy,
} from './types.js';

export class SessionKeyManager {
  private sessionKeys: Map<string, SessionKey> = new Map();
  private agents: Map<string, Agent> = new Map();

  /**
   * 注册 Agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * 获取 Agent 信息
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 为 Agent 创建新的 Session Key
   */
  createSessionKey(
    agentId: string,
    userId: string,
    policyId: string,
    options?: {
      ttlHours?: number;        // 有效期（小时）
      privateKey?: string;      // 可选：使用已有私钥
    }
  ): SessionKey {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const ttlHours = options?.ttlHours ?? 24; // 默认 24 小时
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    // 生成新密钥对
    const wallet = options?.privateKey
      ? new Wallet(options.privateKey)
      : Wallet.createRandom();

    const sessionKey: SessionKey = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      publicKey: wallet.address,
      privateKey: wallet.privateKey, // 仅在此处返回，之后不存储
      policyId,
      expiresAt,
      totalSpent: 0,
      transactionCount: 0,
      isActive: true,
      isRevoked: false,
      agentId,
      userId,
      createdAt: now,
    };

    // 存储（不含私钥）
    this.sessionKeys.set(sessionKey.id, {
      ...sessionKey,
      privateKey: undefined,
    });

    // 更新 Agent 的 sessionKeys 列表
    agent.sessionKeys.push(sessionKey.id);

    return sessionKey;
  }

  /**
   * 获取 Session Key
   */
  getSessionKey(sessionId: string): SessionKey | undefined {
    return this.sessionKeys.get(sessionId);
  }

  /**
   * 验证 Session Key 是否有效
   */
  validateSessionKey(sessionId: string): { valid: boolean; reason?: string } {
    const sessionKey = this.sessionKeys.get(sessionId);

    if (!sessionKey) {
      return { valid: false, reason: 'Session key not found' };
    }

    if (!sessionKey.isActive) {
      return { valid: false, reason: 'Session key is inactive' };
    }

    if (sessionKey.isRevoked) {
      return { valid: false, reason: `Session key revoked: ${sessionKey.revokedReason}` };
    }

    if (new Date() > sessionKey.expiresAt) {
      return { valid: false, reason: 'Session key has expired' };
    }

    return { valid: true };
  }

  /**
   * 撤销 Session Key
   */
  revokeSessionKey(
    sessionId: string,
    reason: string = 'User requested revocation'
  ): boolean {
    const sessionKey = this.sessionKeys.get(sessionId);
    if (!sessionKey) {
      return false;
    }

    sessionKey.isRevoked = true;
    sessionKey.revokedAt = new Date();
    sessionKey.revokedReason = reason;
    sessionKey.isActive = false;

    this.sessionKeys.set(sessionId, sessionKey);
    return true;
  }

  /**
   * 撤销 Agent 的所有 Session Keys
   */
  revokeAllAgentSessions(agentId: string, reason: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    let revoked = 0;
    for (const sessionId of agent.sessionKeys) {
      if (this.revokeSessionKey(sessionId, reason)) {
        revoked++;
      }
    }

    return revoked > 0;
  }

  /**
   * 更新 Session Key 使用统计
   */
  updateUsage(sessionId: string, spentUSD: number): void {
    const sessionKey = this.sessionKeys.get(sessionId);
    if (sessionKey) {
      sessionKey.totalSpent += spentUSD;
      sessionKey.transactionCount += 1;
      this.sessionKeys.set(sessionId, sessionKey);
    }
  }

  /**
   * 获取 Agent 的所有活跃 Session Keys
   */
  getActiveSessions(agentId: string): SessionKey[] {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return [];
    }

    return agent.sessionKeys
      .map(id => this.sessionKeys.get(id))
      .filter((sk): sk is SessionKey =>
        sk !== undefined && sk.isActive && !sk.isRevoked && new Date() <= sk.expiresAt
      );
  }

  /**
   * 获取用户的 Session Keys 使用统计
   */
  getUserStats(userId: string): {
    totalSessions: number;
    activeSessions: number;
    revokedSessions: number;
    expiredSessions: number;
    totalSpent: number;
  } {
    const now = new Date();
    const userSessions = Array.from(this.sessionKeys.values()).filter(
      sk => sk.userId === userId
    );

    return {
      totalSessions: userSessions.length,
      activeSessions: userSessions.filter(
        sk => sk.isActive && !sk.isRevoked && sk.expiresAt > now
      ).length,
      revokedSessions: userSessions.filter(sk => sk.isRevoked).length,
      expiredSessions: userSessions.filter(
        sk => !sk.isRevoked && sk.expiresAt <= now
      ).length,
      totalSpent: userSessions.reduce((sum, sk) => sum + sk.totalSpent, 0),
    };
  }

  /**
   * 清理过期的 Session Keys
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, sessionKey] of this.sessionKeys.entries()) {
      if (!sessionKey.isRevoked && sessionKey.expiresAt <= now) {
        sessionKey.isActive = false;
        this.sessionKeys.set(id, sessionKey);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 导出 Session Key（用于备份或迁移）
   */
  exportSessionKey(sessionId: string): string | null {
    const sessionKey = this.sessionKeys.get(sessionId);
    if (!sessionKey || sessionKey.isRevoked) {
      return null;
    }
    return JSON.stringify({
      id: sessionKey.id,
      publicKey: sessionKey.publicKey,
      policyId: sessionKey.policyId,
      expiresAt: sessionKey.expiresAt.toISOString(),
      agentId: sessionKey.agentId,
      userId: sessionKey.userId,
    });
  }
}
