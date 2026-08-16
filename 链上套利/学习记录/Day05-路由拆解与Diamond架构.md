# Day 5 | 读 LI.FI 文档：路由拆解图与 Diamond 架构

> 日期：2026-08-10 · 原计划日期：08-09
> 交付物：《路由拆解图》+ 多路线工具 `scripts/lifi_routes.py`

---

## 1. /quote vs /advanced/routes：单点答案 vs 完整菜单

- `/quote`：返回**一条**最优路线（聚合器替你选）；
- `/advanced/routes`（POST）：返回**全部候选路线**（今天拉到 16 条，16 座桥）。
- 对套利者，菜单比答案重要：你要看的是**成本-时间前沿**，然后按自己的 ⑥（延迟风险）和窗口自己选——聚合器的"最优"不等于你的最优（它的 RECOMMENDED 可能含商业权重）。

## 2. 现场 16 路线前沿（USDC $1k 主网→Arbitrum，2026-08-10）

| # | 损耗 | 耗时 | 桥 | tags |
|---|---|---|---|---|
| 1 | 0.293% | 1080s | polymerStandard | RECOMMENDED,CHEAPEST |
| 4 | 0.302% | 16s | lifiIntents | |
| 7 | 0.303% | **1s** | relaydepository | FASTEST |
| 8 | 0.304% | 2s | across | |
| 12 | 0.322% | 44s | near | |
| 13 | 0.333% | 197s | stargateV2 | |

观察：
1. **成本-时间权衡的精确形状**：relay 1s vs polymer 18min，价差仅 0.01%——秒级几乎免费，慢桥不再便宜。意图网络把前沿压平了。
2. **路由实时变化**：今早 /quote 最优是 eco，几小时后 eco 不在前 16——Day 6 系统观察这个切换。
3. 所有路线损耗都在 0.29%+：其中约 0.25% 是 LIFI Fixed Fee（裸 API 渠道），桥本身成本只剩 0.04-0.12%。

## 3. 路由拆解图（steps 解剖）

step 的四种类型：
- `swap`：某条链上的 DEX 兑换（风险：滑点⑤ + 主网 MEV 被夹 → 用私有 RPC 缓解）
- `cross`：桥（风险：桥安全 + 延迟⑥）
- `lifi`：桥把 swap+cross 打包在一个 diamond 调用里（如 celer circle 内部完成 ETH→USDC）
- `protocol`：feeCollection（LI.FI 收费步骤）

**图 A：USDC→USDC（今早 quote）**
```
[protocol: feeCollection]  →  [cross: eco]
   LI.FI 固定费 0.25%          桥费≈0 / 延迟 7s / 桥风险=eco
```
**图 B：ETH→USDC（advanced/routes 路线1）**
```
[lifi: celercircle]  内含 swap+cross
   fee: LIFI Fixed $4.70 + Transaction Fee $0.10；延迟 973s；桥风险=celer
```
**风险点定位练习**：每张图里标出 ⑤ 在哪步、⑥ 在哪步、桥风险在哪步、LI.FI 对手方风险在哪步。

## 4. Diamond 架构（EIP-2535）：为什么这样设计

- LI.FI 链上执行器 = 一个代理合约（Diamond）+ 多个 facet（每个 facet = 一个桥/DEX 集成模块）；
- **加一座桥 = 加一个 facet**，不用重新部署主合约 → 30+ 桥 × 频繁升级才管得过来；
- **approve 集中在 Diamond 代理上**：用户一次授权、所有桥复用 → 省 Gas 省交互；
- **代价 = 风险集中**：代理持有所有授权，一个 facet 有漏洞就波及全部（2024-03 被盗 ~$10M 正是此类）。
- 对套利者的含义：大额资金不过聚合器合约（执行直连桥），既是省 0.25%，也是避开这个集中风险面。

## 5. raw 数据里的安全细节

tokens 字段带 `verificationStatus: verified`（hypernative 提供）——LI.FI 替你做了一部分 Day 3 安全检查①，但**不盲信**：它是参考层，不是免责层。

---

## 今日作业

1. 看 16 路线表：本金 $1,000、机会窗口估计 5 分钟，哪些路线"可执行"？（条件：耗时 < 窗口 且 扣完费有正余量）——练 ⑥ 与菜单联用。
2. Diamond 为什么能不重部署加桥？approve 集中的代价是什么？（用自己的话）
3. 观察任务（持续）：每天跑两次 `python3 scripts/lifi_routes.py 1 42161 <usdc_eth> <usdc_arb> 1000000000`，记录谁拿 CHEAPEST/FASTEST——Day 6 的分析素材。

