# Monad Agentic Payment

**AI Agent 原生的安全支付系统** - 为 Monad 链设计

在 **Monad 链**上构建的 **Agent 原生安全钱包**，使 AI Agent 能在用户授权下自主完成链上支付，同时确保安全、可控、可审计。

## 🔐 核心特性

| 特性 | 状态 | 说明 |
|------|------|------|
| 去中心化 | ✅ | 用户自持资产、非托管、Agent 无法接触真实私钥 |
| 安全配置 | ✅ | 单笔上限、每日预算、白名单、方法限制、风险拦截 |
| Agent 原生 | ✅ | Session Key、临时授权、任务上下文支付 |
| 可审计性 | ✅ | 完整的支付记录、策略命中、风险评级 |
| 权限管理 | ✅ | Session Key 轮换、紧急撤销、多 Agent 区分 |
| Session Key | ✅ | 受限临时密钥，支持有效期、额度限制 |
| Policy Engine | ✅ | 可配置策略层，支持多种规则组合 |
| 分级审批 | ✅ | 小额自动、中额二次确认、高风险人工 |
| 审计日志 | ✅ | 结构化支付收据，支持导出 JSON/CSV |

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

#### 方式一：加密私钥（推荐）

```bash
# 1. 运行加密工具
npx tsx src/cli-encrypt.ts

# 2. 按提示输入私钥和密码
# 3. 将输出的 ENCRYPTED_PRIVATE_KEY 复制到 .env
```

启动时会提示输入密码解锁，私钥明文仅保存在内存中。

#### 方式二：明文私钥（仅开发测试）

```bash
cp .env.example .env
# 编辑 .env，设置 PRIVATE_KEY 或 TEST_PRIVATE_KEY
```

⚠️ **注意**: 明文私钥不安全，仅用于本地开发测试。生产环境请使用加密方式。

### 本地测试（使用 Ganache）

```bash
# 终端 1：启动 Ganache
ganache --chain.chainId 10143

# 终端 2：运行测试
npm run test-mcp
```

### 运行演示

```bash
npm run demo
```

### 能力展示控制台（Web UI）

浏览器端演示 **策略限额、模拟支付、人机审批、审计流水**（与核心 `AgenticWallet` 逻辑一致，无单独前端构建步骤）。

**安装**：与主项目相同，执行一次 `npm install` 即可（`web/` 为纯静态 HTML/CSS/JS，无需额外安装或打包）。

**本地运行**：

```bash
npm run ui
```

终端会打印访问地址（默认首选端口 `3847`，若被占用会自动尝试后续端口）。浏览器打开 `http://127.0.0.1:<端口>/` 即可。

**首次使用**：
1. 打开页面后会弹出"连接钱包"对话框
2. 选择"使用私钥"输入 Ganache 私钥，或"生成随机钱包"临时演示
3. 连接后即可进行策略配置、发起支付、审批交易等操作

**数据持久化**：
- 审计日志会自动保存到 `data/<钱包地址>/audit-logs.json`
- 重启 UI 后，使用同一钱包地址登录可恢复历史交易记录
- 不同钱包地址的数据完全隔离

**常用环境变量**：

| 变量 | 说明 |
|------|------|
| `ENCRYPTED_PRIVATE_KEY` | 推荐。加密后的私钥，启动时输入密码解密。运行 `npm run encrypt` 生成。 |
| `DECRYPT_PASSWORD` | 可选。设置后自动解密（用于 MCP/CI），不设置则交互式输入。 |
| `PRIVATE_KEY` | 可选。明文私钥（仅开发测试用，不推荐生产环境）。 |
| `UI_PORT` | 可选。首选监听端口，默认 `3847`。 |
| `TEST_RPC_URL` | 可选。指定 RPC 地址，默认使用 Monad 测试网 `https://testnet-rpc.monad.xyz`。本地 Ganache 测试设为 `http://127.0.0.1:8545`。 |

**优先级**: `ENCRYPTED_PRIVATE_KEY` > `PRIVATE_KEY` > `TEST_PRIVATE_KEY`

**部署提示**：控制台由 `src/ui-server.ts` 提供静态资源与 `/api/*`；生产环境可用进程守护（如 `pm2`）在编译后运行 `node dist/ui-server.js`，前置反向代理与 HTTPS；默认仅监听本机，若对外暴露须自行加鉴权与网络安全策略。详细架构与 API 列表见 [架构详解.md](./架构详解.md) 中的「能力展示控制台（Web UI）」一节。

### 使用 CLI

```bash
# 注册 Agent
npm run cli -- register-agent --name "coding-assistant" --daily 50

# 请求支付
npm run cli -- request-payment --session <session-id> --to <address> --amount 0.01 --reason "API call"

# 查看审计日志
npm run cli -- logs
```

### 配置 MCP（在 Claude Code 中使用）

**方式 1：使用明文私钥（开发测试）**

```bash
cp .mcp.json.example .mcp.json
# 编辑 .mcp.json，替换 PRIVATE_KEY 为你的私钥
```

**方式 2：使用加密私钥（推荐）**

```bash
# 1. 生成 MCP 配置（自动处理 JSON 转义）
npm run encrypt:mcp

# 2. 复制输出的 JSON 保存为 .mcp.json
```

**或者使用基础命令**：
```bash
npm run encrypt -- --mcp   # 效果相同
```

**方式 3：Monad 测试网配置**

