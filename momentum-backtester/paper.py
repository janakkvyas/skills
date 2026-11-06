#!/usr/bin/env python3
"""Paper-trade the momentum strategy on live prices. Simulated orders only.

Commands:
    python paper.py init --capital 30000      create the paper account
    python paper.py picks                     what the strategy would buy today
    python paper.py rebalance                 place this month's simulated orders (if due)
    python paper.py rebalance --dry-run       show the orders without placing them
    python paper.py rebalance --force         rebalance even if not due this month
    python paper.py status                    value, holdings, P&L vs Nifty, loss-limit check

Run `status` whenever you like and `rebalance` once a month after the close.
A cron line for the last weekday of each month is in the README.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from momentum.data import load_prices
from momentum.paper import (
    PaperAccount,
    RiskConfig,
    apply_orders,
    is_rebalance_due,
    loss_limit_tripped,
    plan_rebalance,
    record_equity,
    record_orders,
    scores_table,
)
from momentum.strategy import StrategyConfig
from momentum.universe import BENCHMARK_LABEL, BENCHMARK_TICKER, fetch_universe

HERE = Path(__file__).resolve().parent


def live_prices(index: str, data_dir: Path) -> pd.DataFrame:
    """Last ~15 months of daily closes, enough for a 12-1 score and a 200-day average."""
    symbols = fetch_universe(index, cache_dir=data_dir)
    start = (date.today() - pd.DateOffset(months=15)).strftime("%Y-%m-%d")
    # Always refresh: this is live paper trading, stale prices defeat the purpose.
    return load_prices(symbols, start, data_dir / "live", refresh=True)


def fmt(x: float) -> str:
    return f"₹{x:,.0f}"


def cmd_init(a, folder: Path) -> None:
    strategy = StrategyConfig(top_n=a.top_n)
    risk = RiskConfig(max_monthly_loss=a.max_monthly_loss / 100)
    acct = PaperAccount.create(folder, a.capital, strategy, risk)
    print(f"Paper account created at {folder / 'account.json'}")
    print(f"  capital {fmt(acct.cash)}, top-{strategy.top_n}, monthly loss limit {a.max_monthly_loss:.0f}%")
    print("Next: `python paper.py rebalance --dry-run` to see the first month's orders.")


def cmd_picks(a, folder: Path) -> None:
    acct = PaperAccount.load(folder) if (folder / "account.json").exists() else None
    cfg = acct.strategy_cfg if acct else StrategyConfig(top_n=a.top_n)
    prices = live_prices(a.index, HERE / "data")
    asof = prices.index[-1]
    print(f"Prices as of {asof.date()}  ({len(prices.columns) - 1} stocks)")
    bench = prices[BENCHMARK_TICKER].dropna()
    ma = bench.iloc[-cfg.market_ma_days:].mean()
    state = "ABOVE" if bench.iloc[-1] > ma else "BELOW"
    print(f"{BENCHMARK_LABEL}: {bench.iloc[-1]:.2f} is {state} its {cfg.market_ma_days}-day average ({ma:.2f})")
    if state == "BELOW" and cfg.market_filter:
        print("→ market filter says: hold cash this month.")
    print()
    print(scores_table(prices, cfg, n=max(cfg.top_n + 5, 15)).to_string())


def cmd_rebalance(a, folder: Path) -> None:
    acct = PaperAccount.load(folder)
    prices = live_prices(a.index, HERE / "data")
    asof = prices.index[-1]
    today = date.today()

    if not a.force and not is_rebalance_due(acct, asof):
        print(f"Not due: last rebalance was {acct.last_rebalance}, prices are as of {asof.date()}. "
              "Use --force to override.")
        return

    acct.accrue_cash_yield(today)
    target, last, orders, notes = plan_rebalance(acct, prices, asof)
    value_before = acct.value(last)

    print(f"Rebalance as of {asof.date()}   account value {fmt(value_before)}   cash {fmt(acct.cash)}")
    for n in notes:
        print(f"  note: {n}")
    if not orders:
        print("  no orders needed")
    for o in orders:
        print(f"  {o.side:4} {o.shares:5d} {o.symbol:<12} @ {o.price:>9,.2f}  = {fmt(o.value):>12}  ({o.reason})")
    turnover = sum(o.value for o in orders)
    fees = sum(o.fee for o in orders)
    print(f"  turnover {fmt(turnover)}, simulated friction {fmt(fees)}")

    if a.dry_run:
        print("\nDry run: nothing recorded.")
        return

    apply_orders(acct, orders)
    acct.last_rebalance = asof.date().isoformat()
    acct.value_at_rebalance = acct.value(last)
    acct.halted_until = None
    acct.save(folder)
    if orders:
        record_orders(folder, orders)
    record_equity(folder, datetime.now(), acct.value_at_rebalance, acct.cash, float(last.get(BENCHMARK_TICKER, float("nan"))) if BENCHMARK_TICKER in last else None)
    print(f"\nRecorded. Holding {len(acct.holdings)} stocks, cash {fmt(acct.cash)}.")


def cmd_status(a, folder: Path) -> None:
    acct = PaperAccount.load(folder)
    prices = live_prices(a.index, HERE / "data")
    asof = prices.index[-1]
    last = prices.ffill().loc[asof]
    acct.accrue_cash_yield(date.today())
    value = acct.value(last)
    bench = prices[BENCHMARK_TICKER].dropna()

    print(f"Paper account   (prices as of {asof.date()}, created {acct.created})")
    print(f"  value   {fmt(value)}   cash {fmt(acct.cash)}   "
          f"P&L {fmt(value - acct.start_capital)} ({(value / acct.start_capital - 1) * 100:+.2f}%)")
    eq = folder / "equity.csv"
    if eq.exists():
        hist = pd.read_csv(eq)
        if len(hist) and pd.notna(hist["benchmark_price"].iloc[0]):
            b0 = float(hist["benchmark_price"].iloc[0])
            print(f"  {BENCHMARK_LABEL} since first rebalance: {(bench.iloc[-1] / b0 - 1) * 100:+.2f}%")
    if acct.value_at_rebalance:
        chg = value / acct.value_at_rebalance - 1
        print(f"  since last rebalance ({acct.last_rebalance}): {chg * 100:+.2f}%   "
              f"(loss limit {-acct.risk_cfg.max_monthly_loss * 100:.0f}%)")

    if acct.holdings:
        rows = []
        for sym, h in acct.holdings.items():
            px = float(last[sym]) if pd.notna(last.get(sym)) else h["avg_cost"]
            rows.append({"symbol": sym, "shares": h["shares"], "avg_cost": round(h["avg_cost"], 2),
                         "last": round(px, 2), "value": round(h["shares"] * px),
                         "pnl_%": round((px / h["avg_cost"] - 1) * 100, 2)})
        print()
        print(pd.DataFrame(rows).sort_values("value", ascending=False).to_string(index=False))
    else:
        print("  no holdings (in cash)")

    if loss_limit_tripped(acct, last):
        print("\n!! MONTHLY LOSS LIMIT TRIPPED. Selling everything to cash until next month.")
        if not a.dry_run:
            from momentum.paper import Order
            orders = [Order(asof.date().isoformat(), "SELL", s, h["shares"], float(last[s]),
                            h["shares"] * float(last[s]), h["shares"] * float(last[s]) * acct.risk_cfg.cost_per_side,
                            "loss limit") for s, h in acct.holdings.items()]
            apply_orders(acct, orders)
            record_orders(folder, orders)
            acct.halted_until = (asof + pd.offsets.MonthBegin(1)).date().isoformat()
            value = acct.cash
    acct.save(folder)
    record_equity(folder, datetime.now(), value, acct.cash, float(bench.iloc[-1]))
    print(f"\nNext rebalance due: first run after {(asof + pd.offsets.MonthEnd(0)).date()}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--index", default="nifty200")
    p.add_argument("--folder", default="paper", help="where the paper account lives (relative to this folder)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init"); s.add_argument("--capital", type=float, default=30_000)
    s.add_argument("--top-n", type=int, default=10)
    s.add_argument("--max-monthly-loss", type=float, default=10, help="%% fall from last rebalance that forces cash")
    s = sub.add_parser("picks"); s.add_argument("--top-n", type=int, default=10)
    s = sub.add_parser("rebalance"); s.add_argument("--dry-run", action="store_true"); s.add_argument("--force", action="store_true")
    s = sub.add_parser("status"); s.add_argument("--dry-run", action="store_true", help="report only; do not act on the loss limit")

    a = p.parse_args()
    folder = HERE / a.folder
    {"init": cmd_init, "picks": cmd_picks, "rebalance": cmd_rebalance, "status": cmd_status}[a.cmd](a, folder)


if __name__ == "__main__":
    main()
