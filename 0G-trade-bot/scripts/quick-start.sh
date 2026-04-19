#!/bin/bash

echo "============================================================"
echo "🚀 0G Agentic Trading Arena - 快速开始脚本"
echo "============================================================"
echo ""

# 检查 Node.js
echo "📦 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js >= 18"
    exit 1
fi
echo "✅ Node.js: $(node -v)"
echo ""

# 检查 npm
echo "📦 检查 npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ 未找到 npm"
    exit 1
fi
echo "✅ npm: $(npm -v)"
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi
echo "✅ 依赖安装完成"
echo ""

# 创建 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "✅ .env 文件已创建"
    echo "⚠️  请编辑 .env 文件，配置你的私钥"
    echo ""
fi

# 编译合约
echo "📦 编译合约..."
npx hardhat compile

if [ $? -ne 0 ]; then
    echo "❌ 合约编译失败"
    exit 1
fi
echo "✅ 合约编译完成"
echo ""

# 运行测试
echo "🧪 运行单元测试..."
npx hardhat test test/TradingAgent.test.ts --network hardhat

if [ $? -ne 0 ]; then
    echo "❌ 单元测试失败"
    exit 1
fi
echo "✅ 单元测试通过"
echo ""

echo "============================================================"
echo "✅ 安装和测试完成!"
echo "============================================================"
echo ""
echo "💡 下一步:"
echo "   1. 编辑 .env 文件，配置你的私钥"
echo "   2. 运行部署：npm run deploy:local"
echo "   3. 运行演示：npm run dev"
echo "   4. 打开 UI: open demo.html"
echo ""
echo "🔗 0G 测试网 faucet: https://faucet.0g.ai/"
echo ""
