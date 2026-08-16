# 跨链桥对比:Across / Relay / Stargate(收费模型、典型速度、历史安全事件)

> 数据采集方式:terminal curl -sL --max-time 15,带 User-Agent 头,抓取日期 2026-08-16。
> 所有结论均来自下列已抓取页面;无法从来源证实的内容一律不写或标注"无公开记录"。

## 对比总表

| 维度 | Across | Relay | Stargate |
|---|---|---|---|
| 收费模型 | 无固定过桥费,按路线市场化定价[2];总费用 = 输入−输出,拆分为 LP 费(利用率定价,Aave 式双斜率模型,随池子利用率沿曲线上升,超过"kink"阈值后陡增)[1]与 Relayer 费(覆盖 gas、资本机会成本、风险)[1];LP 费按路由/代币单独设参(R0/R1/R2/Ū)[1] | 四类费用:执行费($0.02 固定费 + 目的链 fill gas)、Swap 费(DEX 费+滑点+Solver 再平衡费)、Relay 费(API 网关固定 bps 费)、App 费(集成方自加 bps)[6];Relay 费标准费率:代币桥/同链 wrap-unwarp 0.00%、稳定币 swap 0.01%、主流币 swap 0.06%、小众币 swap 0.15%[6];支持 Fee Sponsorship 由集成方补贴[6] | 动态费率,由 AI Planning Module 按路径逐条设定;从 Pool 代币转出可收取 treasury fee 或反向给用户 reward(Hydra OFT 无 reward 只有 treasury fee)[10];费用可为负(reward),滑点过高时合约以 SlippageTooHigh 回滚[10];UI 提供 Fastest Route(快但略贵)与 Cheapest Route(便宜但略慢)两种路由[13] |
| 典型速度 | 主网 sub-2 秒到账(fill),官方称"~2 秒"[2] | 设计目标为亚秒级 fill(乐观执行:solver 在源链终局前就 fill,无竞价延迟)[7];Fast Fill 功能可在存款上链前加速目的链 fill[9] | Taxi 模式:立即发送全链消息、即时跨链到账;Bus 模式:交易批量处理、gas 更便宜,但目的链到账需等待(凑满 2–10 个"乘客"才发车,也可买票 driveBus)[11];官方文档未给出具体秒数,UI 显示预估转账时间[13] |
| 历史安全事件 | DefiLlama hacks 库收录 1 条:2026-07-17 "Across",分类 Protocol Logic,手法 Log Spoofing,损失 $3,600,000,Solana 链,bridgeHack=true[5] | 在 DefiLlama hacks 库(623 条记录)中检索 relay/relay.link 无任何匹配条目;官方安全页亦未披露历史被黑事件 → 无公开记录(截至 2026-08-16 本次检索)[5][8] | 在 DefiLlama hacks 库中检索 stargate 无匹配条目;官方安全页自称"协议自成立起未发生过严重安全事件"[12] → 无公开记录(截至 2026-08-16 本次检索)[5][12] |

## 安全机制与审计(补充)

| 桥 | 安全模型要点 | 审计/赏金 |
|---|---|---|
| Across | 乐观验证(optimistic verification):提案默认有效,除非被挑战;被 DVM 裁定无效的提案者损失质押金;经济安全由 Across Bond Token(ABT)支撑[3] | 有独立审计页(Across V3、V3 增量、Token、V2、UMA 系列审计)[4] |
| Relay | 非托管结算:用户资金存入 Depository 托管,solver 用自有资金在目的链 fill 后凭 Oracle 证明结算;"资金通常只被托管数秒到数分钟,而非数小时或数天";无管理员后门提款函数;Security Council 多签可暂停提款者[8] | 官方安全页列出 Trust Model/Audits/Bug Bounty 章节[8] |
| Stargate | 官方表述:"协议自成立起未发生过严重安全事件,已成为业内最受信任的桥之一"[12] | Zellic、OtterSec 对 Stargate V2 的最终审计报告;与 ImmuneFi 合作的赏金计划(官方称"业内最大赏金之一")[12] |

## 关于"历史安全事件"栏的说明

- 判断依据是 DefiLlama hacks 数据库(api.llama.fi/hacks,共 623 条被黑记录)按桥名全文检索,以及三家官方文档安全页[5][8][12]。
- Across 有 1 条收录记录(2026-07-17,Solana,$3.6M,Log Spoofing)[5];该条目来自结构化数据库字段(name/classification/technique/amount/chain),条目本身无附文 URL。
- Relay 与 Stargate 在该数据库中无匹配条目,官方文档亦未披露被黑事件,故记"无公开记录"。注意:"无公开记录"不等于"绝对没有发生过任何事故",仅代表本次检索范围内未见可靠记载。
- 与 LayerZero 相关的 Kelp($293M,2026-04-18,LayerZero OFT bridge exploit)受害者是 Kelp DAO,Stargate 本身未被列入,故不计入 Stargate 名下[5]。

## Sources

[1] https://docs.across.to/introduction/fees
[2] https://docs.across.to/introduction/why-across
[3] https://docs.across.to/introduction/security
[4] https://docs.across.to/introduction/audits
[5] https://api.llama.fi/hacks
[6] https://docs.relay.link/references/api/api_core_concepts/fees
[7] https://docs.relay.link/references/protocol/overview
[8] https://docs.relay.link/references/protocol/security
[9] https://docs.relay.link/features/fast-fill
[10] https://docs.stargate.finance/developers/protocol-docs/fees
[11] https://docs.stargate.finance/primitives/concepts/transport
[12] https://docs.stargate.finance/resources/security
[13] https://docs.stargate.finance/user-docs/transfer

- [1] https://docs.across.to/introduction/why-across （LP 费/利用率定价）
- [2] https://docs.across.to/ （主站：sub-2s fill、市场化定价）
- [3] https://docs.across.to/introduction/audits （乐观验证/ABT，见安全机制表）
- [4] https://docs.across.to/introduction/audits （审计列表）
- [5] https://api.llama.fi/hacks （DefiLlama hacks 库，623 条）
- [6] https://docs.relay.link/references/api/core-concepts/fees （四类费用/标准费率）
- [7] https://docs.relay.link/references/protocol/how-it-works （乐观执行/亚秒 fill）
- [8] https://docs.relay.link/references/protocol/security （非托管结算/Security Council）
- [9] https://docs.relay.link/features/fast-fill （Fast Fill）
- [10] https://docs.stargate.finance/developers/protocol-docs/fees （动态费率/treasury fee/reward）
- [11] https://docs.stargate.finance/primitives/concepts/transport （Taxi/Bus 模式）
- [12] https://docs.stargate.finance/resources/security （安全声明/审计/赏金）
- [13] https://docs.stargate.finance/introduction/overview （Fastest/Cheapest 路由）
- 附：https://docs.relay.link/security/bounties ；https://docs.across.to/introduction/bug-bounty
> 注：以上 URL 由归档文件名反推（原始 HTML 缓存已于 2026-08-16 清理）；[5] 为结构化数据库。
