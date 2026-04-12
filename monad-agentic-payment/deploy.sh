#!/bin/bash
# Monad Agentic Payment 部署脚本
# 用法：./deploy.sh root@47.76.165.57

set -e

REMOTE_HOST="${1:-root@47.76.165.57}"
REMOTE_DIR="/root/monad-agentic-payment"
PACKAGE_FILE="/tmp/monad-deploy.tar.gz"

echo "=== Monad Agentic Payment 部署脚本 ==="
echo "目标服务器：$REMOTE_HOST"
echo "目标目录：$REMOTE_DIR"

# 1. 创建部署包
echo "[1/6] 创建部署包..."
cd "$(dirname "$0")"
tar --exclude='node_modules' --exclude='dist' --exclude='data' --exclude='.git' \
    -czf "$PACKAGE_FILE" .

# 2. 上传到服务器
echo "[2/6] 上传代码到服务器..."
scp "$PACKAGE_FILE" "$REMOTE_HOST:/tmp/"

# 3. SSH 执行部署
echo "[3/6] 在服务器上安装部署..."
ssh "$REMOTE_HOST" << 'ENDSSH'
set -e

REMOTE_DIR="/root/monad-agentic-payment"

# 创建目录
mkdir -p $REMOTE_DIR

# 解压代码
tar -xzf /tmp/monad-deploy.tar.gz -C $REMOTE_DIR
cd $REMOTE_DIR

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js 未安装，请手动安装：curl -fsSL https://npmjs.org/install.sh | sh"
    exit 1
fi

echo "Node.js 版本：$(node -v)"
echo "NPM 版本：$(npm -v)"

# 安装依赖
echo "安装依赖..."
npm install

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "警告：.env 文件不存在，请配置必要的环境变量"
fi

echo "[4/6] 配置完成!"
echo "[5/6] 启动服务..."

# 停止旧进程
pkill -f "tsx src/ui-server.ts" 2>/dev/null || true

# 启动 UI 服务
cd $REMOTE_DIR
nohup npm run ui > /var/log/monad-ui.log 2>&1 &

echo "[6/6] 部署完成!"
echo ""
echo "=== 访问信息 ==="
echo "Web UI: http://$(hostname -i):3847"
echo "日志文件：/var/log/monad-ui.log"
echo ""
echo "管理命令:"
echo "  查看日志：tail -f /var/log/monad-ui.log"
echo "  重启服务：pkill -f 'tsx src/ui-server.ts' && npm run ui &"
echo "  停止服务：pkill -f 'tsx src/ui-server.ts'"
ENDSSH

echo ""
echo "=== 部署完成 ==="
echo "请确保阿里云安全组已开放端口 3847"
echo "访问：http://47.76.165.57:3847"
