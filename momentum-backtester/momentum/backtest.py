"""Backtest engine: monthly rebalance with transaction costs and a cash yield."""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .data import month_ends
from .strategy import StrategyConfig, select_portfolio
from .universe import BENCHMARK_TICKER


@dataclass(frozen=True)
class CostConfig:
    # Round-trip friction per side, as a fraction of trade value.
    # Zero-brokerage delivery on an Indian discount broker still pays
    # STT 0.1% + stamp 0.015% + exchange/SEBI/GST ~0.01%, so ~0.13% per side
    # plus a bit of slippage. 0.20% (20 bps) per side is a sane default.
    cost_per_side: float = 0.0020
    # Annual yield on the uninvested cash (liquid fund / sweep). 6% nominal.
    cash_yield_annual: float = 0.06


@dataclass
class BacktestResult:
    equity: pd.Series                      # strategy value, daily
    benchmark: pd.Series                   # buy-and-hold benchmark, same scale
    holdings: pd.DataFrame                 # month-end target weights per symbol
    trades: int = 0
    total_costs: float = 0.0
    months_in_cash: int = 0
    log: list[str] = field(default_factory=list)


def run_backtest(
    prices: pd.DataFrame,
    strategy: StrategyConfig,
    costs: CostConfig = CostConfig(),
    start_capital: float = 100_000.0,
    start: str | None = None,
) -> BacktestResult:
    prices = prices.sort_index()
    bench = prices[BENCHMARK_TICKER].dropna()
    # Forward-fill so a stock missing a print on one day keeps its last value
    # instead of silently vanishing from the portfolio.
    stocks = prices.drop(columns=[BENCHMARK_TICKER]).ffill()

    rebal_days = month_ends(stocks)
    if start:
        rebal_days = rebal_days[rebal_days >= pd.Timestamp(start)]
    if len(rebal_days) < 2:
        raise ValueError("Not enough history to run a backtest")

    daily_cash_rate = (1 + costs.cash_yield_annual) ** (1 / 252) - 1

    value = start_capital
    weights: dict[str, float] = {}       # current target weights
    shares: dict[str, float] = {}        # fractional shares held
    cash = start_capital
    equity_points: dict[pd.Timestamp, float] = {}
    holdings_rows: dict[pd.Timestamp, dict[str, float]] = {}
    result = BacktestResult(equity=pd.Series(dtype=float), benchmark=pd.Series(dtype=float), holdings=pd.DataFrame())

    for i, day in enumerate(rebal_days[:-1]):
        # --- Rebalance at the close of `day` ---
        target = select_portfolio(stocks, bench, day, strategy)
        px = stocks.loc[day]

        # Mark current holdings to market.
        value = cash + sum(shares.get(s, 0) * px[s] for s in shares if pd.notna(px.get(s)))

        new_shares: dict[str, float] = {}
        turnover = 0.0
        for sym, w in target.items():
            price = px.get(sym)
            if pd.isna(price) or price <= 0:
                continue
            target_value = value * w
            new_shares[sym] = target_value / price
            current_value = shares.get(sym, 0) * price
            turnover += abs(target_value - current_value)
        for sym, n in shares.items():
            if sym not in new_shares and pd.notna(px.get(sym)):
                turnover += n * px[sym]

        fee = turnover * costs.cost_per_side
        result.total_costs += fee
        result.trades += sum(1 for s in set(new_shares) | set(shares)
                             if new_shares.get(s, 0) != shares.get(s, 0))
        if not target:
            result.months_in_cash += 1

        invested = sum(new_shares[s] * px[s] for s in new_shares)
        cash = value - invested - fee
        shares = new_shares
        weights = target
        holdings_rows[day] = dict(weights)
        equity_points[day] = cash + invested

        # --- Walk forward day by day until the next rebalance ---
        nxt = rebal_days[i + 1]
        window = stocks.loc[day:nxt].iloc[1:]
        for d, row in window.iterrows():
            cash *= 1 + daily_cash_rate
            held = sum(shares[s] * row[s] for s in shares if pd.notna(row[s]))
            # A stock with a missing price keeps its last value (rare; delisting).
            missing = [s for s in shares if pd.isna(row[s])]
            for s in missing:
                last = stocks[s].loc[:d].dropna()
                held += shares[s] * (last.iloc[-1] if len(last) else 0.0)
            equity_points[d] = cash + held

    equity = pd.Series(equity_points).sort_index()
    equity.name = "strategy"
    bench_aligned = bench.reindex(equity.index).ffill()
    benchmark = (bench_aligned / bench_aligned.iloc[0]) * start_capital
    benchmark.name = "benchmark"

    result.equity = equity
    result.benchmark = benchmark
    result.holdings = pd.DataFrame(
        list(holdings_rows.values()), index=pd.DatetimeIndex(holdings_rows.keys())
    ).fillna(0.0)
    return result
