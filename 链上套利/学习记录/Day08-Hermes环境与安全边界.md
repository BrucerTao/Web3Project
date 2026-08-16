# Day 8 | 搭 Hermes Agent + 立安全边界

> 日期：2026-08-16 · 原计划日期：08-12
> **交付物 1**：`docs/agent-safety-rules.md`（安全红线 v1）
> **交付物 2**：环境配置笔记（本文 §4）
> **交付物 3**：第一个 Agent 任务规格（§5）

---

## 1. Hermes 是什么、为什么是它

- Nous Research 开源（MIT）的**自托管、自我改进** Agent：持久记忆、跑通复杂任务后**自动把经验写成 skill**、可接 Telegram/Discord、任意 LLM provider。
- 对咱们的意义：把"一次性观察"变成"持续工作流"——监控（cron）、告警（Telegram）、证据整理（memory）、研究拆解（subagent）。
- 概念映射：skill = 我们的 SOP；memory = 证据库的延伸；cron = Day 11 监控；Telegram = 告警通道。
- Bruce 路线：**先本地跑通；真要执行策略时再上服务器 + Telegram**。照做。

## 2. 先立边界再给权力

安全红线见 `docs/agent-safety-rules.md`，七条：私钥零接触 / 权限最小化 / 域名白名单 / 防 prompt 注入 / 行动审批 / 密钥管理 / 损失隔离。
核心逻辑：**Agent 读的外部内容可能攻击它自己，所以防御不靠"相信它"，靠"它没有可伤害你的权限"**。

## 3. 安装

官方一键：`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`
（自动装 uv/Python3.11/Node/ripgrep/ffmpeg；装在 ~/.hermes，不污染系统。）

## 4. 环境配置笔记

- 安装状态：✅ v0.20.1（2026-08-16），~/.hermes/hermes-agent；CLI 验证通过（`hermes --version`）
- 安装实录教训：① 一键脚本先试 SSH clone，本机端口 22 挂起 → 用 GIT_SSH_COMMAND=false 强制 HTTPS 回退；② 浏览器工具（playwright）步骤静默挂起 → 杀掉收尾，核心不受影响（浏览器工具为可选项）；③ ffmpeg 未装（TTS 用，可选）。
- 命令入口：~/.local/bin/hermes（软链）；若不在 PATH 用全路径 ~/.hermes/hermes-agent/venv/bin/hermes
- LLM provider：✅ 阿里云百炼 Token Plan（复用 Codex/cc-switch 同一把 key，openai-api 直连兼容端点，详见 §4.1）
- 首次运行：`hermes`（TUI）；验证只读任务跑通。

### 4.1 LLM Provider 实测配置记录（2026-08-16）

**路线选择**：百炼 Token Plan 的 key 本来就是"一钥双格式"（OpenAI 兼容 + Anthropic 兼容，Codex 和 cc-switch 各用一边）。Hermes 走 **OpenAI 兼容路线**：`openai-api` provider + `OPENAI_BASE_URL` 覆盖，不引入任何新 key。

| 项 | 值 |
|---|---|
| Provider | `openai-api`（OpenAI 兼容直连） |
| Base URL | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| 默认模型 | `qwen3.8-max`（与 Codex 主力一致） |
| Key 存放 | `~/.hermes/.env` 的 `OPENAI_API_KEY`（从环境变量复制，明文不落任何笔记） |

同一把 key 可切换的模型：`qwen3.7-max` / `glm-5` / `qwen3.6-plus` / `MiniMax-M2.5` / `deepseek-v3.2`。会话内 `/model` 切换，或 `hermes chat -m <模型名>` 临时指定。

**配置明细**（非密项全部用 `hermes config set` 落盘）：

```bash
# ~/.hermes/.env（密钥层）
OPENAI_API_KEY=***（与 Codex 复用同一把，不进本文档）
OPENAI_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1

# ~/.hermes/config.yaml（非密层）
model.provider        = openai-api
model.default         = qwen3.8-max
model.base_url        = https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
terminal.cwd          = /Users/huangtao/mybiz/链上套利   # Hermes 默认工作目录=本项目
cron.model            = qwen3.6-plus      # Day 11 监控轮询用便宜模型
cron.model_provider   = openai-api        # 配合 model_drift_guard，切聊天模型不影响 cron
approvals.mode        = smart             # 危险命令需人工批准
approvals.cron_mode   = deny              # 定时任务遇危险命令直接拒绝
```

**验证三连**：
1. curl 直测端点 `/chat/completions` → qwen3.8-max 正常返回 ✅
2. `hermes chat -q "只回复两个字:成功"` → 返回"成功"，全链路通 ✅
3. `hermes doctor` + `doctor --fix` → 配置迁移完成；遗留 3 项均不阻塞（2 个 npm 组件漏洞待 `hermes update` 顺带解决；web 搜索等可选工具 key 未配，研究任务可用终端 curl 抓公开页面兜底）

**与红线的关系**：该 provider 只接百炼推理端点，不碰任何钱包/签名接口，"私钥零接触"天然成立；加上 approvals smart + cron deny，即为 Day 8"安全边界"的具体落地。

