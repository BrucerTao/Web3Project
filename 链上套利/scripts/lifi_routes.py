#!/usr/bin/env python3
"""
lifi_routes.py — 拉取 LI.FI 全部候选路线（成本-时间前沿），Day 5 产出，Day 6 观察工具。
用法: python3 lifi_routes.py <fromChainId> <toChainId> <fromToken> <toToken> <fromAmount>
示例: python3 lifi_routes.py 1 42161 0xa0b8...eb48 0xaf88...5831 1000000000
"""
import json, sys, urllib.request
ADDR = "0x1111111111111111111111111111111111111111"
def main():
    fc, tc, ft, tt, amt = sys.argv[1:6]
    body = json.dumps({"fromChainId": fc, "toChainId": tc,
        "fromTokenAddress": ft.lower(), "toTokenAddress": tt.lower(),
        "fromAmount": amt, "fromAddress": ADDR, "toAddress": ADDR}).encode()
    req = urllib.request.Request("https://li.quest/v1/advanced/routes", data=body,
        headers={"Content-Type": "application/json", "User-Agent": "curl/8.4"})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    rs = sorted(d.get("routes", []), key=lambda r: -float(r["toAmountUSD"]))
    frm = float(rs[0]["fromAmountUSD"]) if rs else 1
    print(f"{'#':>2} {'到账USD':>9} {'损耗%':>7} {'gas$':>6} {'tags':18} 路线(耗时)")
    for i, r in enumerate(rs):
        to = float(r["toAmountUSD"])
        tools = "→".join(s.get("tool", "?") for s in r["steps"])
        durs = sum(s.get("estimate", {}).get("executionDuration", 0) or 0 for s in r["steps"])
        print(f"{i+1:>2} {to:>9,.2f} {(frm-to)/frm*100:>6.3f}% {float(r['gasCostUSD']):>6.2f} "
              f"{','.join(r.get('tags', []))[:18]:18} {tools} ({durs}s)")
if __name__ == "__main__":
    main()
