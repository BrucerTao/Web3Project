/**
 * Monad Agentic Payment - Core Types
 *
 * AI Agent 原生的安全支付系统类型定义
 */

import { z } from 'zod';

// ==================== 链配置 ====================
export const MONAD_CONFIG = {
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  CHAIN_ID: 10143,
  EXPLORER_URL: 'https://testnet.monadscan.com',
} as const;

// ==================== 策略引擎类型 ====================
export interface Policy {
  id: string;
  name: string;
  description?: string;

  // 额度限制
  maxSinglePayment?: number; // 单笔上限 (USD)
  dailyBudget?: number;      // 每日预算 (USD)
  weeklyBudget?: number;     // 每周预算 (USD)

  // 白名单/黑名单
  allowedRecipients?: string[];  // 允许的地址
  allowedContracts?: string[];   // 允许调用的合约
  allowedTokens?: string[];      // 允许使用的 Token
  blockedRecipients?: string[];  // 黑名单地址

  // 方法级限制
  allowedMethods?: string[];     // 允许的支付类型
  blockedMethods?: string[];     // 禁止的支付类型

  // 审批规则
  requireHumanAbove?: number;    // 超过此额度需要人工确认 (USD)

  // 有效期
  validFrom?: Date;
  validUntil?: Date;

  // 关联的 Agent
  agentIds?: string[];

  createdAt: Date;
  updatedAt: Date;
}

// ==================== Session Key 类型 ====================
export interface SessionKey {
  id: string;
  publicKey: string;
  privateKey?: string; // 仅当创建时返回，之后不存储

  // 权限边界
  policyId: string;

  // 有效期
  expiresAt: Date;

  // 使用统计
  totalSpent: number;
  transactionCount: number;

  // 状态
  isActive: boolean;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;

  // 关联信息
  agentId: string;
  userId: string;
  createdAt: Date;
}

// ==================== Agent 类型 ====================
export interface Agent {
  id: string;
  name: string;
  type: 'assistant' | 'automation' | 'service';
  description?: string;

  // 关联的 Session Keys
  sessionKeys: string[];

  createdAt: Date;
}

// ==================== 支付请求类型 ====================
export interface PaymentRequest {
  id: string;

  // 支付目标
  recipient: string;
  amount: bigint;
  token?: string; // 默认为 MON

  // 上下文
  taskId?: string;
  agentId: string;
  userId: string;
  reason: string;
  category?: string;

  // 额外数据
  data?: string; // 合约调用数据

  createdAt: Date;
}

// ==================== 支付结果类型 ====================
export interface PaymentResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  error?: string;

  // 策略命中信息
  policyId?: string;
  policyChecks: PolicyCheckResult;

  // 审批信息
  requiredHumanApproval: boolean;
  humanApproved?: boolean;

  // AI 自动审批信息
  autoAudited?: boolean;
  aiRiskMsg?: string;

  timestamp: Date;
}

// ==================== 策略检查结果 ====================
export interface PolicyCheckResult {
  passed: boolean;
  policyId?: string;
  checks: {
    singleLimit: { passed: boolean; limit?: number; amount: number };
    dailyBudget: { passed: boolean; budget?: number; spent: number; amount: number };
    recipientWhitelist: { passed: boolean; isWhitelisted?: boolean };
    methodAllowed: { passed: boolean; method?: string };
    humanApproval: { required: boolean; approved?: boolean; threshold?: number; amount: number };
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
}

// ==================== 审计日志类型 ====================
export interface AuditLog {
  id: string;

  // 参与方
  userId: string;
  agentId: string;
  sessionId?: string;

  // 支付详情
  paymentRequest: PaymentRequest;
  paymentResult: PaymentResult;

  // 策略信息
  policyId: string;
  policyChecks: PolicyCheckResult;

  // 上下文
  taskContext?: string;
  conversationId?: string;

  // 风险评级
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];

  timestamp: Date;
}

// ==================== Zod Schemas ====================
export const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  maxSinglePayment: z.number().optional(),
  dailyBudget: z.number().optional(),
  weeklyBudget: z.number().optional(),
  allowedRecipients: z.array(z.string()).optional(),
  allowedContracts: z.array(z.string()).optional(),
  allowedTokens: z.array(z.string()).optional(),
  blockedRecipients: z.array(z.string()).optional(),
  allowedMethods: z.array(z.string()).optional(),
  blockedMethods: z.array(z.string()).optional(),
  requireHumanAbove: z.number().optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
  agentIds: z.array(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SessionKeySchema = z.object({
  id: z.string(),
  publicKey: z.string(),
  privateKey: z.string().optional(),
  policyId: z.string(),
  expiresAt: z.date(),
  totalSpent: z.number(),
  transactionCount: z.number(),
  isActive: z.boolean(),
  isRevoked: z.boolean(),
  revokedAt: z.date().optional(),
  revokedReason: z.string().optional(),
  agentId: z.string(),
  userId: z.string(),
  createdAt: z.date(),
});

export const PaymentRequestSchema = z.object({
  id: z.string(),
  recipient: z.string(),
  amount: z.bigint(),
  token: z.string().optional(),
  taskId: z.string().optional(),
  agentId: z.string(),
  userId: z.string(),
  reason: z.string(),
  category: z.string().optional(),
  data: z.string().optional(),
  createdAt: z.date(),
});

// ==================== 工具函数 ====================
export function parseEthAmount(eth: string): bigint {
  return BigInt(Math.floor(parseFloat(eth) * 1e18));
}

export function formatEthAmount(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}

export function isAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
