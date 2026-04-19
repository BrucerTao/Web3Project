/**
 * 钱包私钥加密工具
 *
 * 使用 AES-256-CBC + PBKDF2 实现私钥加解密
 *
 * 安全特性:
 * - AES-256-CBC: 军事级对称加密
 * - PBKDF2-SHA256: 密钥派生，抗暴力破解 (100000 次迭代)
 * - 随机 Salt: 每次加密生成唯一 salt，防止彩虹表攻击
 * - 随机 IV: 每次加密生成唯一初始化向量
 *
 * 使用流程:
 * 1. 用户运行 cli-encrypt.ts 加密私钥，得到密文
 * 2. 将密文填入 .env 的 ENCRYPTED_PRIVATE_KEY
 * 3. 启动时输入密码解锁，解密后在内存中使用
 */

import * as crypto from 'node:crypto';

// 加密常量
const ALGORITHM = 'aes-256-cbc';  // AES-256-CBC 加密算法
const KEY_LENGTH = 32;             // 256 位 = 32 字节
const IV_LENGTH = 16;              // 128 位 = 16 字节
const SALT_LENGTH = 16;            // 128 位盐
const PBKDF2_ITERATIONS = 100000;  // PBKDF2 迭代次数 (抗暴力破解)
const PBKDF2_DIGEST = 'sha256';    // PBKDF2 使用的哈希算法

/**
 * 加密后的数据结构
 */
export interface EncryptedData {
  ciphertext: string;  // Base64 编码的密文
  salt: string;        // Base64 编码的 salt (用于派生密钥)
  iv: string;          // Base64 编码的 IV (初始化向量)
}

/**
 * 从密码派生 AES 密钥
 * 使用 PBKDF2 算法，抗暴力破解
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * 加密私钥
 *
 * @param privateKey 私钥字符串 (如：0x1234...abcd)
 * @param password 密码 (用户记忆，不存储)
 * @returns 加密后的数据结构 (包含 ciphertext, salt, iv)
 *
 * 加密流程:
 * 1. 生成随机 salt (16 字节)
 * 2. 用 PBKDF2 从密码派生出 AES 密钥 (32 字节)
 * 3. 生成随机 IV (16 字节)
 * 4. 用 AES-256-CBC 加密私钥
 * 5. 返回 Base64 编码的密文 + salt + IV
 */
export function encryptPrivateKey(
  privateKey: string,
  password: string
): EncryptedData {
  // 生成随机 salt 和 IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // 从密码派生密钥
  const key = deriveKey(password, salt);

  // 创建加密器
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // 加密数据
  let encrypted = cipher.update(privateKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    ciphertext: encrypted,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * 解密私钥
 *
 * @param encryptedData 加密数据结构 (ciphertext, salt, iv)
 * @param password 密码 (必须与加密时相同)
 * @returns 解密后的私钥字符串
 *
 * 解密流程:
 * 1. 从 encryptedData 中提取 salt, IV, ciphertext
 * 2. 用相同的 PBKDF2 参数从密码派生出相同的 AES 密钥
 * 3. 用 AES-256-CBC 解密
 * 4. 返回原始私钥
 *
 * @throws Error 密码错误时抛出
 */
export function decryptPrivateKey(
  encryptedData: EncryptedData,
  password: string
): string {
  // 解码 Base64 数据
  const salt = Buffer.from(encryptedData.salt, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const ciphertext = encryptedData.ciphertext;

  // 从密码派生密钥 (使用相同的 salt)
  const key = deriveKey(password, salt);

  // 创建解密器
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  // 解密数据
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 从环境变量加载并解密私钥
 *
 * 支持两种格式:
 * 1. 明文：PRIVATE_KEY (向后兼容)
 * 2. 密文：ENCRYPTED_PRIVATE_KEY (新格式，推荐)
 *
 * 加密格式: JSON.stringify(EncryptedData)
 *
 * 优先级：ENCRYPTED_PRIVATE_KEY > PRIVATE_KEY > TEST_PRIVATE_KEY
 *
 * @returns 解密后的私钥，或 null (如果没有配置)
 */
export async function loadPrivateKeyFromEnv(): Promise<{
  privateKey: string | null;
  isEncrypted: boolean;
}> {
  // 优先尝试加密格式
  const encryptedJson = process.env.ENCRYPTED_PRIVATE_KEY;
  if (encryptedJson) {
    console.log('[wallet-crypto] 检测到 ENCRYPTED_PRIVATE_KEY，开始解密...');

    // 支持自动解密模式（用于 MCP/CI）
    const autoPassword = process.env.DECRYPT_PASSWORD;
    let password: string;

    if (autoPassword) {
      console.log('[wallet-crypto] 使用 DECRYPT_PASSWORD 自动解密');
      password = autoPassword;
    } else {
      // 交互式输入密码
      password = await promptForPassword();
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedJson);

      const privateKey = decryptPrivateKey(encryptedData, password);

      // 验证解密后的私钥格式
      if (!isValidPrivateKey(privateKey)) {
        throw new Error('Decrypted key has invalid format');
      }

      console.log('[wallet-crypto] ✅ 解密成功');
      return { privateKey, isEncrypted: true };
    } catch (error) {
      if (autoPassword) {
        console.error('❌ DECRYPT_PASSWORD 错误，无法解密私钥');
      } else {
        console.error('❌ 密码错误，无法解密私钥');
      }
      process.exit(1);
    }
  }

  // 回退到明文格式 (向后兼容)
  const privateKey = process.env.PRIVATE_KEY || process.env.TEST_PRIVATE_KEY;
  if (privateKey) {
    console.log('[wallet-crypto] 检测到明文私钥（开发模式）');
    return { privateKey, isEncrypted: false };
  }

  console.log('[wallet-crypto] 未检测到私钥配置');
  return { privateKey: null, isEncrypted: false };
}

/**
 * 交互式密码输入
 * 使用 readline 隐藏密码输入
 */
async function promptForPassword(): Promise<string> {
  const [readline, tty] = await Promise.all([
    import('node:readline'),
    import('node:tty'),
  ]);

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 隐藏密码输入
    if (tty.isatty(0)) {  // 如果是终端
      process.stdout.write('🔐 输入密码解锁私钥：');

      // 关闭 stdin 的回显
      const stdin = process.stdin as any;
      stdin.setRawMode?.(true);

      let password = '';

      stdin.on('data', (char: Buffer) => {
        const c = char.toString();

        if (c === '\r' || c === '\n') {
          // 回车结束
          stdin.setRawMode?.(false);
          rl.close();
          console.log();  // 换行
          resolve(password);
        } else if (c === '\x03') {
          // Ctrl+C
          stdin.setRawMode?.(false);
          rl.close();
          console.log();
          process.exit(0);
        } else if (c === '\x7f' || c === '\b') {
          // 退格
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          // 正常字符
          password += c;
          process.stdout.write('*');
        }
      });
    } else {
      // 非终端环境，直接读取
      rl.question('🔐 输入密码解锁私钥：', (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * 验证私钥格式是否正确
 */
export function isValidPrivateKey(privateKey: string): boolean {
  // 以太坊私钥格式：0x + 64 个十六进制字符
  return /^0x[a-fA-F0-9]{64}$/.test(privateKey);
}

/**
 * 将加密数据序列化为 JSON 字符串 (用于写入 .env)
 */
export function serializeEncryptedData(data: EncryptedData): string {
  return JSON.stringify(data);
}

/**
 * 从 JSON 字符串解析加密数据
 */
export function parseEncryptedData(json: string): EncryptedData {
  return JSON.parse(json);
}
