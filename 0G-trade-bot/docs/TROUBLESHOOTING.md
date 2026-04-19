# 故障排除指南

本文档列出常见问题及其解决方案。

## ❌ 依赖安装失败

### 问题：`ERESOLVE unable to resolve dependency tree`

**错误信息:**
```
npm error ERESOLVE unable to resolve dependency tree
npm error Could not resolve dependency:
npm error peer ethers@"^6.14.0" from @nomicfoundation/hardhat-chai-matchers@2.1.2
```

**原因:** `@0glabs/0g-ts-sdk` 需要 `ethers@6.13.1`，但 Hardhat 工具包需要更高版本。

**解决方案:**
```bash
# 使用 --legacy-peer-deps 忽略 peer 依赖冲突
npm install --legacy-peer-deps
```

### 问题：安装后仍然报错

**解决方案:**
```bash
# 清理缓存
rm -rf node_modules package-lock.json

# 重新安装
npm install --legacy-peer-deps
```

---

## ❌ API 服务无法启动

### 问题：`Cannot find module`

**错误信息:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...'
```

**解决方案:**
```bash
# 确保已编译合约
npm run compile

# 重新编译 TypeScript
rm -rf dist
npm run build
```

### 问题：端口被占用

**错误信息:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**解决方案:**
```bash
# 查找占用端口的进程
lsof -i :3001

# 终止进程
kill -9 <PID>

# 或者修改端口（在 .env 文件中）
API_PORT=3002
```

---

## ❌ Ganache 连接失败

### 问题：合约未连接

**症状:** API 日志显示 "合约未连接"

**解决方案:**
1. 检查 `.env` 文件中的 `TRADING_AGENT_CONTRACT`
2. 确认 Ganache 正在运行：`curl http://127.0.0.1:8545`
3. 重新部署合约：`npm run deploy:ganache`

### 问题：Ganache 未启动

**症状:** API 日志显示 "连接失败" 或超时

**解决方案:**
```bash
# 检查 Ganache 是否运行
curl http://127.0.0.1:8545

# 如果没有响应，启动 Ganache
ganache --chain.chainId 1337
```

---

## ❌ 前端无法连接

### 问题：demo.html 显示 "连接中..."

**解决方案:**
1. 确认 API 服务正在运行：`curl http://localhost:3001/health`
2. 检查浏览器控制台是否有错误
3. 确认没有 CORS 问题（API 已启用 CORS）

### 问题：点击按钮无响应

**解决方案:**
1. 检查浏览器控制台错误
2. 确认 API 服务正常：`curl http://localhost:3001/health`
3. 查看 API 日志是否有请求记录

---

## ❌ 合约部署失败

### 问题：余额不足

**错误信息:**
```
❌ 余额不足！从 faucet 获取测试币
```

**解决方案 (Ganache):**
- Ganache 账户默认有 100 ETH，检查私钥是否正确

**解决方案 (0G 测试网):**
- 访问 [0G Faucet](https://faucet.0g.ai/) 获取测试币

### 问题：部署超时

**解决方案:**
```bash
# 增加超时配置（hardhat.config.cjs）
zerog_testnet: {
  timeout: 60000  // 60 秒超时
}
```

---

## ❌ 测试失败

### 问题：`require is not defined`

**错误信息:**
```
ReferenceError: require is not defined in ES module scope
```

**原因:** 项目使用 ES 模块（`"type": "module"`），但测试文件使用了 CommonJS 语法。

**解决方案:** 使用 `.cjs` 扩展名的测试文件：
```bash
# 正确的命令
npm run test:contract
# 等价于：npx hardhat test test/TradingAgent.test.cjs --network hardhat
```

---

## 🆘 获取帮助

如果以上解决方案无法帮助到你：

1. **检查日志:** 查看详细错误信息
2. **查看文档:** `docs/USAGE_GUIDE.md`
3. **0G 文档:** https://docs.0g.ai/
4. **0G Discord:** https://discord.gg/0glabs

---

最后更新：2026-04-19
