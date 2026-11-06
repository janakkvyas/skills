"""Offline tests on synthetic prices. No network needed."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from momentum.backtest import CostConfig, run_backtest  # noqa: E402
from momentum.data import clean_prices, month_ends  # noqa: E402
from momentum.report import cagr, max_drawdown, metrics  # noqa: E402
from momentum.strategy import StrategyConfig, momentum_scores, select_portfolio  # noqa: E402
from momentum.universe import BENCHMARK_TICKER, parse_constituents  # noqa: E402


def make_prices(years: int = 3, seed: int = 0) -> pd.DataFrame:
    """Four stocks with known trends plus a flat benchmark."""
    idx = pd.bdate_range("2020-01-01", periods=252 * years)
    t = np.arange(len(idx))
    rng = np.random.default_rng(seed)
    noise = lambda: rng.normal(0, 0.002, len(idx)).cumsum()  # noqa: E731
    df = pd.DataFrame(
        {
            "UP_FAST": 100 * np.exp(0.0012 * t + noise()),   # ~35%/yr
            "UP_SLOW": 100 * np.exp(0.0004 * t + noise()),   # ~10%/yr
            "FLAT": 100 * np.exp(noise()),
            "DOWN": 100 * np.exp(-0.0008 * t + noise()),
            BENCHMARK_TICKER: 100 * np.exp(0.0005 * t),
        },
        index=idx,
    )
    return df


def test_parse_constituents():
    csv = "Company Name,Industry,Symbol,Series,ISIN Code\nA Ltd,X,AAA,EQ,1\nB Ltd,Y,BBB,EQ,2\nC,Z,CCC,BE,3\n"
    assert parse_constituents(csv) == ["AAA", "BBB"]


def test_month_ends_are_last_trading_day():
    idx = pd.bdate_range("2021-01-01", "2021-03-31")
    me = month_ends(pd.DataFrame({"x": 1.0}, index=idx))
    assert list(me) == [pd.Timestamp("2021-01-29"), pd.Timestamp("2021-02-26"), pd.Timestamp("2021-03-31")]


def test_momentum_ranks_trending_stock_first():
    prices = make_prices()
    stocks = prices.drop(columns=[BENCHMARK_TICKER])
    asof = stocks.index[-1]
    scores = momentum_scores(stocks, asof, StrategyConfig())
    assert scores.idxmax() == "UP_FAST"
    assert scores["DOWN"] < 0


def test_absolute_filter_excludes_losers():
    prices = make_prices()
    stocks = prices.drop(columns=[BENCHMARK_TICKER])
    bench = prices[BENCHMARK_TICKER]
    cfg = StrategyConfig(top_n=4, absolute_filter=True, market_filter=False)
    w = select_portfolio(stocks, bench, stocks.index[-1], cfg)
    assert "DOWN" not in w
    assert "UP_FAST" in w
    assert sum(w.values()) < 1.0  # unfilled slot stays in cash


def test_market_filter_goes_to_cash_in_bear_market():
    prices = make_prices()
    t = np.arange(len(prices))
    prices[BENCHMARK_TICKER] = 100 * np.exp(-0.001 * t)  # steadily falling index
    stocks = prices.drop(columns=[BENCHMARK_TICKER])
    cfg = StrategyConfig(top_n=2, market_filter=True)
    assert select_portfolio(stocks, prices[BENCHMARK_TICKER], stocks.index[-1], cfg) == {}


def test_backtest_tracks_best_stock_without_costs():
    prices = make_prices()
    cfg = StrategyConfig(top_n=1, market_filter=False, absolute_filter=False, min_history_days=200)
    res = run_backtest(prices, cfg, CostConfig(cost_per_side=0.0, cash_yield_annual=0.0), start_capital=1000, start="2021-01-01")
    assert res.equity.iloc[0] == pytest.approx(1000, rel=1e-9)
    assert res.equity.iloc[-1] > res.benchmark.iloc[-1]
    # Nearly every month should have picked UP_FAST.
    assert (res.holdings["UP_FAST"] > 0).mean() > 0.9
    assert res.total_costs == 0


def test_costs_reduce_final_value():
    prices = make_prices()
    cfg = StrategyConfig(top_n=2, market_filter=False)
    free = run_backtest(prices, cfg, CostConfig(cost_per_side=0.0), start="2021-01-01")
    paid = run_backtest(prices, cfg, CostConfig(cost_per_side=0.01), start="2021-01-01")
    assert paid.total_costs > 0
    assert paid.equity.iloc[-1] < free.equity.iloc[-1]


def test_cash_earns_yield_when_market_filter_is_on():
    prices = make_prices()
    t = np.arange(len(prices))
    prices[BENCHMARK_TICKER] = 100 * np.exp(-0.001 * t)
    cfg = StrategyConfig(top_n=2, market_filter=True)
    res = run_backtest(prices, cfg, CostConfig(cash_yield_annual=0.06), start_capital=100_000, start="2021-01-01")
    assert res.months_in_cash == len(res.holdings)
    years = (res.equity.index[-1] - res.equity.index[0]).days / 365.25
    assert res.equity.iloc[-1] == pytest.approx(100_000 * 1.06**years, rel=0.01)


def test_metrics_shapes():
    prices = make_prices()
    res = run_backtest(prices, StrategyConfig(top_n=2, market_filter=False), start="2021-01-01")
    m = metrics(res)
    assert -1 <= m["max_drawdown"] <= 0
    assert m["years"] > 1.5
    dd, start, trough = max_drawdown(res.equity)
    assert start <= trough
    assert cagr(pd.Series([100.0, 121.0], index=pd.to_datetime(["2020-01-01", "2022-01-01"]))) == pytest.approx(0.1, rel=1e-3)


def test_clean_prices_fixes_bad_tick_and_phantom_row():
    idx = pd.bdate_range("2022-01-03", periods=10)
    stock = pd.Series(100.0, index=idx)
    bench = pd.Series(50.0, index=idx)
    bench.iloc[4] = 5.0            # bad tick, snaps back next day
    stock.iloc[7] = np.nan          # phantom day: stock missing, bench present
    df = pd.DataFrame({"AAA": stock, BENCHMARK_TICKER: bench})
    out = clean_prices(df)
    assert idx[7] not in out.index
    assert out[BENCHMARK_TICKER].iloc[4] == 50.0
    assert out["AAA"].isna().sum() == 0


def test_clean_prices_keeps_permanent_shift():
    idx = pd.bdate_range("2022-01-03", periods=10)
    stock = pd.Series([100.0] * 5 + [40.0] * 5, index=idx)  # relisting / demerger
    df = pd.DataFrame({"AAA": stock, "BBB": 1.0, BENCHMARK_TICKER: 1.0})
    out = clean_prices(df)
    assert out["AAA"].iloc[-1] == 40.0
