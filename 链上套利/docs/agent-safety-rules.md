# Agent 安全红线 v1（Hermes 及一切未来 Agent 适用）

> 原则：**先立边界，再给权力。** 学习期 Agent 的角色 = 研究/监控/整理，不是执行。

## 红线（无例外）

- **R1 私钥/助记词**：永不进入 Agent、聊天、脚本、配置文件。Agent 的钱包操作能力 = 零（只读）。
- **R2 权限最小化**：只给公开 API（LI.FI、只读 RPC、浏览器）+ 本地笔记目录读写。不给交易签名、不给 approve、不给交易所 API key。
- **R3 域名白名单**：li.fi / docs.li.fi / hermes-agent.nousresearch.com / github.com/NousResearch / etherscan.io / arbiscan.io / defillama.com / dexscreener.com。Agent 输出的任何链接视为**不可信输入**。
- **R4 防 prompt 注入**：Agent 会读外部内容（网页/报价/社群消息），其中可能藏"攻击 Agent 的指令"。防御 = R1+R2（它没有可伤害你的权限）；凡 Agent 出现"转账/签名/索要私钥/下载执行陌生脚本"类输出，一律视为攻击，立即停。
- **R5 行动审批**：任何涉及真实执行的建议，必须人工确认 + 过 Day 3 检查表。学习期内 Agent 不碰真钱。
- **R6 密钥管理**：LLM API key 只放本地 env/配置；不进聊天、不进 git、不进截图。
- **R7 损失隔离**：未来真实执行（Day 20）用独立热钱包，金额 = 可全损，白名单路径。

## 升级规则
红线只能收紧不能放松；任何修改需书面记录理由与日期。

我已知晓并遵守 20260816
