/**
 * Agent 能力展示：HTTP + 静态页面
 * - 策略限额配置
 * - 模拟支付与人机审批
 * - 审计日志
 *
 * 支持两种模式：
 * 1. 启动时设置 PRIVATE_KEY：使用该私钥初始化钱包
 * 2. 不设置：前端可通过 POST /api/init 传入私钥或生成随机钱包
 */

import 'dotenv/config';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet, ethers, type JsonRpcProvider } from 'ethers';
import { AgenticWallet } from './agentic-wallet.js';
import { MONAD_CONFIG } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, '..', 'web');
const PREFERRED_PORT = Number(process.env.UI_PORT) || 3847;
const PORT_FALLBACK_MAX = 30;

interface ServerState {
  wallet: AgenticWallet | null;
  sessionId: string | null;
  agentId: string | null;
  policyId: string | null;
  rpcUrl: string;
  provider: JsonRpcProvider;
}

const rpcUrl = process.env.TEST_RPC_URL || MONAD_CONFIG.RPC_URL;
const provider = new ethers.JsonRpcProvider(rpcUrl);

// 初始状态为空，等待前端初始化
const state: ServerState = {
  wallet: null,
  sessionId: null,
  agentId: null,
  policyId: null,
  rpcUrl,
  provider,
};

// 如果启动时设置了 PRIVATE_KEY，则自动初始化
if (process.env.PRIVATE_KEY) {
  const ownerWallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const wallet = new AgenticWallet({
    ownerWallet,
    userId: 'ui-demo-user',
    rpcUrl,
    dataDir: './data',
  });

  const { agent, sessionKey, policy } = wallet.registerAgent(
    'Treasury Agent',
    'assistant',
    {
      policy: {
        maxSinglePayment: 10,
        dailyBudget: 50,
        weeklyBudget: 200,
        requireHumanAbove: 5,
      },
      sessionTtlHours: 24,
      description: 'Demo agent for UI console',
    }
  );

  state.wallet = wallet;
  state.sessionId = sessionKey.id;
  state.agentId = agent.id;
  state.policyId = policy.id;

  console.log('[ui-server] 已使用环境变量中的私钥初始化钱包');
  console.log(`  钱包地址：${ownerWallet.address}`);
  console.log(`  Agent ID: ${agent.id}`);
}

function json(
  res: http.ServerResponse,
  data: unknown,
  status = 200
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  // 自定义 JSON 序列化，处理 BigInt 类型
  const jsonStr = JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? value.toString() + 'n' : value
  );
  res.end(jsonStr);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(
  res: http.ServerResponse,
  filePath: string,
  contentType: string
): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function getPendingApprovals(): unknown[] {
  if (!state.wallet) return [];
  const logs = state.wallet.getAuditLogs({ limit: 200 }) as Array<{
    id: string;
    paymentResult: {
      requiredHumanApproval?: boolean;
      success: boolean;
      txHash?: string;
    };
  }>;
  return logs.filter(
    (log) =>
      log.paymentResult?.requiredHumanApproval &&
      !log.paymentResult.success &&
      !log.paymentResult.txHash
  );
}

