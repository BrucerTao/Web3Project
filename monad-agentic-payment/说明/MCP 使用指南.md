# MCP Server 完整使用指南

## 概述

MCP (Model Context Protocol) Server 允许 Claude Code、Cursor 等 AI 开发工具直接调用 Agentic Wallet 的功能。

**支持的网络**：
- ✅ Ganache 本地网络（开发测试优先）
- ✅ Monad 测试网（真实链上测试）

**可用工具**：
| 工具名 | 说明 |
|--------|------|
| `get_wallet_info` | 获取钱包信息（地址、余额、统计） |
| `register_agent` | 注册 Agent 并创建 Session Key 和策略 |
| `request_payment` | Agent 请求支付（自动进行策略检查） |
| `approve_payment` | 人工批准需要确认的支付 |
| `revoke_agent` | 撤销 Agent 的所有权限 |
| `list_sessions` | 列出 Agent 的活跃会话 |
| `list_policies` | 列出所有策略 |
| `get_audit_logs` | 获取审计日志 |
| `generate_receipt` | 生成支付收据 |

---

## 第一部分：本地开发环境配置（Ganache）

### 1.1 启动 Ganache

```bash
# 终端 1：启动 Ganache，使用 Monad 兼容的 chainId
ganache --chain.chainId 10143
```

记下输出的第一个私钥，例如：
```
Private Keys
==================
(0) 0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8
```

### 1.2 配置环境变量

创建或更新 `.env` 文件：

```bash
# 本地 Ganache 配置
TEST_RPC_URL=http://127.0.0.1:8545
TEST_PRIVATE_KEY=0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8
PRIVATE_KEY=0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8
USER_ID=demo-user
```

### 1.3 测试 MCP Server

```bash
# 运行自动化测试脚本
npm run test-mcp
```

成功输出示例：
```
╔══════════════════════════════════════════════════════════╗
║   MCP Server 测试                                       ║
╚══════════════════════════════════════════════════════════╝

测试 1: 列出可用工具
📤 发送：tools/list
📥 收到响应：[9 个工具列表]

测试 2: 获取钱包信息
📥 收到响应：地址 0x..., 余额 999.99 ETH

测试 3: 注册 Agent
📥 收到响应：Agent=agent-xxx, Session=session-xxx

测试 4: 列出策略
📥 收到响应：[策略列表]

╔══════════════════════════════════════════════════════════╗
║   测试完成 ✅                                            ║
╚══════════════════════════════════════════════════════════╝
```

---

## 第二部分：在 Claude Code 中使用

### 2.1 配置方式 1：项目级配置（推荐）

在项目根目录创建 `.mcp.json` 文件：

```json
{
  "mcpServers": {
    "agentic-wallet": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts"
      ],
      "env": {
        "TEST_RPC_URL": "http://127.0.0.1:8545",
        "TEST_PRIVATE_KEY": "0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8",
        "PRIVATE_KEY": "0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8"
      }
    }
  }
}
```

> ⚠️ **注意**：
> - `args` 中的文件路径必须使用**绝对路径**（从 `/` 开始的完整路径）
> - 不要使用相对路径如 `src/mcp-server.ts`，Claude Code 不会自动解析 `cwd`
> - 私钥请替换为你自己的 Ganache 私钥

### 2.2 配置方式 2：全局配置

编辑你的 Claude Code 全局配置文件：

**macOS/Linux:** `~/.claude.json`

```json
{
  "mcpServers": {
    "agentic-wallet": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts"
      ],
      "env": {
        "TEST_RPC_URL": "http://127.0.0.1:8545",
        "TEST_PRIVATE_KEY": "0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8",
        "PRIVATE_KEY": "0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8"
      }
    }
  }
}
```

> ⚠️ **配置文件位置说明**：
> - Claude Code 的配置文件位于 `~/.claude.json`（macOS/Linux）
> - 不是 `~/.config/claude-code/claude_config.json`
> - 可以使用 `/config mcp` 命令查看当前配置

### 2.3 配置方式 3：使用命令配置

在 Claude Code 对话中输入：

```
/config mcp add agentic-wallet --command "npx" --arg "tsx" --arg "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts" --env TEST_RPC_URL="http://127.0.0.1:8545" --env TEST_PRIVATE_KEY="0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8" --env PRIVATE_KEY="0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8"
```

### 2.4 验证配置

配置完成后，验证是否成功：

**方式 1：在 Claude Code 中查看**
```
/config mcp
```
应该能看到 `agentic-wallet` 在列表中。

**方式 2：请求工具列表**
```
列出 agentic-wallet 可用的工具
```

应该看到 9 个工具：
- `get_wallet_info`
- `register_agent`
- `request_payment`
- `approve_payment`
- `revoke_agent`
- `list_sessions`
- `list_policies`
- `get_audit_logs`
- `generate_receipt`

