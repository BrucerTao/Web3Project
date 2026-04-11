#!/usr/bin/env node
/**
 * MCP Server 测试脚本
 *
 * 模拟 Claude Code 调用 MCP Server 的工具
 * 使用方法：npm run test-mcp
 */

import { spawn } from 'child_process';
import { config } from 'dotenv';

// 加载 .env 文件
config();

const MCP_PROCESS = spawn('npx', ['tsx', 'src/mcp-server.ts'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd(),
  env: {
    ...process.env,
    TEST_RPC_URL: process.env.TEST_RPC_URL || 'http://127.0.0.1:8545',
    TEST_PRIVATE_KEY: process.env.TEST_PRIVATE_KEY || process.env.PRIVATE_KEY,
    PRIVATE_KEY: process.env.PRIVATE_KEY || process.env.TEST_PRIVATE_KEY,
  }
});

let requestId = 0;

function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    requestId++;
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    console.log(`📤 发送：${method}`);
    console.log(`参数：${JSON.stringify(params, null, 2)}`);

    MCP_PROCESS.stdin.write(JSON.stringify(request) + '\n');

    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 10000);

    const handler = (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            const response = JSON.parse(line);
            clearTimeout(timeout);
            MCP_PROCESS.stdout.removeListener('data', handler);
            console.log(`📥 收到响应:`);
            console.log(JSON.stringify(response, null, 2));
            console.log('');
            resolve(response);
            return;
          } catch (e) {
            // 忽略非 JSON 输出
          }
        }
      }
    };

    MCP_PROCESS.stdout.on('data', handler);
  });
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   MCP Server 测试                                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // 等待 MCP Server 启动
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // 测试 1：列出可用工具
    console.log('══════════════════════════════════════════════════════════');
    console.log('测试 1: 列出可用工具');
    console.log('══════════════════════════════════════════════════════════');
    await sendRequest('tools/list', {});

    // 测试 2：获取钱包信息
    console.log('══════════════════════════════════════════════════════════');
    console.log('测试 2: 获取钱包信息');
    console.log('══════════════════════════════════════════════════════════');
    await sendRequest('tools/call', {
      name: 'get_wallet_info',
      arguments: {}
    });

    // 测试 3：注册 Agent
    console.log('══════════════════════════════════════════════════════════');
    console.log('测试 3: 注册 Agent');
    console.log('══════════════════════════════════════════════════════════');
    const agentResult = await sendRequest('tools/call', {
      name: 'register_agent',
      arguments: {
        agentName: 'Test Agent',
        agentType: 'assistant',
        maxSinglePayment: 10,
        dailyBudget: 50,
        sessionTtlHours: 24
      }
    });

    // 解析 Agent ID
    let agentId, sessionId;
    try {
      const content = JSON.parse(agentResult.result.content[0].text);
      agentId = content.agent.id;
      sessionId = content.sessionKey.id;
      console.log(`注册成功：Agent=${agentId}, Session=${sessionId}`);
    } catch (e) {
      console.log('注册失败，跳过后续测试');
      console.log('错误:', e.message);
      console.log('返回内容:', agentResult);
      return;
    }

    // 测试 4：列出策略
    console.log('══════════════════════════════════════════════════════════');
    console.log('测试 4: 列出策略');
    console.log('══════════════════════════════════════════════════════════');
    await sendRequest('tools/call', {
      name: 'list_policies',
      arguments: {}
    });

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   测试完成 ✅                                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    MCP_PROCESS.kill();
  }
}

runTests().catch(console.error);