function ensureInitialized(res: http.ServerResponse): boolean {
  if (!state.wallet || !state.sessionId || !state.agentId || !state.policyId) {
    json(res, {
      error: 'Wallet not initialized. Call POST /api/init first.',
      hint: 'Send { "privateKey": "0x..." } or { "generateRandom": true } to /api/init'
    }, 400);
    return false;
  }
  return true;
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<void> {
  const method = req.method || 'GET';

  // 初始化钱包 API
  if (method === 'POST' && pathname === '/api/init') {
    const raw = await readBody(req);
    let body: { privateKey?: string; generateRandom?: boolean };
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      json(res, { error: 'Invalid JSON' }, 400);
      return;
    }

    try {
      let ownerWallet: Wallet;
      if (body.privateKey) {
        ownerWallet = new Wallet(body.privateKey, provider);
      } else if (body.generateRandom !== false) {
        ownerWallet = Wallet.createRandom().connect(provider) as unknown as Wallet;
      } else {
        json(res, { error: 'Either privateKey or generateRandom must be provided' }, 400);
        return;
      }

      const wallet = new AgenticWallet({
        ownerWallet,
        userId: 'ui-demo-user',
        rpcUrl,
        dataDir: './data',
      });

      const { agent, sessionKey, policy } = wallet.registerAgent(
        'Treasury Agent',
        'assistant',
        {
          policy: {
            maxSinglePayment: 10,
            dailyBudget: 50,
            weeklyBudget: 200,
            requireHumanAbove: 5,
          },
          sessionTtlHours: 24,
          description: 'Demo agent for UI console',
        }
      );

      state.wallet = wallet;
      state.sessionId = sessionKey.id;
      state.agentId = agent.id;
      state.policyId = policy.id;

      json(res, {
        ok: true,
        walletAddress: ownerWallet.address,
        sessionId: sessionKey.id,
        agentId: agent.id,
        policyId: policy.id,
        message: body.privateKey ? '已使用传入的私钥初始化' : '已生成随机钱包',
      });
    } catch (e: any) {
      json(res, { error: e.message || 'Init failed' }, 400);
    }
    return;
  }

  // 获取初始化状态
  if (method === 'GET' && pathname === '/api/initialized') {
    json(res, {
      initialized: !!state.wallet,
      walletAddress: state.wallet?.getAddress() || null,
      rpcUrl,
      chainId: MONAD_CONFIG.CHAIN_ID,
    });
    return;
  }

  if (!ensureInitialized(res)) return;

  if (method === 'GET' && pathname === '/api/state') {
    const policies = state.wallet!.listPolicies();
    const policy = policies.find((p) => p.id === state.policyId);
    json(res, {
      chainId: MONAD_CONFIG.CHAIN_ID,
      rpcUrl: MONAD_CONFIG.RPC_URL,
      explorerUrl: MONAD_CONFIG.EXPLORER_URL,
      walletAddress: state.wallet!.getAddress(),
      sessionId: state.sessionId,
      agentId: state.agentId,
      policyId: state.policyId,
      policy: policy
        ? {
            id: policy.id,
            name: policy.name,
            maxSinglePayment: policy.maxSinglePayment,
            dailyBudget: policy.dailyBudget,
            weeklyBudget: policy.weeklyBudget,
            requireHumanAbove: policy.requireHumanAbove,
            updatedAt: policy.updatedAt,
          }
        : null,
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/stats') {
    json(res, state.wallet!.getStats());
    return;
  }

  if (method === 'GET' && pathname === '/api/audit') {
    const limit = Math.min(
      200,
      Number(new URL(req.url || '', 'http://localhost').searchParams.get('limit')) ||
        80
    );
    const logs = state.wallet!.getAuditLogs({ limit });
    json(res, { logs });
    return;
  }

  if (method === 'GET' && pathname === '/api/pending') {
    json(res, { items: getPendingApprovals() });
    return;
  }

  if (method === 'PATCH' && pathname === '/api/policy') {
    const raw = await readBody(req);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      json(res, { error: 'Invalid JSON' }, 400);
      return;
    }

    const updates: Record<string, number | undefined> = {};
    for (const key of [
      'maxSinglePayment',
      'dailyBudget',
      'weeklyBudget',
      'requireHumanAbove',
    ] as const) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n < 0) {
          json(res, { error: `Invalid ${key}` }, 400);
          return;
        }
        updates[key] = n;
      }
    }

    const ok = state.wallet!.updatePolicy(state.policyId!, updates);
    if (!ok) {
      json(res, { error: 'Policy update failed' }, 400);
      return;
    }
    const policy = state.wallet!.listPolicies().find((p) => p.id === state.policyId);
    json(res, { ok: true, policy });
    return;
  }

  if (method === 'POST' && pathname === '/api/payment') {
    const raw = await readBody(req);
    let body: {
      recipient?: string;
      amountEth?: number;
      reason?: string;
      taskId?: string;
    };
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      json(res, { error: 'Invalid JSON' }, 400);
      return;
    }

    const recipient = String(body.recipient || '').trim();
    const amountEth = Number(body.amountEth);
    const reason = String(body.reason || 'UI simulation').trim() || 'UI simulation';

    if (!recipient.startsWith('0x') || recipient.length < 10) {
      json(res, { error: 'Invalid recipient address' }, 400);
      return;
    }
    if (!Number.isFinite(amountEth) || amountEth <= 0) {
      json(res, { error: 'Invalid amount (ETH)' }, 400);
      return;
    }

    const result = await state.wallet!.requestPayment(
      state.sessionId!,
      recipient,
      amountEth,
      reason,
      {
        taskId: body.taskId || `ui-task-${Date.now()}`,
        description: 'Agentic Payment UI',
      }
    );

    json(res, {
      ...result,
      pending: getPendingApprovals().length,
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/approve') {
    const raw = await readBody(req);
    let body: { auditLogId?: string; approved?: boolean };
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      json(res, { error: 'Invalid JSON' }, 400);
      return;
    }

    const auditLogId = String(body.auditLogId || '');
    if (!auditLogId) {
      json(res, { error: 'auditLogId required' }, 400);
      return;
    }

    const approved = Boolean(body.approved);
    const out = await state.wallet!.approvePayment(auditLogId, approved);
    json(res, { ...out });
    return;
  }

  json(res, { error: 'Not found' }, 404);
}

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    void handleApi(req, res, pathname);
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    serveStatic(res, path.join(WEB_ROOT, 'index.html'), 'text/html; charset=utf-8');
    return;
  }
  if (pathname === '/styles.css') {
    serveStatic(res, path.join(WEB_ROOT, 'styles.css'), 'text/css; charset=utf-8');
    return;
  }
  if (pathname === '/app.js') {
    serveStatic(res, path.join(WEB_ROOT, 'app.js'), 'application/javascript; charset=utf-8');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(handleRequest);

function listenFrom(port: number): void {
  const onErr = (err: NodeJS.ErrnoException): void => {
    server.off('error', onErr);
    if (err.code === 'EADDRINUSE' && port < PREFERRED_PORT + PORT_FALLBACK_MAX) {
      console.warn(
        `[ui-server] 端口 ${port} 已被占用，改用 ${port + 1}（可设置 UI_PORT 指定端口，或结束占用 ${PREFERRED_PORT} 的进程）`
      );
      listenFrom(port + 1);
      return;
    }
    console.error('[ui-server] 监听失败:', err.message);
    process.exit(1);
  };

  server.once('error', onErr);
  server.listen(port, '127.0.0.1', () => {
    server.off('error', onErr);
    console.log('');
    console.log('  Agentic Treasury Console');
    console.log(`  http://127.0.0.1:${port}`);
    console.log(`  Chain: ${MONAD_CONFIG.CHAIN_ID}  RPC: ${rpcUrl}`);
    if (process.env.TEST_RPC_URL) {
      console.log(`  [本地测试模式] Ganache: ${process.env.TEST_RPC_URL}`);
    }
    if (process.env.PRIVATE_KEY) {
      console.log(`  [已初始化] 使用环境变量中的私钥`);
    } else {
      console.log(`  [演示模式] 前端可通过 POST /api/init 传入私钥或生成随机钱包`);
    }
    console.log('');
  });
}

listenFrom(PREFERRED_PORT);
