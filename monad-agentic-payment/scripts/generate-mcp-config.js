#!/usr/bin/env node
/**
 * 快速生成 .mcp.json 配置文件
 *
 * 使用方式:
 * 1. 交互式输入私钥和密码
 * 2. 自动生成格式正确的 .mcp.json
 *
 * 示例:
 * npx tsx scripts/generate-mcp-config.js
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import * as tty from 'node:tty';
import { encryptPrivateKey, isValidPrivateKey, serializeEncryptedData } from '../src/wallet-crypto.js';

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function promptHidden(rl, question) {
  return new Promise((resolve) => {
    if (tty.isatty(0)) {
      process.stdout.write(question);
      const stdin = process.stdin;
      stdin.setRawMode?.(true);
      let password = '';
      const onData = (char) => {
        const c = char.toString();
        if (c === '\r' || c === '\n') {
          stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          console.log();
          resolve(password);
        } else if (c === '\x03') {
          stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          console.log();
          process.exit(0);
        } else if (c === '\x7f' || c === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += c;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, resolve);
    }
  });
}

async function main() {
  const rl = createInterface();

  console.log('🔐 生成 MCP 配置文件\n');

  const privateKey = await prompt(rl, '请输入钱包私钥：');
  if (!isValidPrivateKey(privateKey)) {
    console.error('❌ 私钥格式错误');
    process.exit(1);
  }

  console.log('\n设置保护密码:');
  const password = await promptHidden(rl, '密码：');
  const confirmPassword = await promptHidden(rl, '确认密码：');

  if (password !== confirmPassword) {
    console.error('❌ 密码不一致');
    process.exit(1);
  }

  const encryptedData = encryptPrivateKey(privateKey, password);
  const encryptedJson = serializeEncryptedData(encryptedData);

  const config = {
    mcpServers: {
      'agentic-wallet': {
        command: 'npx',
        args: ['tsx', 'monad-agentic-payment/src/mcp-server.ts'],
        env: {
          TEST_RPC_URL: 'http://127.0.0.1:8545',
          ENCRYPTED_PRIVATE_KEY: encryptedJson,
          DECRYPT_PASSWORD: password,
        },
      },
    },
  };

  // 写入 .mcp.json
  fs.writeFileSync('.mcp.json', JSON.stringify(config, null, 2));
  console.log('\n✅ 已生成 .mcp.json 文件');
  console.log('\n📁 文件内容:');
  console.log(JSON.stringify(config, null, 2));
  console.log('\n⚠️  注意：.mcp.json 包含密码，请勿提交到 Git');

  rl.close();
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

main();
