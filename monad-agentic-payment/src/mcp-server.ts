/**
 * MCP Server - Model Context Protocol 服务器
 *
 * 使 Agentic Wallet 可被 Claude Code、Cursor 等 AI Agent 环境直接调用
 */

import 'dotenv/config';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Wallet, ethers } from 'ethers';
import { AgenticWallet } from './agentic-wallet.js';
import { MONAD_CONFIG } from './types.js';
import {
  loadPrivateKeyFromEnv,
  isValidPrivateKey,
} from './wallet-crypto.js';

// 全局钱包实例（由环境变量初始化）
let agenticWallet: AgenticWallet | null = null;

/**
 * 自定义 JSON 序列化函数，处理 BigInt 类型
 */
function jsonStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, 2);
}

/**
 * 初始化钱包（从环境变量加载私钥）
 * 支持：
 * 1. ENCRYPTED_PRIVATE_KEY - 加密格式（推荐）
 * 2. PRIVATE_KEY / TEST_PRIVATE_KEY - 明文格式（向后兼容）
 */
async function initWallet(): Promise<AgenticWallet> {
  const { privateKey, isEncrypted } = await loadPrivateKeyFromEnv();

  if (!privateKey) {
    throw new Error(
      'PRIVATE_KEY, TEST_PRIVATE_KEY, or ENCRYPTED_PRIVATE_KEY environment variable is required'
    );
  }

  // 验证私钥格式
  if (!isValidPrivateKey(privateKey)) {
    throw new Error('Invalid private key format');
  }

  const rpcUrl = process.env.TEST_RPC_URL || MONAD_CONFIG.RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  // 清除内存中的私钥明文（仅保留 Wallet 实例）
  // Wallet 实例内部持有私钥用于签名，但不再以字符串形式存在

  const initMsg = isEncrypted ? '🔓 已解密私钥' : '📝 已加载明文私钥';
  console.error(`[MCP] ${initMsg}: ${wallet.address}`);
  console.error(`[MCP] RPC URL: ${rpcUrl}`);

  agenticWallet = new AgenticWallet({
    ownerWallet: wallet,
    userId: process.env.USER_ID || `user-${wallet.address.slice(0, 8)}`,
    rpcUrl: rpcUrl,
  });

  return agenticWallet;
}

