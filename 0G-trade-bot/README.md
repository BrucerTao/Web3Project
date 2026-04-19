# 0G Agentic Trading Arena 🤖

> **0G 亚太黑客马拉松参赛项目** - Track 2: Agentic Trading Arena (Verifiable Finance)

基于 0G 模块化基础设施构建的 AI 驱动交易机器人系统，实现从手动 DeFi 到完全自主、可验证金融逻辑的过渡。

## 🎯 项目概述

本项目实现了两个核心 AI Agent：

1. **永续合约策略代理 (Perpetual Strategy Agent)** - AI 驱动的永续合约交易机器人
2. **智能收益优化器 (Yield Optimizer)** - 跨协议收益率扫描和自动复投

## 🔑 关键创新

| 特性 | 实现方式 | 价值 |
|------|----------|------|
| **密封推理** | 0G Compute TEE 执行 | 保护交易策略，防止抢先交易 |
| **持久化存储** | 0G Storage | 交易记录永久可查，低成本 |
| **链上验证** | 0G Chain 智能合约 | 可验证的金融逻辑 |
| **AI 决策** | 多因子分析模型 | 智能化交易和收益优化 |

## 🏗️ 系统架构

```
┌─────────────┐    HTTP API    ┌─────────────┐    合约调用    ┌─────────────┐
│  demo.html  │ ────────────> │  api-server │ ────────────> │   Ganache   │
│  (前端 UI)   │   端口 3001    │ (Node.js)   │   端口 8545    │  (区块链)   │
└─────────────┘               └─────────────┘               └─────────────┘
```

### 核心组件

| 组件 | 文件 | 功能 |
|------|------|------|
| **前端 UI** | `demo.html` | 用户界面，显示交易数据和日志 |
| **后端 API** | `src/api-server.ts` | Express 服务，连接智能合约 |
| **智能合约** | `contracts/TradingAgent.sol` | 链上验证和记录 |
| **0G Storage** | `src/services/zeroGStorage.ts` | 策略持久化存储 |
| **0G Compute** | `src/services/zeroGCompute.ts` | TEE 密封推理 |

## 🚀 快速开始

### 1. 安装依赖

```bash
# 克隆项目
cd 0g-trade-bot

# 安装依赖（使用 --legacy-peer-deps 解决依赖冲突）
npm install --legacy-peer-deps
```

> **⚠️ 注意**: 如果 `npm install` 失败并显示 `ERESOLVE` 错误，请使用 `npm install --legacy-peer-deps`。

### 2. 启动完整系统

```bash
# 终端 1: 启动 Ganache（本地区块链）
ganache --chain.chainId 1337

# 终端 2: 部署合约并启动 API 服务
npm run deploy:ganache
npm run api

# 浏览器：打开前端页面
open demo.html
```

### 3. 验证连接

打开 `demo.html` 后，应该看到：

1. **API 状态**: 显示 "API 已连接"（绿色徽章）
2. **合约地址**: 显示部署的合约地址
3. **Chain ID**: 显示 1337
4. **钱包余额**: 显示 ETH 余额

### 4. 使用功能

- **执行交易决策**: 点击按钮，查看合约调用和 PnL 变化
- **执行收益优化**: 扫描 DeFi 协议，存储策略到链上

## 📁 项目结构

```
0g-trade-bot/
├── src/
│   ├── api-server.ts             # 后端 API 服务
│   ├── index.ts                  # 命令行演示（可选）
│   ├── agents/
│   │   ├── PerpetualStrategyAgent.ts   # 永续策略代理
│   │   └── YieldOptimizer.ts           # 收益优化器
│   ├── services/
│   │   ├── zeroGStorage.ts      # 0G Storage 服务
│   │   └── zeroGCompute.ts      # 0G Compute 服务
│   └── contracts/
│       └── TradingAgentABI.ts    # 合约 ABI 导出
├── contracts/
│   └── TradingAgent.sol          # 链上验证合约
├── scripts/
│   ├── deploy-local.cjs          # 本地部署脚本
│   └── integration-test.cjs      # 集成测试脚本
├── test/
│   └── TradingAgent.test.cjs     # 单元测试
├── demo.html                     # Web 演示 UI
├── docs/
│   ├── USAGE_GUIDE.md            # 完整使用指南
│   ├── TROUBLESHOOTING.md        # 故障排除指南
│   └── NETWORK_SETUP.md          # 网络配置说明
├── package.json
├── hardhat.config.cjs
├── tsconfig.json
└── .env.example
```

## 🔧 常用命令

```bash
# 安装依赖
npm install --legacy-peer-deps

# 编译合约
npm run compile

# 部署到 Ganache
npm run deploy:ganache

# 启动 API 服务
npm run api

# 运行单元测试
npm run test:contract

# 运行完整本地测试
npm run test:local
```

## 📊 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/contract-info` | 获取合约信息 |
| GET | `/api/agent/info` | 获取机器人信息 |
| GET | `/api/wallet/balance` | 获取钱包余额 |
| POST | `/api/trade/execute` | 执行交易 |
| POST | `/api/strategy/store` | 存储策略 |
| POST | `/api/inference/record` | 记录推理 |

### 示例调用

```bash
# 健康检查
curl http://localhost:3001/health

# 执行交易
curl -X POST http://localhost:3001/api/trade/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"LONG","symbol":"BTC/USDT","amount":5000,"price":65000}'
```

## 🎯 评委标准对照

| 标准 | 实现情况 | 验证方式 |
|------|----------|----------|
| **0G 技术集成** | ✅ Storage + Compute + Chain | `src/services/` 目录 |
| **技术创新** | ✅ TEE 密封推理 | `zeroGCompute.ts` |
| **技术实施** | ✅ 完整功能代码 | `npm run test:local` |
| **链上部署** | ✅ Ganache 合约已部署 | `deploy-info.json` |
| **产品价值** | ✅ DeFi 自动化痛点 | README.md |
| **用户体验** | ✅ Web UI 演示 | `demo.html` |
| **文档** | ✅ 完整文档 | `docs/` 目录 |

## 📚 更多文档

- [docs/USAGE_GUIDE.md](docs/USAGE_GUIDE.md) - 完整使用指南（启动步骤、API 接口）
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - 故障排除指南

## 🔗 相关链接

- [0G 文档](https://docs.0g.ai/)
- [Builder Hub](https://build.0g.ai/)
- [0G SDK](https://build.0g.ai/sdks/)
- [测试网 Faucet](https://faucet.0g.ai/)
- [ChainScan (测试网)](https://chainscan-galileo.0g.ai/)
- [ChainScan (主网)](https://chainscan.0g.ai/)

## 📄 License

MIT

---

*Built with ❤️ for the 0G APAC Hackathon 2026*