```bash
cp .mcp.json.example.monad .mcp.json
# 编辑 .mcp.json，替换 PRIVATE_KEY 为你的测试网私钥
```

**私钥配置说明**：
- `PRIVATE_KEY` 和 `TEST_PRIVATE_KEY` 只需要其中一个即可
- 优先级：`ENCRYPTED_PRIVATE_KEY` > `PRIVATE_KEY` > `TEST_PRIVATE_KEY`

重启 Claude Code 后，即可调用 MCP 工具。

## 📖 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    AgenticWallet                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Policy Engine   │  │ Session Key     │                  │
│  │ - 额度限制       │  │ Manager         │                  │
│  │ - 白名单        │  │ - 生成临时密钥    │                  │
│  │ - 风险评级       │  │ - 权限撤销       │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Payment         │  │ Audit Logger    │                  │
│  │ Executor        │  │ - 结构化日志     │                  │
│  │ - MPP 协议       │  │ - 可导出         │                  │
│  │ - 失败重试       │  │ - 支付收据       │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ MCP Server │ CLI │ SDK │ Web UI（演示） │
        └─────────────────────────────────────────┘
```

## 🔧 API 使用

### SDK 方式

```typescript
import { AgenticWallet } from 'monad-agentic-payment';
import { Wallet } from 'ethers';

// 初始化钱包
const wallet = new Wallet(process.env.PRIVATE_KEY!);
const agenticWallet = new AgenticWallet({
  ownerWallet: wallet,
  userId: 'user-001',
});

// 注册 Agent
const { agent, sessionKey, policy } = agenticWallet.registerAgent(
  'My Assistant',
  'assistant',
  {
    policy: {
      maxSinglePayment: 10,  // $10
      dailyBudget: 50,       // $50
      requireHumanAbove: 5,  // >$5 需要人工确认
    },
    sessionTtlHours: 24,
  }
);

// Agent 请求支付
const result = await agenticWallet.requestPayment(
  sessionKey.id,
  '0x...', // 收款方地址
  0.005,   // ETH 金额
  'API payment',
  { taskId: 'task-123' }
);

if (result.success) {
  console.log('支付成功:', result.result?.txHash);
} else if (result.requiresHumanApproval) {
  // 需要人工确认
  const approveResult = await agenticWallet.approvePayment(
    result.auditLogId!,
    true
  );
}
```

### MCP 工具调用

在 Claude Code 中：

```
使用工具：register_agent
参数：{ "agentName": "coding-assistant", "dailyBudget": 50 }

使用工具：request_payment
参数：{
  "sessionId": "session-xxx",
  "recipient": "0x...",
  "amountEth": 0.01,
  "reason": "API call"
}

使用工具：get_audit_logs
参数：{ "limit": 10 }
```

## 📋 策略配置示例

### 默认策略（适合大多数场景）

```typescript
{
  maxSinglePayment: 10,    // 单笔 $10
  dailyBudget: 50,         // 每日 $50
  weeklyBudget: 200,       // 每周 $200
  requireHumanAbove: 5,    // 超过 $5 需要人工确认
  allowedMethods: ['transfer', 'api_payment', 'service_payment'],
  blockedMethods: ['personal_transfer', 'gambling', 'high_risk'],
}
```

### 严格策略（高安全需求）

```typescript
{
  maxSinglePayment: 1,     // 单笔 $1
  dailyBudget: 10,         // 每日 $10
  requireHumanAbove: 0.5,  // 超过 $0.5 就需要确认
  allowedRecipients: ['0xverified_contract_1', '0xverified_contract_2'],
  allowedTokens: ['MON', 'USDC'],
}
```

### 宽松策略（可信 Agent）

```typescript
{
  maxSinglePayment: 100,   // 单笔 $100
  dailyBudget: 500,        // 每日 $500
  requireHumanAbove: 50,   // 超过 $50 才需要确认
  sessionTtlHours: 168,    // 7 天有效期
}
```

## 🔍 审计日志格式

每笔支付都会记录：

```json
{
  "id": "audit-xxx",
  "userId": "user-001",
  "agentId": "agent-xxx",
  "sessionId": "session-xxx",
  "paymentRequest": {
    "recipient": "0x...",
    "amount": "10000000000000000",
    "reason": "API call",
    "taskId": "task-123"
  },
  "paymentResult": {
    "success": true,
    "txHash": "0x..."
  },
  "policyChecks": {
    "riskLevel": "low",
    "riskFactors": []
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**数据持久化**：
- 审计日志自动保存到 `data/<钱包地址>/audit-logs.json`
- 每个钱包地址的数据独立存储，互不干扰
- 重启 UI 后自动加载对应钱包的历史记录
- 支持导出 JSON/CSV 格式

## 🛠️ 开发命令

```bash
# 编译
npm run build

# 开发模式
npm run dev

# 运行演示
npm run demo

# 使用 CLI
npm run cli -- <command>

# 启动 MCP Server
npm run mcp

# 运行 MCP 测试
npm run test-mcp

# 启动能力展示 Web 控制台
npm run ui
```

## 📄 许可证

MIT

## 🔗 相关资源

- [MCP 使用指南](./MCP 使用指南.md) - MCP Server 完整配置和部署指南
- [架构详解](./架构详解.md) - 代码结构和配置说明
- [Monad 文档](https://docs.monad.xyz/)
- [MCP Protocol](https://modelcontextprotocol.io/)