### 2.5 使用示例

配置成功后，在 Claude Code 中可以这样使用：

```
用户：帮我用 agentic-wallet 注册一个 Agent

Claude：我来帮你注册一个 Agent...
- Agent 名称：Test Assistant
- 类型：assistant
- 单笔支付上限：10 USD
- 每日预算：50 USD

✅ Agent 已注册：
- Agent ID: agent-xxx
- Session Key: 0x...
```

```
用户：请求一笔 0.001 ETH 的支付给 0x...

Claude：好的，我正在使用 request_payment 工具...
✅ 支付请求已提交，等待审批
```

```
用户：查看刚才的审计日志

Claude：正在获取审计日志...
[显示最近的交易记录]
```

---

## 第三部分：在 Cursor 中使用

### 3.1 配置方式 1：项目级配置（推荐）

在项目根目录创建 `.cursor/mcp.json` 文件：

```json
{
  "mcpServers": {
    "agentic-wallet": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts"
      ],
      "env": {
        "TEST_RPC_URL": "http://127.0.0.1:8545",
        "TEST_PRIVATE_KEY": "0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8",
        "PRIVATE_KEY": "0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8"
      }
    }
  }
}
```

> ⚠️ **注意**：
> - `args` 中的文件路径必须使用**绝对路径**（从 `/` 开始的完整路径）
> - Cursor 不支持 `cwd` 配置，必须使用完整路径
> - 私钥请替换为你自己的 Ganache 私钥

### 3.2 配置方式 2：Cursor 全局配置

或者在 Cursor 的设置中全局配置：

1. 打开 Cursor 设置（Cmd+, / Ctrl+,）
2. 找到 "MCP Servers" 或 "AI Extensions"
3. 点击 "Add MCP Server"
4. 填写配置：
   - **Command**: `npx`
   - **Args**: `tsx /Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts`
   - **Environment Variables**:
     - `TEST_RPC_URL=http://127.0.0.1:8545`
     - `TEST_PRIVATE_KEY=0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8`
     - `PRIVATE_KEY=0x9ba549d204a50344552e61579f776a47c2e8ac5b4dd5f7f0cfd4eaa2c5ea3df8`

### 3.3 在 Cursor 中使用

配置完成后：
1. 打开 Cursor 的 AI 聊天窗口（Cmd+L / Ctrl+L）
2. 输入类似 "使用 agentic-wallet 注册一个 Agent"
3. Cursor 会自动调用 MCP Server 的工具

### 3.4 验证配置

在 Cursor 聊天窗口中输入：

```
列出 agentic-wallet 可用的工具
```

应该能看到 9 个工具列表。

---

## 第四部分：连接 Monad 测试网

### 4.1 获取 Monad 测试网 ETH

