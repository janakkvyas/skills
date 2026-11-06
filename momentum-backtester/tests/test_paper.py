"""Offline tests for the paper-trading account."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from momentum.paper import (  # noqa: E402
    PaperAccount,
    RiskConfig,
    apply_orders,
    is_rebalance_due,
    loss_limit_tripped,
    plan_rebalance,
    record_orders,
)
from momentum.strategy import StrategyConfig  # noqa: E402
from momentum.universe import BENCHMARK_TICKER  # noqa: E402
from test_backtest import make_prices  # noqa: E402


@pytest.fixture
def prices():
    return make_prices(years=2)


@pytest.fixture
def acct(tmp_path):
    cfg = StrategyConfig(top_n=2, market_filter=False, min_history_days=200)
    return PaperAccount.create(tmp_path, 30_000, cfg, RiskConfig())


def test_create_and_reload(tmp_path, acct):
    loaded = PaperAccount.load(tmp_path)
    assert loaded.cash == 30_000
    assert loaded.strategy_cfg.top_n == 2
    with pytest.raises(FileExistsError):
        PaperAccount.create(tmp_path, 1, StrategyConfig(), RiskConfig())


def test_plan_buys_whole_shares_within_cash(acct, prices):
    target, last, orders, notes = plan_rebalance(acct, prices)
    assert "UP_FAST" in target
    assert all(o.side == "BUY" for o in orders)
    assert all(isinstance(o.shares, int) and o.shares > 0 for o in orders)
    spent = sum(o.value + o.fee for o in orders)
    assert spent <= 30_000
    apply_orders(acct, orders)
    assert acct.cash == pytest.approx(30_000 - spent)
    assert acct.holdings["UP_FAST"]["shares"] == orders[0].shares or "UP_FAST" in acct.holdings


def test_second_rebalance_sells_dropped_and_tops_up(acct, prices):
    _, _, orders, _ = plan_rebalance(acct, prices.iloc[:-120])
    apply_orders(acct, orders)
    # Pretend FLAT rocketed so it enters the top 2 and something gets dropped.
    p2 = prices.copy()
    p2["FLAT"] = p2["FLAT"] * np.linspace(1, 3, len(p2))
    target, _, orders2, _ = plan_rebalance(acct, p2)
    sides = {(o.side, o.symbol) for o in orders2}
    assert ("BUY", "FLAT") in sides
    assert any(s == "SELL" for s, _ in sides)
    apply_orders(acct, orders2)
    assert set(acct.holdings) <= set(target)
    assert acct.cash >= 0


def test_expensive_stock_is_skipped_with_note(tmp_path, prices):
    acct = PaperAccount.create(tmp_path, 1_000, StrategyConfig(top_n=2, market_filter=False, min_history_days=200), RiskConfig())
    p = prices.copy()
    p["UP_FAST"] *= 100  # ~₹20,000 a share vs a ₹500 slot
    _, _, orders, notes = plan_rebalance(acct, p)
    assert all(o.symbol != "UP_FAST" for o in orders)
    assert any("UP_FAST" in n and "skipped" in n for n in notes)


def test_market_filter_means_all_cash(tmp_path, prices):
    t = np.arange(len(prices))
    p = prices.copy()
    p[BENCHMARK_TICKER] = 100 * np.exp(-0.001 * t)
    acct = PaperAccount.create(tmp_path, 30_000, StrategyConfig(top_n=2, min_history_days=200), RiskConfig())
    target, _, orders, notes = plan_rebalance(acct, p)
    assert target == {} and orders == []
    assert any("Market filter" in n for n in notes)


def test_rebalance_due_once_per_month(acct):
    assert is_rebalance_due(acct, pd.Timestamp("2024-03-28"))
    acct.last_rebalance = "2024-03-28"
    assert not is_rebalance_due(acct, pd.Timestamp("2024-03-29"))
    assert is_rebalance_due(acct, pd.Timestamp("2024-04-01"))


def test_loss_limit(acct, prices):
    _, last, orders, _ = plan_rebalance(acct, prices)
    apply_orders(acct, orders)
    acct.value_at_rebalance = acct.value(last)
    assert not loss_limit_tripped(acct, last)
    crashed = last * 0.85
    assert loss_limit_tripped(acct, crashed)


def test_cash_yield_accrues(acct):
    from datetime import date
    acct.last_cash_accrual = "2024-01-01"
    acct.accrue_cash_yield(date(2025, 1, 1))
    assert acct.cash == pytest.approx(30_000 * 1.06, rel=1e-3)


def test_orders_csv(tmp_path, acct, prices):
    _, _, orders, _ = plan_rebalance(acct, prices)
    record_orders(tmp_path, orders)
    record_orders(tmp_path, orders)
    df = pd.read_csv(tmp_path / "orders.csv")
    assert len(df) == 2 * len(orders)
    assert list(df.columns) == ["date", "side", "symbol", "shares", "price", "value", "fee", "reason"]


def test_unfilled_slots_spill_into_affordable_picks(tmp_path, prices):
    cfg = StrategyConfig(top_n=2, market_filter=False, min_history_days=200)
    p = prices.copy()
    p["UP_FAST"] *= 100  # unaffordable
    spill = PaperAccount.create(tmp_path / "a", 1_000, cfg, RiskConfig(spill_unfilled=True))
    nospill = PaperAccount.create(tmp_path / "b", 1_000, cfg, RiskConfig(spill_unfilled=False))
    _, _, o1, n1 = plan_rebalance(spill, p)
    _, _, o2, _ = plan_rebalance(nospill, p)
    assert sum(o.value for o in o1) > sum(o.value for o in o2)
    assert sum(o.value for o in o1) <= 1_000  # capped at 2x slot = whole account here
    assert any("spread over" in n for n in n1)