/**
 * 创建 MCP Server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'agentic-wallet',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ==================== 注册可用工具 ====================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_wallet_info',
          description: '获取钱包基本信息（地址、余额、统计）',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'register_agent',
          description: '注册新的 Agent 并为其创建 Session Key 和策略',
          inputSchema: {
            type: 'object',
            properties: {
              agentName: {
                type: 'string',
                description: 'Agent 名称',
              },
              agentType: {
                type: 'string',
                enum: ['assistant', 'automation', 'service'],
                description: 'Agent 类型',
              },
              maxSinglePayment: {
                type: 'number',
                description: '单笔支付上限 (USD)',
              },
              dailyBudget: {
                type: 'number',
                description: '每日预算 (USD)',
              },
              sessionTtlHours: {
                type: 'number',
                description: 'Session Key 有效期 (小时)',
              },
            },
            required: ['agentName'],
          },
        },
        {
          name: 'request_payment',
          description: 'Agent 请求支付（自动进行策略检查）',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session Key ID',
              },
              recipient: {
                type: 'string',
                description: '收款方地址',
              },
              amountEth: {
                type: 'number',
                description: '支付金额 (ETH)',
              },
              reason: {
                type: 'string',
                description: '支付原因',
              },
              taskId: {
                type: 'string',
                description: '关联的任务 ID',
              },
            },
            required: ['sessionId', 'recipient', 'amountEth', 'reason'],
          },
        },
        {
          name: 'approve_payment',
          description: '人工批准需要确认的支付',
          inputSchema: {
            type: 'object',
            properties: {
              auditLogId: {
                type: 'string',
                description: '审计日志 ID',
              },
              approved: {
                type: 'boolean',
                description: '是否批准',
              },
            },
            required: ['auditLogId', 'approved'],
          },
        },
        {
          name: 'revoke_agent',
          description: '撤销 Agent 的所有权限',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'Agent ID',
              },
              reason: {
                type: 'string',
                description: '撤销原因',
              },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'list_sessions',
          description: '列出 Agent 的活跃会话',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'Agent ID',
              },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'list_policies',
          description: '列出所有策略',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_audit_logs',
          description: '获取审计日志',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: '按 Agent ID 过滤',
              },
              limit: {
                type: 'number',
                description: '返回数量限制',
              },
            },
          },
        },
        {
          name: 'generate_receipt',
          description: '生成支付收据',
          inputSchema: {
            type: 'object',
            properties: {
              auditLogId: {
                type: 'string',
                description: '审计日志 ID',
              },
            },
            required: ['auditLogId'],
          },
        },
      ],
    };
  });

  // ==================== 处理工具调用 ====================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      // 确保钱包已初始化
      if (!agenticWallet) {
        initWallet();
      }

      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_wallet_info': {
          const balance = await agenticWallet!.getBalance();
          const stats = agenticWallet!.getStats();
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify({
                  address: agenticWallet!.getAddress(),
                  balance: balance + ' ETH',
                  chainId: MONAD_CONFIG.CHAIN_ID,
                  stats,
                }),
              },
            ],
          };
        }

        case 'register_agent': {
          const result = agenticWallet!.registerAgent(
            args!.agentName as string,
            (args!.agentType as any) || 'assistant',
            {
              policy: {
                maxSinglePayment: args!.maxSinglePayment as number | undefined,
                dailyBudget: args!.dailyBudget as number | undefined,
              },
              sessionTtlHours: args!.sessionTtlHours as number | undefined,
            }
          );
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify({
                  agent: result.agent,
                  sessionKey: {
                    id: result.sessionKey.id,
                    publicKey: result.sessionKey.publicKey,
                    expiresAt: result.sessionKey.expiresAt,
                  },
                  policy: result.policy,
                }),
              },
            ],
          };
        }

        case 'request_payment': {
          const sessionId = args!.sessionId as string;
          const recipient = args!.recipient as string;
          const amountEth = args!.amountEth as number;
          const reason = args!.reason as string;
          const taskId = args!.taskId as string | undefined;

          console.error(`[MCP] request_payment: sessionId=${sessionId.slice(0, 10)}..., recipient=${recipient.slice(0, 10)}..., amountEth=${amountEth}`);

          const result = await agenticWallet!.requestPayment(
            sessionId,
            recipient,
            amountEth,
            reason,
            {
              taskId,
            }
          );

          console.error(`[MCP] request_payment result: success=${result.success}, requiresHumanApproval=${result.requiresHumanApproval}, error=${result.error || 'none'}`);

          return {
            content: [
              {
                type: 'text',
                text: jsonStringify(result),
              },
            ],
          };
        }

        case 'approve_payment': {
          const result = await agenticWallet!.approvePayment(
            args!.auditLogId as string,
            args!.approved as boolean
          );
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify(result),
              },
            ],
          };
        }

        case 'revoke_agent': {
          const success = agenticWallet!.revokeAgent(
            args!.agentId as string,
            args!.reason as string || 'User requested'
          );
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify({ success, agentId: args!.agentId }),
              },
            ],
          };
        }

        case 'list_sessions': {
          const sessions = agenticWallet!.getActiveSessions(
            args!.agentId as string
          );
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify(sessions),
              },
            ],
          };
        }

        case 'list_policies': {
          const policies = agenticWallet!.listPolicies();
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify(policies),
              },
            ],
          };
        }

        case 'get_audit_logs': {
          const logs = agenticWallet!.getAuditLogs({
            agentId: args!.agentId as string | undefined,
            limit: (args!.limit as number) || 50,
          });
          return {
            content: [
              {
                type: 'text',
                text: jsonStringify(logs),
              },
            ],
          };
        }

        case 'generate_receipt': {
          const receipt = agenticWallet!.generateReceipt(
            args!.auditLogId as string
          );
          return {
            content: [
              {
                type: 'text',
                text: receipt,
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: jsonStringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * 启动服务器
 */
async function main(): Promise<void> {
  console.error('[MCP] Starting Agentic Wallet MCP Server...');

  // 初始化钱包（可能需要用户输入密码解密）
  try {
    await initWallet();
  } catch (error) {
    console.error('[MCP] Failed to initialize wallet:', error);
    process.exit(1);
  }

  const server = createServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Server running on stdio');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
