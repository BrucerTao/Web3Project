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

```bash
cp .env.example .env
# 编辑 .env，设置 PRIVATE_KEY 或 TEST_PRIVATE_KEY
```

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

### 使用 CLI

```bash
# 注册 Agent
npm run cli -- register-agent --name "coding-assistant" --daily 50

# 请求支付
npm run cli -- request-payment --session <session-id> --to <address> --amount 0.01 --reason "API call"

# 查看审计日志
npm run cli -- logs
```

### 启动 MCP Server（在 Claude Code 中使用）

```bash
npm run mcp
```

配置方式见 [MCP 使用指南.md](./MCP 使用指南.md)

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
                    ┌─────────────────┐
                    │ MCP Server      │
                    │ (Claude Code)   │
                    └─────────────────┘
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
```

## 📄 许可证

MIT

## 🔗 相关资源

- [MCP 使用指南](./MCP 使用指南.md) - MCP Server 完整配置和部署指南
- [架构详解](./架构详解.md) - 代码结构和配置说明
- [Monad 文档](https://docs.monad.xyz/)
- [MCP Protocol](https://modelcontextprotocol.io/)
