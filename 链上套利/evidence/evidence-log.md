# 证据库（evidence-log）

> 格式：编号 | 时间 | 场所/工具 | 观察 | 数值 | 结论
> 规则：只记事实与数值，判断写在结论栏；每条都要能溯源（脚本/截图/链接）。

- E001 | 08-09 | 自写脚本 pool_vs_cex | Uniswap v2 USDC/WETH 池价 vs Binance 中间价 | 池价 $1,919.13 vs CEX $1,922.51，偏差 −0.176%；池费 0.30% | 带内，不是机会（首条亲手验证的"假价差"）
- E002 | 08-10 | LI.FI /quote | 5 组报价 | eco 0.250%/7s；arbitrum 官方桥 0.200%/590s；eco $1k=$10k 同损耗 | 路由按规模切换；小规模无冲击
- E003 | 08-10 | LI.FI widget vs 裸 API | 同笔 $1k USDC→Arb | widget Best Return 0%/18m、Fastest 0.010%；裸 API eco 0.250% | 渠道决定费用层（LIFI Fixed Fee 只在裸 API 出现）
- E004 | 08-10 | LI.FI /advanced/routes | 16 路线菜单 | polymer CHEAPEST 0.293%/1080s；relay FASTEST 0.303%/1s | 成本-时间前沿被意图网络压平（1s vs 18min 差 0.01%）
- E005 | 08-16 | LI.FI 规模扫描 | $1k/$10k/$100k/$500k | 损耗恒为 0.223%；$500k 时 eco 退出前三 | 主流稳定币路线无冲击拐点；意图网络有容量上限
- E006 | 08-16 | LI.FI 菜单对比 | 8/10 vs 8/16 | 总损耗 0.29%→0.223%；CHEAPEST 由 polymer→eco | 费率与路由日级变化，单次报价不可信
- E007 | 08-16 | Relay 直连 API | $1k USDC→Arb | 到账 999.8977，损耗 0.010% | 渠道层级：直连桥 ≈ widget Fastest ＜ 裸 API（0.223%）
- E008 | 待补 | Bungee widget | 同笔 USDC $1k 主网→Arb | 待手动填：路线数/最快与最便宜的到账·费·时·桥名；对比 LI.FI 裸API 0.223% 与 widget 0–0.010% | 目的：场所成本分层证据
