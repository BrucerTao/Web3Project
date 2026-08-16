#!/usr/bin/env python3
"""
lifi_quote.py — LI.FI 报价查询工具（Day 4 产出，Day 9 监控脚本的地基）
用法: python3 lifi_quote.py <fromChain> <toChain> <fromToken> <toToken> <fromAmount(最小单位)>
示例: python3 lifi_quote.py 1 42161 0xa0b8...eb48 0xaf88...5831 1000000000
铁律: 地址一律小写；代币地址先链上验证 symbol() 再用（Day 4 教训）。
"""
import json, sys, urllib.request

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.4"})
    return json.load(urllib.request.urlopen(req, timeout=25))

ADDR = "0x1111111111111111111111111111111111111111"  # 占位地址（仅报价用）

def quote(fc, tc, ft, tt, amt):
    u = (f"https://li.quest/v1/quote?fromAddress={ADDR}&fromChain={fc}&toChain={tc}"
         f"&fromToken={ft.lower()}&toToken={tt.lower()}&fromAmount={amt}")
    return get(u)

def show(d):
    if "estimate" not in d:
        print("错误:", d.get("message")); return
    a, e = d["action"], d["estimate"]
    dec = 6  # 简化：示例均为 6 位或按需改
    f = int(a["fromAmount"]); t = int(e["toAmount"])
    # 自动判断小数位太麻烦时，直接打印原始值与耗时
    steps = [s.get("tool") for s in d.get("includedSteps", [])]
    print(f"tool={d.get('tool')} steps={steps}")
    print(f"fromAmount(raw)={f} toAmount(raw)={t} 损耗={(f-t)/f*100:.3f}%")
    print(f"预计耗时={e.get('executionDuration')}s")

if __name__ == "__main__":
    fc, tc, ft, tt, amt = sys.argv[1:6]
    show(quote(fc, tc, ft, tt, amt))
