# 完整使用指南

本文档说明如何启动完整的前后端联动系统。

## 📋 系统架构

```
┌─────────────┐    HTTP API    ┌─────────────┐    合约调用    ┌─────────────┐
│  demo.html  │ ────────────> │  api-server │ ────────────> │   Ganache   │
│  (端口任意)  │   3001 端口    │ (Node.js)   │   8545 端口    │  (区块链)   │
└─────────────┘               └─────────────┘               └─────────────┘
```

## 🚀 快速启动（推荐）

```bash
# 终端 1: 启动 Ganache
ganache --chain.chainId 1337

# 终端 2: 部署合约并启动 API
npm run deploy:ganache
npm run api

# 浏览器：打开前端
open demo.html
```

## 📝 详细步骤

### 步骤 1: 启动 Ganache

```bash
# 终端 1
ganache --chain.chainId 1337
```

记录输出：
- RPC URL: `http://127.0.0.1:8545`
- 第一个账户私钥：`0xaa585437a11219b1b440c8f08d4b5cf1660143944c77e38352f7968a74f1ab87`

### 步骤 2: 配置 .env 文件

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件（如需要）
vi .env
```

默认已配置 Ganache 账户私钥。

### 步骤 3: 部署合约到 Ganache

```bash
# 终端 2
npm run deploy:ganache
```

部署成功后输出：
```
✅ 部署成功!
📋 部署信息:
   合约地址：0x5FbDB2315678afecb367f032d93F642f64180aa3
   网络 Chain ID: 1337
```

合约地址自动写入 `.env` 文件。

### 步骤 4: 启动 API 服务

```bash
# 终端 2（同一终端）
npm run api
```

输出示例：
```
============================================================
🚀 API 服务启动成功
   端口：3001
   地址：http://localhost:3001
============================================================
✅ 合约连接成功
   合约地址：0x5FbDB2315678afecb367f032d93F642f64180aa3
   钱包地址：0xA51a4A542890E5E1d318ed130D5a4272D5904e2D
```

### 步骤 5: 打开前端页面

```bash
# 浏览器
open demo.html
```

或在浏览器中手动打开：`file:///path/to/demo.html`

## ✅ 验证连接

打开 `demo.html` 后，应该看到：

1. **API 状态**: 显示 "API 已连接"（绿色徽章）
2. **合约地址**: 显示 `0x5FbDB2315678afecb367f032d93F642f64180aa3`
3. **Chain ID**: 显示 `1337`
4. **钱包余额**: 显示 `100.0000 ETH`（Ganache 初始余额）
5. **日志**: 显示连接成功的日志

## 🎮 使用功能

### 执行交易决策

1. 点击 "执行交易决策" 按钮
2. 观察日志输出：
   - 获取市场数据
   - AI 推理请求
   - 交易执行
   - 合约调用结果
3. 查看更新后的交易次数和 PnL

**后端日志示例:**
```
[2026-04-19T14:50:51.911Z] POST /api/trade/execute
📊 执行交易决策:
   操作：LONG
   交易对：BTC/USDT
   数量：5000 USDT
   价格：65000 USDT
   交易哈希：0x...
   区块确认：1
```

### 执行收益优化

1. 点击 "执行收益优化" 按钮
2. 观察日志输出：
   - 扫描 DeFi 协议
   - 策略存储到链上
   - 最优收益机会
3. 查看更新后的 APY 和预估收益

**后端日志示例:**
```
[2026-04-19T14:50:51.911Z] POST /api/strategy/store
💾 存储策略：yield-opt-v1
   策略哈希：0x8f4cf8a0...
   File ID: bafybei...
   交易哈希：0x...
```

## 🔧 网络配置

项目支持三种网络：

| 网络 | Chain ID | RPC URL | 用途 |
|------|----------|---------|------|
| **Ganache** | 1337 | http://127.0.0.1:8545 | 本地开发（推荐） |
| **Hardhat 本地** | 31337 | 内置 | 快速测试 |
| **0G 测试网** | 16602 | https://evmrpc-testnet.0g.ai | 真实环境 |

### 切换到 0G 测试网

```bash
# 1. 修改 .env 文件
PRIVATE_KEY=你的钱包私钥
ZERO_G_RPC_URL=https://evmrpc-testnet.0g.ai

# 2. 部署到测试网
npm run deploy:testnet

# 3. 修改 api-server.ts 中的 RPC URL
```

## 📊 API 接口说明

### RESTful API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/contract-info` | 获取合约信息 |
| GET | `/api/agent/info` | 获取机器人信息 |
| GET | `/api/wallet/balance` | 获取钱包余额 |
| POST | `/api/agent/register` | 注册机器人 |
| POST | `/api/trade/execute` | 执行交易 |
| POST | `/api/strategy/store` | 存储策略 |
| POST | `/api/inference/record` | 记录推理 |

### 示例调用

```bash
# 健康检查
curl http://localhost:3001/health

# 获取合约信息
curl http://localhost:3001/api/contract-info

# 执行交易
curl -X POST http://localhost:3001/api/trade/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"LONG","symbol":"BTC/USDT","amount":5000,"price":65000}'

# 存储策略
curl -X POST http://localhost:3001/api/strategy/store \
  -H "Content-Type: application/json" \
  -d '{"strategyId":"my-strategy","strategyData":{"name":"Test","targetAPY":0.1}}'
```

## 🔍 日志说明

### 前端日志（demo.html）

显示在页面右下角的日志面板：
- 连接状态
- API 调用结果
- 交易执行结果

### 后端日志（API 服务）

显示在运行 `npm run api` 的终端：
- HTTP 请求日志（时间戳 + 方法 + 路径）
- 合约调用详情
- 交易哈希和确认状态

### Ganache 日志

显示在运行 Ganache 的终端：
- 区块生成
- 交易执行
- 事件日志

## 🎯 完整演示流程

1. **启动所有服务**
   ```bash
   # 终端 1
   ganache --chain.chainId 1337

   # 终端 2
   npm run deploy:ganache
   npm run api
   ```

2. **打开前端**
   ```bash
   open demo.html
   ```

3. **演示交易**
   - 点击 "执行交易决策" 2-3 次
   - 讲解合约调用过程
   - 展示 PnL 变化

4. **演示收益优化**
   - 点击 "执行收益优化"
   - 讲解策略存储到链上
   - 展示 0G Storage 集成

5. **展示区块链验证**
   - 打开 Ganache 界面
   - 查看交易历史
   - 展示合约事件

---

最后更新：2026-04-19