**Q3（追问）：为什么不走 OpenRouter / Nous Portal？**
已有百炼 Token Plan（Codex、cc-switch 都在用同一把 key），端点本身就是 OpenAI 兼容格式，`openai-api` + 自定义 base_url 直连即可——不用新申请 key、不过第三方中转、不多一层信任面。注意 Hermes 另有一个 first-class provider `alibaba-coding-plan`，那是 Coding Plan SKU（coding-intl.dashscope.aliyuncs.com），与 Token Plan 端点不同，不要混用。

---

## 5. 第一个 Agent 任务规格

> 任务：整理 eco / across / relay / stargate / polymer / squid / celer / mayan / hop / Arbitrum 官方桥 共 10 座桥的：收费模型（固定/%/谁付 gas）、典型速度、历史安全事件（时间/金额/原因）。输出表格，每条注明来源 URL，保存到 `evidence/bridges-fee-risk.md`。
> 验收：每条有来源；无来源的格子写"未知"（不许编）——铁律一的应用。

该任务直接给检查表"桥风险"项供数，并与 Day 6-7 的信任光谱互证。

---

## 今日作业

1. 读一遍安全红线，把"我已知晓并遵守"和日期写进文档末尾；
2. 备一个 LLM API key（本地配置好后回我"key 好了"——**key 本身永远不要发给我**）；
3. key 好后我们一起跑第一个任务。

## 学习记录

- 日期：2026-08-16
- 完成情况：□ 红线已签 ☑ 安装完成 ☑ key 已本地配置（2026-08-16，见 §4.1） □ 首任务已跑（已在其他地方跑，产出待归档到 evidence/）

**Q1（追问）：安装用了什么、步骤、装了哪些？**
总指挥=官方 bash 一键脚本；干活=uv（Python 侧）+npm（Node 侧）。uv=Astral 的 Rust 写超快 Python 包/环境管理器，Hermes 自带 managed uv 建隔离 venv。
步骤：检测macOS→装managed uv 0.12.5→复用系统Python3.11.15/Git2.39.2/ripgrep15.2→系统npm不兼容.npmrc故装隔离Node26.7→ffmpeg跳过(可选TTS)→SSH克隆卡死改HTTPS→建venv→依赖先试uv.lock层失败回退PyPI解析装[all]249包→npm装777包后playwright步挂起被杀(可选)→手动软链~/.local/bin/hermes→验证v0.20.1。
落盘：~/.hermes/{bin,node,hermes-agent{,venv,node_modules}} + ~/.local/bin/hermes。
两个回退教训：SSH→HTTPS、lockfile→PyPI——主路不通有备路。

**Q2（追问）：key 配置是写 .env 还是 CLI 里配？**
两条路终点相同：密钥落 ~/.hermes/.env；config.yaml 只存非密(model/provider)。
手动版：cp .env.example ~/.hermes/.env → 填 OPENROUTER_API_KEY 等 → chmod 600 → hermes model → hermes doctor / hermes -z 验证。
向导版：hermes setup 自动完成。
provider 支持：OpenRouter/Fireworks/NovitaAI/Gemini/OpenCode Zen(GPT/Claude/GLM/Kimi)/HuggingFace/本地Ollama；OpenAI/Anthropic 直连非主路径（走 OpenRouter/OpenCode Zen 或 login/OAuth proxy）。
安全：.env 在 ~/.hermes（项目仓库外，天然防 git 误提交）；chmod 600；key 不进聊天/截图。进阶：hermes secrets 接 Bitwarden/1Password。

**Q3（首任务实战实录，2026-08-16 晚）**
- 连通性：`hermes -z "回复两个字"` 4.6s ✓；单工具任务（terminal curl ping）15s ✓ → 环境与模型通道正常。
- 多步研究任务（3-10 座桥检索+写文件）极慢：xhigh 推理每回合分钟级 + 多次 curl 超时叠加，10 桥任务 10 分钟未闭环。非故障，是延迟结构问题。
- 运维教训：① -z 只打印最终结果，过程要看 logs/TUI；② 无 TTY 时审批会挂起 → 研究类任务用 --yolo + 严格 prompt 约束（不涉资金、限定写目录）；③ --reasoning low/medium 可大幅提速研究类任务；④ web 工具需额外 key（Firecrawl/Tavily 等），缺 key 时 Agent 只能靠 terminal curl；⑤ 首跑 SSH clone 卡端口22 → GIT_SSH_COMMAND=false 回退。
- 安全实践复盘：本次 --yolo 是"纯研究+限定写目录+不涉资金"的受控例外（R5 允许的学习期研究）；真实执行阶段仍须人工审批。
- 待办：10 桥完整表（任务规格见 §5）改在学员本机终端后台跑，或换更快 provider 后跑；产出落 evidence/bridges-fee-risk.md。

**清理与约定（2026-08-16 21:24）**：首任务后台跑通并产出 bridges-fee-risk.md（质量良好：用 DefiLlama hacks 库查证、"无公开记录"标注诚实、Kelp 事件不计入 Stargate；缺陷 Sources 空 → 已用归档文件名反推 URL 补全）。中间缓存（~5MB HTML/txt/json/脚本/raw/tmp）已按用户要求删除。**新约定：以后 Agent 任务的中间产物一律落 /tmp，evidence/ 只收正式证据文件。**
