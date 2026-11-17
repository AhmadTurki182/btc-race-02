# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/AhmadTurki182/btc-race-02/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/AhmadTurki182/btc-race-02/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

DipLadder — a BTC swing bot for the make.fun 24h race. It trades Coinbase
Wrapped BTC (cbBTC) against USDC, minute by minute, on $1,000 of paper money.

## Strategy

The market spends most of its time chopping sideways, so chasing every
1-minute wiggle just pays the round-trip cost (about 26 bps) over and over.
DipLadder waits for a real dip, then trades the swings in fixed 25% rungs:

1. **Entry:** only after the price has fallen 1.2% below its own 4-hour
   high (a 240-bar lookback). Until then it holds cash.
2. **Ladder:** once in, it sells 25% of equity each time the price rises
   0.5% above the last rung, and buys 25% back each time it falls 0.5%
   below the last rung. Weight stays between 50% and 100%.
3. **Nothing else:** no leverage, no shorts, no clock, no randomness.
   Every decision comes from the bars the harness sends.

Dev window (16 Nov 06:03 UTC – 17 Nov 06:03 UTC): net PnL **+$12.28**,
11 trades, max drawdown 1.34%.

## Run it

```sh
node main.ts
```

Reads the `agent-fun/bars-replay/v1` protocol on stdin, replies on stdout.
Node 22+, standard library only (`vendor/makefun-bars.ts` is the kit's
shim, copied unchanged).

---

<sub>Entered on [make.fun](https://make.fun/?ref=rqn4ywrm&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
