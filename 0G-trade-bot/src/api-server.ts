/**
 * API 服务 - 连接 Ganache 智能合约
 * 提供 RESTful API 给前端调用
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { TradingAgentABI, TradingAgentAddress } from './contracts/TradingAgentABI.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// 初始化 provider 和 contract
let provider: ethers.JsonRpcProvider;
let wallet: ethers.Wallet;
let contract: ethers.Contract;

function initContract() {
  const rpcUrl = 'http://127.0.0.1:8545'; // Ganache RPC
  const privateKey = process.env.PRIVATE_KEY!;
  const contractAddress = process.env.TRADING_AGENT_CONTRACT;

  if (!contractAddress) {
    console.error('❌ 请在 .env 文件中配置 TRADING_AGENT_CONTRACT');
    return false;
  }

  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, TradingAgentABI, wallet);
    console.log('✅ 合约连接成功');
    console.log(`   合约地址：${contractAddress}`);
    console.log(`   钱包地址：${wallet.address}`);
    return true;
  } catch (error) {
    console.error('❌ 合约连接失败:', error);
    return false;
  }
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取合约信息
app.get('/api/contract-info', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: '合约未连接' });
    }

    const contractAddress = await contract.getAddress();
    const network = await provider.getNetwork();

    res.json({
      address: contractAddress,
      chainId: Number(network.chainId),
      rpcUrl: 'http://127.0.0.1:8545'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 注册机器人
app.post('/api/agent/register', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: '合约未连接' });
    }

    const { name } = req.body;
    console.log(`📝 注册机器人：${name}`);

    const tx = await contract.registerAgent(name || 'TradingBot');
    console.log(`   交易哈希：${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   交易确认：${receipt.status}`);

    res.json({
      success: true,
      txHash: tx.hash,
      message: `机器人 ${name} 注册成功`
    });
  } catch (error: any) {
    console.error('❌ 注册失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 执行交易决策
app.post('/api/trade/execute', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: '合约未连接' });
    }

    const { action, symbol, amount, price } = req.body;
    console.log(`📊 执行交易决策:`);
    console.log(`   操作：${action}`);
    console.log(`   交易对：${symbol}`);
    console.log(`   数量：${amount} USDT`);
    console.log(`   价格：${price} USDT`);

    // 生成交易 ID
    const tradeId = ethers.keccak256(
      ethers.toUtf8Bytes(`${symbol}-${action}-${Date.now()}`)
    );

    // 记录交易到合约
    const tx = await contract.recordTrade(tradeId);
    const receipt = await tx.wait();

    console.log(`   交易哈希：${tx.hash}`);
    console.log(`   区块确认：${receipt.status}`);

    // 更新 PnL（模拟）
    const pnl = action === 'BUY' || action === 'LONG' ? 100 : -50;
    const updateTx = await contract.updatePnL(pnl);
    await updateTx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      tradeId,
      pnl,
      message: `交易执行成功`
    });
  } catch (error: any) {
    console.error('❌ 交易失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 存储策略
app.post('/api/strategy/store', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: '合约未连接' });
    }

    const { strategyId, strategyData } = req.body;
    console.log(`💾 存储策略：${strategyId}`);

    // 计算策略哈希
    const strategyHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(strategyData))
    );

    // 模拟 0G Storage File ID
    const fileId = `bafybei${strategyId.toLowerCase().slice(0, 40)}`;

    const tx = await contract.storeStrategy(strategyHash, fileId);
    const receipt = await tx.wait();

    console.log(`   策略哈希：${strategyHash}`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   交易哈希：${tx.hash}`);

    res.json({
      success: true,
      txHash: tx.hash,
      strategyHash,
      fileId,
      message: `策略存储成功`
    });
  } catch (error: any) {
    console.error('❌ 存储失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 记录 AI 推理
app.post('/api/inference/record', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: '合约未连接' });
    }

    const { inputData, outputData } = req.body;
    console.log(`🤖 记录 AI 推理:`);

    const inputHash = ethers.keccak256(ethers.toUtf8Bytes(inputData));
    const outputHash = ethers.keccak256(ethers.toUtf8Bytes(outputData));

    console.log(`   输入哈希：${inputHash}`);
    console.log(`   输出哈希：${outputHash}`);

    const tx = await contract.recordInference(inputHash, outputHash, true);
    const receipt = await tx.wait();

    console.log(`   交易哈希：${tx.hash}`);

    res.json({
      success: true,
      txHash: tx.hash,
      inputHash,
      outputHash,
      message: `推理记录成功`
    });
  } catch (error: any) {
    console.error('❌ 记录失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 获取机器人信息
app.get('/api/agent/info', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: '合约未连接' });
    }

    const agentAddress = req.query.address || wallet.address;
    const info = await contract.getAgentInfo(agentAddress as string);

    res.json({
      name: info.name,
      owner: info.owner,
      active: info.active,
      totalTrades: Number(info.totalTrades),
      totalPnL: Number(info.totalPnL)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取钱包余额
app.get('/api/wallet/balance', async (req, res) => {
  try {
    const balance = await provider.getBalance(wallet.address);
    res.json({
      address: wallet.address,
      balance: ethers.formatEther(balance),
      unit: 'ETH'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 启动服务
const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 API 服务启动成功');
  console.log(`   端口：${PORT}`);
  console.log(`   地址：http://localhost:${PORT}`);
  console.log('='.repeat(60));

  // 初始化合约
  const connected = initContract();
  if (!connected) {
    console.warn('⚠️  合约未连接，部分 API 将不可用');
  }
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务...');
  server.close(() => {
    console.log('✅ 服务已关闭');
    process.exit(0);
  });
});
