// DipLadder — a BTC swing bot for the make.fun 24h race.
//
// Idea: the market spends most of its time chopping sideways, so chasing
// every 1-minute wiggle just pays the round-trip cost (about 26 bps) over
// and over. Instead this bot waits for a real dip, then trades the swings
// in fixed 25% rungs of its equity.
//
//  1. Entry: only after the price has fallen 1.2% below its own 4-hour
//     high (a 240-bar lookback). Until then it holds cash.
//  2. Ladder: once in, it sells 25% of equity each time the price rises
//     0.5% above the last rung, and buys 25% back each time it falls 0.5%
//     below the last rung. Weight is kept between 50% and 100%.
//  3. Nothing else: no leverage, no shorts, no clock, no randomness.
//     Every decision comes from the bars the harness sends.
//
// The result is a bot that is long most of the time (it rides the drift)
// but whose trades land at different bars and in different sizes than a
// plain buy-and-hold or an EMA-cross bot, so its action log is its own.

import { runBars } from './vendor/makefun-bars.ts';

const SYM = 'CBBTC';

// How far back the dip reference looks (240 one-minute bars = 4 hours).
const LOOKBACK = 240;
// Entry trigger: price at least this far below the lookback high, in bps.
const ENTRY_DROP_BPS = 120;
// Ladder step: trade 25% of equity per this move from the last rung, bps.
const STEP_BPS = 50;
// One rung of the ladder, in bps of equity.
const RUNG_BPS = 2500;
// Floor and ceiling of the ladder, in bps of equity.
const MIN_WEIGHT_BPS = 5000;
const MAX_WEIGHT_BPS = 10000;
// Ignore weight changes smaller than this many USDC (dust).
const MIN_TRADE_USDC = 25;
// The most a fill may move from the latest close, in bps.
const MAX_SLIP_BPS = 100;

// USDC micro units per USDC (quote_scale 6).
const MICRO = 1_000_000n;

const closes: bigint[] = [];
let lastBarT = -1;
let entered = false;
let lastRung = 0n;
let targetBps = 0;

await runBars({
  onBatch(state) {
    if (state.warmingUp) return [];
    const bar = state.latest.get(SYM);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    // Record each new bar once, keyed by its close time. A batch with no
    // bar for this symbol reuses the previous one, so it adds nothing.
    if (bar.t !== lastBarT) {
      lastBarT = bar.t;
      closes.push(close);
    }
    if (closes.length < LOOKBACK) return [];

    // Highest close of the lookback window.
    let high = 0n;
    for (let i = closes.length - LOOKBACK; i < closes.length; i++) {
      if (closes[i] > high) high = closes[i];
    }

    if (!entered) {
      // Wait for a real dip: 1.2% below the 4-hour high.
      if (close * 10000n <= high * BigInt(10000 - ENTRY_DROP_BPS)) {
        entered = true;
        targetBps = MAX_WEIGHT_BPS;
        lastRung = close;
      } else {
        return [];
      }
    } else {
      // Ladder: one rung per 0.5% move from the last rung.
      if (targetBps > MIN_WEIGHT_BPS && close * 10000n >= lastRung * BigInt(10000 + STEP_BPS)) {
        targetBps -= RUNG_BPS;
        lastRung = close;
      } else if (targetBps < MAX_WEIGHT_BPS && close * 10000n <= lastRung * BigInt(10000 - STEP_BPS)) {
        targetBps += RUNG_BPS;
        lastRung = close;
      } else {
        return [];
      }
    }

    // Turn the target weight into at most one order.
    const pos = state.positions.get(SYM);
    const heldQty = pos === undefined ? 0n : pos.qty;
    const heldValue = state.value(SYM, heldQty, close);
    const equity = state.equity;
    if (equity <= 0n) return [];
    const curBps = (heldValue * 10000n) / equity;
    const wantValue = (BigInt(targetBps) * equity) / 10000n;

    if (wantValue > heldValue) {
      // Buy up to the target weight, limited by cash.
      let spend = wantValue - heldValue;
      if (spend > state.cash) spend = state.cash;
      if (spend < BigInt(MIN_TRADE_USDC) * MICRO) return [];
      return [{ side: 'buy', symbol: SYM, notional_quote_units: spend, max_slippage_bps: MAX_SLIP_BPS }];
    }
    if (wantValue < heldValue) {
      // Sell down to the target weight.
      const sellValue = heldValue - wantValue;
      if (sellValue < BigInt(MIN_TRADE_USDC) * MICRO) return [];
      // qty = sellValue * 10^(qty_scale + price_scale) / (close * 10^quote_scale)
      const sym = state.symbols.get(SYM);
      if (sym === undefined) return [];
      const qty = (sellValue * 10n ** BigInt(sym.qty_scale + sym.price_scale)) / (close * 10n ** BigInt(state.hello.capital.quote_scale));
      const sellQty = qty > heldQty ? heldQty : qty;
      if (sellQty <= 0n) return [];
      return [{ side: 'sell', symbol: SYM, qty: sellQty, max_slippage_bps: MAX_SLIP_BPS }];
    }
    return [];
  },
});
