"""Paper-trading account: the same strategy as the backtest, run forward in
time on live prices, with simulated orders only.

Nothing here can place a real order. The point is to find out, over one or
two months, whether the live picks, the whole-share rounding, the price
feed and your own discipline behave the way the backtest assumed.

State lives in a folder (default ``paper/``):
    account.json   cash, holdings, config, last rebalance date
    orders.csv     every simulated fill
    equity.csv     one row per `status`/`rebalance` run: value over time
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from .strategy import StrategyConfig, momentum_scores, market_is_bullish, select_portfolio
from .universe import BENCHMARK_TICKER


@dataclass
class RiskConfig:
    # If the account falls this much below its value at the last rebalance,
    # everything is sold and the account sits in cash until the next month.
    max_monthly_loss: float = 0.10
    # Friction charged per side on simulated fills (STT + fees + slippage).
    cost_per_side: float = 0.0020
    # Annual yield credited on idle cash.
    cash_yield_annual: float = 0.06
    # Small accounts cannot buy one share of every pick. If True, the cash of
    # slots that cannot be filled is spread over the picks that can, so the
    # account stays invested. Each pick is capped at twice its normal slot.
    spill_unfilled: bool = True


@dataclass
class PaperAccount:
    cash: float
    start_capital: float
    created: str
    strategy: dict = field(default_factory=lambda: asdict(StrategyConfig()))
    risk: dict = field(default_factory=lambda: asdict(RiskConfig()))
    holdings: dict[str, dict] = field(default_factory=dict)  # sym -> {shares, avg_cost}
    last_rebalance: str | None = None
    value_at_rebalance: float | None = None
    last_cash_accrual: str | None = None
    halted_until: str | None = None  # set when the loss limit trips

    # ---- persistence -------------------------------------------------
    @classmethod
    def load(cls, folder: Path) -> "PaperAccount":
        f = folder / "account.json"
        if not f.exists():
            raise FileNotFoundError(f"No paper account at {f}. Run `python paper.py init` first.")
        return cls(**json.loads(f.read_text()))

    def save(self, folder: Path) -> None:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "account.json").write_text(json.dumps(asdict(self), indent=2))

    @classmethod
    def create(cls, folder: Path, capital: float, strategy: StrategyConfig, risk: RiskConfig) -> "PaperAccount":
        if (folder / "account.json").exists():
            raise FileExistsError(f"{folder / 'account.json'} already exists; delete it to start over.")
        acct = cls(
            cash=capital,
            start_capital=capital,
            created=date.today().isoformat(),
            strategy=asdict(strategy),
            risk=asdict(risk),
            last_cash_accrual=date.today().isoformat(),
        )
        acct.save(folder)
        return acct

    # ---- helpers -----------------------------------------------------
    @property
    def strategy_cfg(self) -> StrategyConfig:
        return StrategyConfig(**self.strategy)

    @property
    def risk_cfg(self) -> RiskConfig:
        return RiskConfig(**self.risk)

    def value(self, prices: pd.Series) -> float:
        held = 0.0
        for sym, h in self.holdings.items():
            px = prices.get(sym)
            held += h["shares"] * (px if pd.notna(px) else h["avg_cost"])
        return self.cash + held

    def accrue_cash_yield(self, today: date) -> None:
        """Credit idle-cash interest for the days since the last accrual."""
        last = date.fromisoformat(self.last_cash_accrual or today.isoformat())
        days = (today - last).days
        if days > 0:
            self.cash *= (1 + self.risk_cfg.cash_yield_annual) ** (days / 365)
            self.last_cash_accrual = today.isoformat()


@dataclass
class Order:
    date: str
    side: str          # BUY / SELL
    symbol: str
    shares: int
    price: float
    value: float
    fee: float
    reason: str


def plan_rebalance(
    acct: PaperAccount, prices: pd.DataFrame, asof: pd.Timestamp | None = None
) -> tuple[dict[str, float], pd.Series, list[Order], list[str]]:
    """Compute target weights and the whole-share orders needed to reach them.

    Returns (target_weights, last_prices, orders, notes). Nothing is mutated.
    """
    cfg = acct.strategy_cfg
    risk = acct.risk_cfg
    bench = prices[BENCHMARK_TICKER].dropna()
    stocks = prices.drop(columns=[BENCHMARK_TICKER]).ffill()
    asof = asof or stocks.index[-1]
    last = stocks.loc[asof]
    notes: list[str] = []

    target = select_portfolio(stocks, bench, asof, cfg)
    if not target:
        if cfg.market_filter and not market_is_bullish(bench, asof, cfg.market_ma_days):
            notes.append("Market filter: Nifty below its 200-day average → 100% cash.")
        else:
            notes.append("No stock has positive momentum → 100% cash.")

    value = acct.value(last)
    orders: list[Order] = []
    today = asof.date().isoformat()

    # Sells first: anything held that is not in the target.
    for sym, h in acct.holdings.items():
        if sym not in target and h["shares"] > 0:
            px = float(last[sym])
            orders.append(Order(today, "SELL", sym, h["shares"], px, h["shares"] * px,
                                h["shares"] * px * risk.cost_per_side, "dropped from top list"))

    # Then size each target slot in whole shares.
    slots: dict[str, float] = {}
    for sym, w in target.items():
        px = float(last[sym])
        if not px > 0:
            notes.append(f"{sym}: no price, skipped")
        elif px > value * w:
            notes.append(f"{sym}: one share (₹{px:,.0f}) exceeds the ₹{value * w:,.0f} slot, skipped")
        else:
            slots[sym] = value * w
    unfilled = value * sum(target.values()) - sum(slots.values())
    if risk.spill_unfilled and unfilled > 0 and slots:
        extra = unfilled / len(slots)
        for sym in slots:
            slots[sym] = min(slots[sym] + extra, 2 * value * target[sym])
        notes.append(f"₹{unfilled:,.0f} from unfillable slots spread over {len(slots)} affordable picks")

    for sym, slot in slots.items():
        px = float(last[sym])
        want = math.floor(slot / px)
        have = acct.holdings.get(sym, {}).get("shares", 0)
        diff = want - have
        if diff > 0:
            orders.append(Order(today, "BUY", sym, diff, px, diff * px, diff * px * risk.cost_per_side,
                                "new pick" if have == 0 else "top-up"))
        elif diff < 0:
            orders.append(Order(today, "SELL", sym, -diff, px, -diff * px, -diff * px * risk.cost_per_side, "trim"))

    return target, last, orders, notes


def apply_orders(acct: PaperAccount, orders: list[Order]) -> None:
    for o in orders:
        h = acct.holdings.setdefault(o.symbol, {"shares": 0, "avg_cost": 0.0})
        if o.side == "BUY":
            total_cost = h["shares"] * h["avg_cost"] + o.value
            h["shares"] += o.shares
            h["avg_cost"] = total_cost / h["shares"]
            acct.cash -= o.value + o.fee
        else:
            h["shares"] -= o.shares
            acct.cash += o.value - o.fee
        if h["shares"] == 0:
            del acct.holdings[o.symbol]
    if acct.cash < -1e-6:
        raise RuntimeError(f"Paper account cash went negative ({acct.cash:.2f}); sizing bug")


def loss_limit_tripped(acct: PaperAccount, prices: pd.Series) -> bool:
    if acct.value_at_rebalance is None:
        return False
    return acct.value(prices) < acct.value_at_rebalance * (1 - acct.risk_cfg.max_monthly_loss)


def is_rebalance_due(acct: PaperAccount, asof: pd.Timestamp) -> bool:
    """Due if we have never rebalanced, or the month has changed since we last did."""
    if acct.last_rebalance is None:
        return True
    last = pd.Timestamp(acct.last_rebalance)
    return (asof.year, asof.month) != (last.year, last.month)


def record_orders(folder: Path, orders: list[Order]) -> None:
    f = folder / "orders.csv"
    new = not f.exists()
    with f.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(asdict(orders[0]).keys()) if orders else
                           ["date", "side", "symbol", "shares", "price", "value", "fee", "reason"])
        if new:
            w.writeheader()
        for o in orders:
            w.writerow(asdict(o))


def record_equity(folder: Path, when: datetime, value: float, cash: float, bench_px: float | None) -> None:
    f = folder / "equity.csv"
    new = not f.exists()
    with f.open("a", newline="") as fh:
        w = csv.writer(fh)
        if new:
            w.writerow(["timestamp", "value", "cash", "benchmark_price"])
        w.writerow([when.isoformat(timespec="minutes"), f"{value:.2f}", f"{cash:.2f}",
                    "" if bench_px is None else f"{bench_px:.2f}"])


def scores_table(prices: pd.DataFrame, cfg: StrategyConfig, n: int = 15) -> pd.DataFrame:
    """Top-n momentum scores with last price, for the `picks` command."""
    stocks = prices.drop(columns=[BENCHMARK_TICKER]).ffill()
    asof = stocks.index[-1]
    scores = momentum_scores(stocks, asof, cfg).sort_values(ascending=False).head(n)
    return pd.DataFrame({"momentum_12_1": scores.round(3), "last_price": stocks.loc[asof, scores.index].round(2)})
