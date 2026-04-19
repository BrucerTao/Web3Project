#!/usr/bin/env node
/**
 * 私钥加密 CLI 工具
 *
 * 使用流程:
 * 1. 运行此脚本
 * 2. 输入原始私钥
 * 3. 输入保护密码
 * 4. 得到加密后的密文 (填入 .env)
 *
 * 示例:
 * $ npx tsx src/cli-encrypt.ts
 * 🔐 Monad Agentic Payment - 私钥加密工具
 *
 * 请输入私钥：0x1234...abcd
 * 设置保护密码：********
 * 确认密码：********
 *
 * ✅ 加密成功！
 *
 * 将以下内容添加到 .env:
 * ENCRYPTED_PRIVATE_KEY={"ciphertext":"...","salt":"...","iv":"..."}
 */

import 'dotenv/config';
import * as readline from 'node:readline';
import * as tty from 'node:tty';
import { encryptPrivateKey, isValidPrivateKey, serializeEncryptedData } from './wallet-crypto.js';

/**
 * 创建 readline 接口
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 隐藏输入读取密码
 */
async function promptHidden(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    if (tty.isatty(0)) {
      process.stdout.write(question);

      const stdin = process.stdin as any;
      stdin.setRawMode?.(true);

      let password = '';

      const onData = (char: Buffer) => {
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

/**
 * 普通输入读取
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const rl = createInterface();

  console.log('🔐 Monad Agentic Payment - 私钥加密工具\n');
  console.log('此工具用于加密钱包私钥，加密后的密文可安全存储在 .env 文件中\n');

  try {
    // 步骤 1: 输入私钥
    const privateKey = await prompt(rl, '请输入钱包私钥 (0x 开头，64 位十六进制): ');

    // 验证私钥格式
    if (!isValidPrivateKey(privateKey)) {
      console.error('\n❌ 错误的私钥格式！');
      console.error('私钥应该是 0x 开头，后跟 64 个十六进制字符');
      console.error('例如：0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      rl.close();
      process.exit(1);
    }

    // 步骤 2: 输入保护密码
    console.log('\n设置保护密码 (用于解密私钥):');
    const password = await promptHidden(rl, '密码：');

    if (password.length < 6) {
      console.error('\n❌ 密码太短！请至少使用 6 个字符');
      rl.close();
      process.exit(1);
    }

    const confirmPassword = await promptHidden(rl, '确认密码：');

    if (password !== confirmPassword) {
      console.error('\n❌ 两次输入的密码不一致！');
      rl.close();
      process.exit(1);
    }

    // 步骤 3: 加密私钥
    console.log('\n🔒 正在加密...');
    const encryptedData = encryptPrivateKey(privateKey, password);
    const encryptedJson = serializeEncryptedData(encryptedData);

    // 步骤 4: 输出结果
    console.log('\n✅ 加密成功！\n');

    // 输出模式选择
    if (process.argv.includes('--mcp')) {
      // MCP 配置格式 - 直接可用于 .mcp.json
      const mcpConfig = {
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
      console.log('📋 MCP 配置格式 (复制到 .mcp.json):');
      console.log('─'.repeat(60));
      console.log(JSON.stringify(mcpConfig, null, 2));
      console.log('─'.repeat(60));
      console.log('\n⚠️ 注意：此配置包含密码，请妥善保管 .mcp.json 文件');
    } else {
      // .env 格式
      console.log('─'.repeat(60));
      console.log('将以下内容添加到 .env 文件:\n');
      console.log(`ENCRYPTED_PRIVATE_KEY=${encryptedJson}`);
      console.log('─'.repeat(60));
    }

    console.log('\n📝 使用说明:');
    if (process.argv.includes('--mcp')) {
      console.log('1. 复制上面的 JSON 配置到 .mcp.json 文件');
      console.log('2. 根据需要修改 TEST_RPC_URL');
      console.log('3. 重启 Claude Code 加载配置');
    } else {
      console.log('1. 复制上面的 ENCRYPTED_PRIVATE_KEY=... 到 .env 文件');
      console.log('2. 启动 MCP 或 UI 服务时会自动提示输入密码解锁');
      console.log('3. 私钥明文不会存储在磁盘上，仅保存在内存中');
    }
    console.log('');

    // 可选：输出各组成部分（用于调试）
    if (process.argv.includes('--verbose')) {
      console.log('\n📋 加密数据详情:');
      console.log(`  Ciphertext: ${encryptedData.ciphertext}`);
      console.log(`  Salt:       ${encryptedData.salt}`);
      console.log(`  IV:         ${encryptedData.iv}\n`);
    }

    rl.close();
  } catch (error) {
    console.error('\n❌ 发生错误:', error instanceof Error ? error.message : error);
    rl.close();
    process.exit(1);
  }
}

main();
