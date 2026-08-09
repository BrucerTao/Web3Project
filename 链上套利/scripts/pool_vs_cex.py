#!/usr/bin/env python3
"""
pool_vs_cex.py — 实操工具：同时读 DEX 池子隐含价 + CEX 订单簿中间价，算偏差。
用途：Day 2 实操练习 / Day 9-11 监控脚本的第一块积木。

用法:
  python3 pool_vs_cex.py
  （可改 POOL / RPC / SYMBOL 变量）

铁律（今天翻车学到的）:
  1. 链上数据必须程序化切分 hex，别肉眼切。
  2. 必须先查 token0()/token1() 确认顺序，再查 decimals 确认小数位。
  3. 偏差要扣掉手续费/滑点/桥费，才是"能不能搬"。
"""
import json, urllib.request

RPC = "https://ethereum-rpc.publicnode.com"
POOL = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"   # Uniswap v2 USDC/WETH
CEX_SYMBOL = "ETHUSDC"
POOL_FEE = 0.003   # Uniswap v2 = 0.3%

def rpc(to, data):
    body = json.dumps({"jsonrpc":"2.0","method":"eth_call",
        "params":[{"to":to,"data":data},"latest"],"id":1}).encode()
    req = urllib.request.Request(RPC, data=body,
        headers={"Content-Type":"application/json","User-Agent":"curl/8.4"})
    return json.load(urllib.request.urlopen(req, timeout=20))["result"]

def erc20_decimals(token):
    return int(rpc(token, "0x313ce567"), 16)   # decimals()

def get_v2_reserves(pool):
    r = rpc(pool, "0x0902f1ac")[2:]             # getReserves()
    r0, r1 = int(r[0:64],16), int(r[64:128],16) # 程序化切分，别手切！
    t0 = "0x" + rpc(pool, "0x0dfe1681")[-40:]   # token0()
    t1 = "0x" + rpc(pool, "0xd21220a7")[-40:]   # token1()
    d0, d1 = erc20_decimals(t0), erc20_decimals(t1)
    return t0, t1, r0/10**d0, r1/10**d1

def cex_mid(symbol):
    url = f"https://api.binance.com/api/v3/depth?symbol={symbol}&limit=5"
    d = json.load(urllib.request.urlopen(urllib.request.Request(url,
        headers={"User-Agent":"curl/8.4"}), timeout=15))
    best_bid = float(d["bids"][0][0]); best_ask = float(d["asks"][0][0])
    return (best_bid+best_ask)/2, best_bid, best_ask

if __name__ == "__main__":
    t0,t1,a0,a1 = get_v2_reserves(POOL)
    pool_price = a0/a1   # token0 计价 token1 的价格
    mid, bid, ask = cex_mid(CEX_SYMBOL)
    dev = (pool_price-mid)/mid
    print(f"DEX 池子: {a0:,.2f} {t0[-6:]} / {a1:,.4f} {t1[-6:]}")
    print(f"DEX 隐含价 = {pool_price:,.2f}   总流动性 ~${2*a0:,.0f}")
    print(f"CEX 订单簿: 买一 {bid} / 卖一 {ask}  中间价 {mid:,.2f}")
    print(f"偏差 = {dev*100:+.3f}%   池子手续费 = {POOL_FEE*100:.2f}%")
    print(f"结论: {'仍在无套利带内（搬了亏）' if abs(dev) < POOL_FEE else '突破手续费带，继续算滑点/桥费/Gas！'}")