## 学习记录

- 日期：2026-08-10
- 完成情况：☑ 作业1（导师代解+讲解） ☑ 作业2（批改：前半对，后半修正为安全风险集中） ☑ 观察任务承诺每日记录

## 作业批改（2026-08-16）

**题1 解答**：① 时间过滤(<300s)淘汰 polymerStandard(CHEAPEST,1080s)/glacis/celercircle/mayanMCTP/celercirclefast → 关键发现：CHEAPEST 因太慢出局，"最便宜"≠"你能用"；② 留下最便宜簇 squid/lifiIntents/relay/across/layerswap(0.298–0.305%)；③ 可执行条件：价差 > 实际执行渠道路线成本 + 2×估算误差；裸 API 成本含 0.25% 渠道费，直连桥真实成本 ~0.05–0.1% → 渠道选择决定一半利润。
**题2 批改**：前半对（空壳代理→加 facet 不重部署）；后半错：approve 集中的代价不是"等待处理"，是安全风险集中——任一 facet 漏洞可掏走全部授权（2024-03 $10M 即此）。
**题3**：承诺每日记录；最小日志格式：日期时间 | CHEAPEST=谁(损耗) | FASTEST=谁(损耗/耗时) | 前三名单。


---

## 名词表（2026-08-16 补充）

### 一、接口与工具
- **/quote**：LI.FI 的"要一个最优答案"接口。
- **/advanced/routes**：LI.FI 的"看完整菜单"接口（POST），一次返回全部候选路线。
- **lifi_routes.py**：我们自写的菜单接口一键封装脚本。

### 二、路由解剖
- **route（路线）**：一条完整跨链路径。
- **step**：路线里的一小步。
- **swap**：同链内兑换（DEX 上换币）。
- **cross**：过桥（资产跨链移动）。
- **lifi（step 类型）**：桥把兑换+过桥打包进一次链上操作，一气呵成。
- **protocol / feeCollection**：收费步骤，LI.FI 的 0.25% 在这里收。
- **tool**：每步具体用的服务商（哪座桥/哪个 DEX）。

### 三、费用名目
- **LIFI Fixed Fee**：聚合器"过路费"0.25%；渠道相关（widget 不收、裸 API 收）。
- **Relayer / Relayer fee**："快递员"——在目标链先垫钱给你的角色，收费即 Relayer fee；Relayer gas fee 是快递员垫付的汽油钱。
- **gasCostUSD**：预估 Gas 折美元。

### 四、架构
- **Diamond 架构 / EIP-2535**："插拔式"合约标准（2535 是蓝图编号）；空壳主合约 + 可热插拔模块。
- **proxy（Diamond 主合约）**：空壳房东，接客+分发给模块，集中持有所有授权。
- **facet**：插件模块；每个桥集成一个 facet；加桥 = 加 facet，不动主合约。
- **approve（授权）**：允许某合约动你最多 X 币；授权集中在 Diamond = 方便但风险集中。

### 五、菜单标签
- **RECOMMENDED**：聚合器推荐（可能含商业权重）；**CHEAPEST**：到账最多；**FASTEST**：最快。

### 六、桥名（菜单里出现的，分组建立直觉）
- 意图型（快递员垫资、秒级）：across、relay、near（NEAR Intents）、eco、lifiIntents、glacis。
- 池子/金库型（经金库搬运、较慢）：stargateV2（LayerZero 系）、polymer（IBC 系）、squid（Axelar 系）、celer/celercircle（Celer，circle 模式走 Circle 销毁/铸造）、symbiosis、mayan（Solana↔EVM 见长）、layerswap。

### 七、安全与概念
- **verificationStatus / hypernative**：LI.FI 附的代币安全认证标；hypernative 是提供认证的第三方机构。参考层不是免责层。
- **私有 RPC**：发交易的"专线"，不进公共候单厅，抢跑机器人看不见 → 防被夹。
- **成本-时间前沿**：所有路线在"成本×时间"两轴上的最优组合边界线。
- **intent（意图网络）**：只声明想要的结果，专业玩家竞标实现；秒级跨链背后的机制。
- **⑤ / ⑥**：Day 3 检查表第 5、6 项：滑点/价格冲击、延迟风险。