1. 访问 [Monad 测试网水龙头](https://testnet.monadscan.com/faucet)
2. 输入你的钱包地址
3. 领取测试用 ETH

### 4.2 更新 .env 文件

```bash
# Monad 测试网配置
TEST_RPC_URL=https://testnet-rpc.monad.xyz
TEST_PRIVATE_KEY=你的真实钱包私钥
PRIVATE_KEY=你的真实钱包私钥
USER_ID=monad-test-user
```

### 4.3 MCP 配置（Monad 测试网）

**Claude Code 配置：**

```json
{
  "mcpServers": {
    "agentic-wallet": {
      "command": "npx",
      "args": ["tsx", "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts"],
      "env": {
        "TEST_RPC_URL": "https://testnet-rpc.monad.xyz",
        "TEST_PRIVATE_KEY": "0x你的私钥",
        "PRIVATE_KEY": "0x你的私钥"
      }
    }
  }
}
```

#### 使用加密私钥（推荐）

生产环境建议使用加密私钥：

**步骤 1: 加密私钥**
```bash
npm run encrypt
# 输入私钥和密码，得到加密结果
```

**步骤 2: 配置 MCP**
```json
{
  "mcpServers": {
    "agentic-wallet": {
      "command": "npx",
      "args": ["tsx", "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts"],
      "env": {
        "TEST_RPC_URL": "https://testnet-rpc.monad.xyz",
        "ENCRYPTED_PRIVATE_KEY": "{\"ciphertext\":\"...\",\"salt\":\"...\",\"iv\":\"...\"}",
        "DECRYPT_PASSWORD": "你的密码"
      }
    }
  }
}
```

⚠️ **注意**：`ENCRYPTED_PRIVATE_KEY` 的值需要进行 JSON 转义（内层双引号前加反斜杠）。

**步骤 3: 验证配置**
```bash
node -e "JSON.parse(require('fs').readFileSync('.mcp.json', 'utf8'))"
# 无错误则格式正确
```

### 4.4 验证配置

运行测试脚本验证连接：

```bash
npm run test-mcp
```

如果看到钱包余额显示真实的 Monad 测试网 ETH，说明配置成功。

---

## 第五部分：部署 MCP Server 到云端

### 5.1 部署架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Code /  │ ──► │   MCP Server     │ ──► │  Monad 测试网   │
│     Cursor      │     │  (云端部署)       │     │  或主网         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
   本地工具调用           云端服务（需要认证）
```

### 5.2 方案一：使用 Docker 部署

**Dockerfile:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --production

# 复制源码
COPY src ./src
COPY tsconfig.json ./
COPY .env.example ./.env

# 创建数据目录（用于审计日志持久化）
RUN mkdir -p /app/data

# 构建（可选，如果直接运行 tsx 可以跳过）
# RUN npm run build

EXPOSE 3000

# 运行 MCP Server
CMD ["npx", "tsx", "/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    environment:
      - PRIVATE_KEY=${PRIVATE_KEY}
      - TEST_RPC_URL=${TEST_RPC_URL:-https://testnet-rpc.monad.xyz}
      - USER_ID=${USER_ID:-cloud-mcp-user}
    ports:
      - "3000:3000"
    restart: unless-stopped
    volumes:
      # 挂载数据目录，持久化审计日志
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "pgrep", "-f", "tsx"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**部署步骤：**

```bash
# 1. 创建 .env 文件
cat > .env << EOF
PRIVATE_KEY=你的私钥
TEST_RPC_URL=https://testnet-rpc.monad.xyz
USER_ID=cloud-mcp-user
EOF

# 2. 构建并运行
docker-compose up -d --build

# 3. 查看日志
docker-compose logs -f mcp-server

# 4. 查看审计日志数据
ls -la data/
```

**数据持久化说明：**
- 审计日志保存在 `data/<钱包地址>/audit-logs.json`
- 使用 Docker volume 挂载 `./data:/app/data`，确保容器重启后数据不丢失
- 不同钱包地址的数据自动隔离

### 5.3 方案二：部署到 VPS/云服务器

```bash
# 1. 克隆代码
git clone <你的仓库> /opt/agentic-mcp
cd /opt/agentic-mcp

# 2. 安装依赖
npm install --production

# 3. 配置环境变量
cp .env.example .env
vim .env  # 编辑私钥等配置

# 4. 创建数据目录（审计日志持久化）
mkdir -p data

# 5. 使用 PM2 管理进程
npm install -g pm2
pm2 start dist/mcp-server.js --name agentic-mcp
pm2 save
pm2 startup

# 6. 设置开机自启
pm2 startup systemd
```

**数据持久化说明：**
- 审计日志自动保存在 `/opt/agentic-mcp/data/<钱包地址>/audit-logs.json`
- 进程重启或服务器重启后数据自动恢复
- 建议定期备份 `data/` 目录到外部存储

### 5.4 方案三：部署到 Serverless 平台

**Vercel / Railway / Fly.io:**

这些平台主要部署 HTTP 服务，而 MCP Server 使用 stdio 传输，需要适配：

1. **创建 HTTP 适配层**（新增文件 `src/mcp-http-server.ts`）：

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/stream.js';
import express from 'express';

const app = express();
app.use(express.json());

// 创建 MCP Server
const server = new Server({
  name: 'agentic-wallet',
  version: '1.0.0',
});

// 注册工具...

const transport = new StreamableHTTPServerTransport({
  sessionGenerator: () => Math.random().toString(36).substring(7),
});

await server.connect(transport);

app.post('/mcp', async (req, res) => {
  const { method, params, id } = req.body;
  // 处理 MCP 请求
});

app.listen(process.env.PORT || 3000);
```

2. **配置 vercel.json:**

```json
{
  "version": 2,
  "builds": [{ "src": "src/mcp-http-server.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/mcp-http-server.ts" }]
}
```

3. **部署:**

```bash
npm install -g vercel
vercel deploy --prod
```

### 5.5 远程 MCP Server 配置

部署后，在 Claude Code / Cursor 中配置远程连接：

**使用 HTTP 传输的配置：**

```json
{
  "mcpServers": {
    "agentic-wallet-remote": {
      "url": "https://your-mcp-server.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

---

## 第六部分：安全最佳实践

### 6.1 私钥管理

**❌ 不要这样做：**
- 将私钥提交到 Git
- 在代码中硬编码私钥
- 在不安全的地方存储私钥

**✅ 推荐做法：**
- 使用 `.env` 文件并确保在 `.gitignore` 中
- 使用 secrets 管理服务（如 AWS Secrets Manager、HashiCorp Vault）
- 为不同的环境使用不同的私钥

### 6.2 权限控制

**限制 Agent 权限：**

```json
{
  "agentName": "Limited Agent",
  "maxSinglePayment": 5,    // 单笔最多 5 USD
  "dailyBudget": 20,        // 每日最多 20 USD
  "requireHumanAbove": 1    // 超过 1 USD 需要人工批准
}
```

### 6.3 监控和审计

定期检查审计日志：

```
用户：查看最近的审计日志

Claude：调用 get_audit_logs 工具...
[显示最近的交易和策略检查记录]
```

**审计日志持久化：**
- 审计日志自动保存到 `data/<钱包地址>/audit-logs.json`
- 不同钱包地址的数据完全隔离
- 重启服务后自动恢复历史记录
- 支持导出 JSON/CSV 格式用于外部审计

### 6.4 数据持久化

**目录结构：**
```
data/
├── 0x860Ee9Df87ebbc14bc125B732eA1c2D186dFE29F/
│   └── audit-logs.json    # 该钱包的所有审计日志
├── 0x8590c2fe5832fA79779f3441CA6AFA9EA3b6C530/
│   └── audit-logs.json    # 另一个钱包的审计日志
└── ...
```

**特性：**
- ✅ 每个钱包地址独立数据目录
- ✅ 重启后自动加载对应钱包的历史记录
- ✅ 不会加载其他钱包的数据
- ✅ 支持 BigInt 序列化/反序列化
- ✅ 错误处理：文件损坏时自动新建

**注意事项：**
- `data/` 目录已添加到 `.gitignore`，不会被提交
- 生产环境建议定期备份 `data/` 目录
- 可使用 `export_audit_logs` 工具导出审计报告

### 6.5 部署安全

**生产环境检查清单：**
- [ ] 使用 HTTPS 而不是 HTTP
- [ ] 配置 API Key 认证
- [ ] 限制访问 IP
- [ ] 启用日志记录和监控
- [ ] 定期轮换私钥
- [ ] 设置预算告警

---

## 第七部分：故障排查

### 7.1 常见问题

**Q1: 工具调用返回 "PRIVATE_KEY is required"？**

解决：
1. 检查 `.env` 文件是否存在
2. 确认 `TEST_PRIVATE_KEY` 或 `PRIVATE_KEY` 已设置
3. 如果使用 Docker，确保环境变量已传入容器

**Q2: Claude Code 或 Cursor 无法获取工具列表？**

解决：
1. 确认配置文件中使用**绝对路径**（如 `/Users/huangtao/mybiz/Web3Project/monad-agentic-payment/src/mcp-server.ts`）
2. 不要使用相对路径（如 `src/mcp-server.ts`），Claude Code 和 Cursor 都不支持 `cwd`
3. 重启 Claude Code / Cursor 使配置生效
4. 检查 `.env` 文件是否配置正确

**手动测试 MCP Server：**

```bash
# 在项目根目录运行
npx tsx src/mcp-server.ts
```

如果看到 "MCP Server running on stdio" 说明服务正常，问题在配置路径上。

**Q3: Monad 测试网交易失败？**

解决：
1. 确认有足够余额：`npm run test-mcp` 查看
2. 检查 RPC URL 是否正确
3. 访问 [Monad 测试网浏览器](https://testnet.monadscan.com) 查看交易状态

### 7.2 调试模式

```bash
# 详细日志输出
DEBUG=mcp:* npm run mcp

# 查看 MCP Server 输出（在项目根目录运行）
npx tsx src/mcp-server.ts 2>&1 | tee mcp.log
```

### 7.3 手动测试

**使用 mcp-cli 测试：**

```bash
# 安装
npm install -g @anthropic/mcp-cli

# 测试服务器（在项目根目录运行）
mcp-cli inspect --command "npx" --arg "tsx" --arg "src/mcp-server.ts" \
  --env TEST_RPC_URL=http://127.0.0.1:8545 \
  --env TEST_PRIVATE_KEY=0x...
```

**直接在终端运行 MCP Server：**

```bash
cd /Users/huangtao/mybiz/Web3Project/monad-agentic-payment
npx tsx src/mcp-server.ts
```

如果看到类似 "MCP Server running on stdio" 的输出，说明服务正常运行。

---

## 第八部分：资源链接

- [MCP 协议官方文档](https://modelcontextprotocol.io/)
- [Claude Code 文档](https://claude.ai/code)
- [Cursor 文档](https://cursor.sh/)
- [Monad 测试网文档](https://docs.monad.xyz/)
- [Ganache 文档](https://trufflesuite.com/docs/ganache/)

---

**最后更新**: 2026-04-11  
**支持版本**: MCP SDK 1.0+, Agentic Wallet 1.0.0  
**更新内容**: 
- Claude Code 配置说明（`.mcp.json` 和 `~/.claude.json`）
- Cursor 配置说明（`.cursor/mcp.json`）
- 使用绝对路径配置（重要！）
- 故障排查指南
