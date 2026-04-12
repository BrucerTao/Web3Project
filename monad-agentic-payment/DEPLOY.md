# 部署到阿里云服务器指南

## 准备工作

1. **确保服务器已安装 Node.js**（v18+）
```bash
ssh root@47.76.165.57
node -v  # 检查版本
```

如果未安装 Node.js：
```bash
curl -fsSL https://npmjs.org/install.sh | sh
```

2. **配置阿里云安全组**
   - 登录阿里云控制台
   - 进入 ECS → 安全组
   - 添加入站规则：端口 `3847`，协议 `TCP`

## 部署方法

### 方法一：使用部署脚本（推荐）

```bash
cd /Users/huangtao/mybiz/Web3Project/monad-agentic-payment
./deploy.sh root@47.76.165.57
```

### 方法二：手动部署

```bash
# 1. 打包代码
tar --exclude='node_modules' --exclude='dist' --exclude='data' --exclude='.git' \
    -czf /tmp/monad-deploy.tar.gz -C /Users/huangtao/mybiz/Web3Project monad-agentic-payment

# 2. 上传
scp /tmp/monad-deploy.tar.gz root@47.76.165.57:/root/

# 3. SSH 登录安装
ssh root@47.76.165.57
cd /root
tar -xzf monad-deploy.tar.gz
cd monad-agentic-payment
npm install

# 4. 启动服务
npm run ui &
```

### 方法三：使用 systemd 服务（生产环境）

```bash
# 上传服务配置
scp monad-ui.service root@47.76.165.57:/etc/systemd/system/

# SSH 登录配置
ssh root@47.76.165.57
systemctl daemon-reload
systemctl enable monad-ui
systemctl start monad-ui
systemctl status monad-ui
```

## 访问服务

```
http://47.76.165.57:3847
```

## 常用命令

```bash
# 查看日志
tail -f /var/log/monad-ui.log

# 重启服务
systemctl restart monad-ui
# 或如果使用后台运行：
pkill -f 'tsx src/ui-server.ts' && cd /root/monad-agentic-payment && npm run ui &

# 停止服务
systemctl stop monad-ui
# 或：
pkill -f 'tsx src/ui-server.ts'

# 查看进程
ps aux | grep monad
```

## 更新代码

```bash
# 本地执行
./deploy.sh root@47.76.165.57

# 或手动更新
scp /tmp/monad-deploy.tar.gz root@47.76.165.57:/root/
ssh root@47.76.165.57
cd /root/monad-agentic-payment
tar -xzf /tmp/monad-deploy.tar.gz
npm install
systemctl restart monad-ui  # 或 pkill 后重启
```

## 安全检查清单

- [ ] `.env` 文件中的私钥已正确配置
- [ ] 阿里云安全组端口 3847 已开放
- [ ] Node.js 版本 >= 18
- [ ] 服务已启动并可访问
- [ ] 日志文件可正常写入
