#!/usr/bin/env python3
"""Run a momentum rotation backtest on NSE stocks.

Examples:
    python run.py                                  # Nifty 200, top 10, from 2010
    python run.py --index nifty500 --top-n 15
    python run.py --capital 30000 --start 2015-01-01
    python run.py --no-market-filter               # see what the crash filter is worth
"""

from __future__ import annotations

import argparse
from pathlib import Path

from momentum.backtest import CostConfig, run_backtest
from momentum.data import data_quality_report, load_prices
from momentum.report import metrics, write_report
from momentum.strategy import StrategyConfig
from momentum.universe import BENCHMARK_LABEL, fetch_universe

HERE = Path(__file__).resolve().parent


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--index", default="nifty200", help="nifty50 | nifty100 | nifty200 | nifty500")
    p.add_argument("--start", default="2010-01-01", help="backtest start date (YYYY-MM-DD)")
    p.add_argument("--capital", type=float, default=100_000, help="starting capital in ₹")
    p.add_argument("--top-n", type=int, default=10, help="number of stocks to hold")
    p.add_argument("--lookback", type=int, default=12, help="momentum lookback in months")
    p.add_argument("--skip", type=int, default=1, help="most recent months to skip")
    p.add_argument("--no-absolute-filter", action="store_true", help="buy top N even if their momentum is negative")
    p.add_argument("--no-market-filter", action="store_true", help="stay invested even when Nifty is below its 200-day average")
    p.add_argument("--cost-bps", type=float, default=20, help="friction per side in basis points")
    p.add_argument("--cash-yield", type=float, default=6.0, help="annual %% earned on idle cash")
    p.add_argument("--show-data-issues", action="store_true", help="list suspicious price jumps that survived cleaning")
    p.add_argument("--refresh", action="store_true", help="re-download prices instead of using the cache")
    p.add_argument("--out", default="output", help="output directory (relative to this folder)")
    a = p.parse_args()

    data_dir = HERE / "data"
    out_dir = HERE / a.out

    symbols = fetch_universe(a.index, cache_dir=data_dir)
    print(f"Universe: {a.index} ({len(symbols)} symbols)")

    # Data must start a year before the backtest so the first month has a 12-month lookback.
    data_start = f"{int(a.start[:4]) - 2}-01-01"
    prices = load_prices(symbols, data_start, data_dir, refresh=a.refresh)
    print(f"Prices: {prices.shape[1]} tickers, {prices.index[0].date()} → {prices.index[-1].date()}")
    odd = data_quality_report(prices.loc[a.start:])
    if len(odd):
        print(f"Note: {len(odd)} single-day moves >50% remain in the data (demergers, relistings, "
              f"unadjusted splits). Run with --show-data-issues to list them.")
        if a.show_data_issues:
            print(odd.to_string())

    strategy = StrategyConfig(
        top_n=a.top_n,
        lookback_months=a.lookback,
        skip_months=a.skip,
        absolute_filter=not a.no_absolute_filter,
        market_filter=not a.no_market_filter,
    )
    costs = CostConfig(cost_per_side=a.cost_bps / 10_000, cash_yield_annual=a.cash_yield / 100)

    result = run_backtest(prices, strategy, costs, start_capital=a.capital, start=a.start)

    title = f"Momentum top-{a.top_n} on {a.index.upper()} (12-1, monthly)"
    report = write_report(result, out_dir, title)
    m = metrics(result)

    print()
    print(f"₹{m['start_value']:,.0f} → ₹{m['end_value']:,.0f}   ({BENCHMARK_LABEL}: ₹{m['benchmark_end_value']:,.0f})")
    print(f"CAGR          {m['cagr']*100:6.1f}%   (benchmark: {m['benchmark_cagr']*100:.1f}%)")
    print(f"Max drawdown  {m['max_drawdown']*100:6.1f}%   (benchmark: {m['benchmark_max_drawdown']*100:.1f}%)")
    print(f"Worst year    {m['worst_year']*100:6.1f}%   (benchmark: {m['benchmark_worst_year']*100:.1f}%)")
    print(f"Costs paid    ₹{m['total_costs']:,.0f} over {m['trades']} trades")
    print(f"\nFull report: {report}")


if __name__ == "__main__":
    main()
