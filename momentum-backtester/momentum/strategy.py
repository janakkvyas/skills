"""Momentum rotation strategy.

Classic "12-1" cross-sectional momentum:
    score = price 1 month ago / price 12 months ago - 1
The most recent month is skipped because short-term returns tend to reverse.

Rules (all configurable):
    * Rank the universe by score at each month end.
    * Hold the top N, equal weight.
    * Absolute momentum filter: a stock with score <= 0 is never bought.
      If fewer than N qualify, the rest of the portfolio sits in cash.
    * Market filter: if the benchmark (Nifty 50) is below its 200-day
      average at rebalance, hold 100% cash. This is what keeps drawdowns
      survivable in 2008 / 2020 style crashes.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class StrategyConfig:
    top_n: int = 10
    lookback_months: int = 12
    skip_months: int = 1
    absolute_filter: bool = True
    market_filter: bool = True
    market_ma_days: int = 200
    min_history_days: int = 250  # a stock must have this much data to be scored


def momentum_scores(
    prices: pd.DataFrame, asof: pd.Timestamp, cfg: StrategyConfig
) -> pd.Series:
    """Momentum score for every stock as of ``asof`` (a trading day)."""
    hist = prices.loc[:asof]
    if len(hist) < cfg.min_history_days:
        return pd.Series(dtype=float)

    end = asof - pd.DateOffset(months=cfg.skip_months)
    start = asof - pd.DateOffset(months=cfg.lookback_months)
    p_end = hist.loc[:end].iloc[-1]
    p_start = hist.loc[:start].iloc[-1] if len(hist.loc[:start]) else None
    if p_start is None:
        return pd.Series(dtype=float)

    enough_history = hist.notna().sum() >= cfg.min_history_days
    score = (p_end / p_start - 1.0).where(enough_history)
    return score.dropna()


def market_is_bullish(
    benchmark: pd.Series, asof: pd.Timestamp, ma_days: int
) -> bool:
    hist = benchmark.loc[:asof].dropna()
    if len(hist) < ma_days:
        return True  # not enough data to say otherwise
    return bool(hist.iloc[-1] > hist.iloc[-ma_days:].mean())


def select_portfolio(
    prices: pd.DataFrame,
    benchmark: pd.Series,
    asof: pd.Timestamp,
    cfg: StrategyConfig,
) -> dict[str, float]:
    """Target weights {symbol: weight} for the month starting after ``asof``.

    Weights sum to <= 1; the remainder is cash.
    """
    if cfg.market_filter and not market_is_bullish(benchmark, asof, cfg.market_ma_days):
        return {}

    scores = momentum_scores(prices, asof, cfg)
    if cfg.absolute_filter:
        scores = scores[scores > 0]
    if scores.empty:
        return {}

    picks = scores.sort_values(ascending=False).head(cfg.top_n)
    weight = 1.0 / cfg.top_n  # unfilled slots stay in cash
    return {sym: weight for sym in picks.index}
