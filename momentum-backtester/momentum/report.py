"""Performance metrics and a plain-language report."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .backtest import BacktestResult
from .universe import BENCHMARK_LABEL


def cagr(series: pd.Series) -> float:
    years = (series.index[-1] - series.index[0]).days / 365.25
    return (series.iloc[-1] / series.iloc[0]) ** (1 / years) - 1 if years > 0 else 0.0


def max_drawdown(series: pd.Series) -> tuple[float, pd.Timestamp, pd.Timestamp]:
    peak = series.cummax()
    dd = series / peak - 1
    trough = dd.idxmin()
    start = series.loc[:trough].idxmax()
    return float(dd.min()), start, trough


def sharpe(series: pd.Series, rf_annual: float = 0.06) -> float:
    r = series.pct_change().dropna()
    if r.std() == 0:
        return 0.0
    excess = r - rf_annual / 252
    return float(np.sqrt(252) * excess.mean() / r.std())


def yearly_returns(series: pd.Series) -> pd.Series:
    return series.resample("YE").last().pct_change().dropna().rename(
        lambda d: d.year
    )


def metrics(result: BacktestResult) -> dict[str, float]:
    s, b = result.equity, result.benchmark
    s_dd, _, _ = max_drawdown(s)
    b_dd, _, _ = max_drawdown(b)
    ys, yb = yearly_returns(s), yearly_returns(b)
    return {
        "start_value": float(s.iloc[0]),
        "end_value": float(s.iloc[-1]),
        "benchmark_end_value": float(b.iloc[-1]),
        "cagr": cagr(s),
        "benchmark_cagr": cagr(b),
        "max_drawdown": s_dd,
        "benchmark_max_drawdown": b_dd,
        "sharpe": sharpe(s),
        "benchmark_sharpe": sharpe(b),
        "worst_year": float(ys.min()) if len(ys) else 0.0,
        "benchmark_worst_year": float(yb.min()) if len(yb) else 0.0,
        "best_year": float(ys.max()) if len(ys) else 0.0,
        "years": (s.index[-1] - s.index[0]).days / 365.25,
        "trades": result.trades,
        "total_costs": result.total_costs,
        "months_in_cash": result.months_in_cash,
        "total_months": len(result.holdings),
    }


def _inr(x: float) -> str:
    return f"₹{x:,.0f}"


def _pct(x: float) -> str:
    return f"{x * 100:+.1f}%"


def write_report(result: BacktestResult, out_dir: Path, title: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    m = metrics(result)
    ys, yb = yearly_returns(result.equity), yearly_returns(result.benchmark)
    yearly = pd.DataFrame({"strategy": ys, "benchmark": yb}).fillna(0.0)

    chart = _plot(result, out_dir / "equity_curve.png", title)
    result.equity.to_frame().join(result.benchmark).to_csv(out_dir / "equity.csv")
    result.holdings.to_csv(out_dir / "holdings.csv")

    lines = [
        f"# {title}",
        "",
        f"Period: {result.equity.index[0].date()} → {result.equity.index[-1].date()} "
        f"({m['years']:.1f} years), monthly rebalance.",
        "",
        f"| | Strategy | {BENCHMARK_LABEL} buy & hold |",
        "|---|---:|---:|",
        f"| {_inr(m['start_value'])} became | **{_inr(m['end_value'])}** | {_inr(m['benchmark_end_value'])} |",
        f"| CAGR | **{_pct(m['cagr'])}** | {_pct(m['benchmark_cagr'])} |",
        f"| Worst peak-to-trough fall | **{_pct(m['max_drawdown'])}** | {_pct(m['benchmark_max_drawdown'])} |",
        f"| Worst calendar year | {_pct(m['worst_year'])} | {_pct(m['benchmark_worst_year'])} |",
        f"| Best calendar year | {_pct(m['best_year'])} | |",
        f"| Sharpe (6% risk-free) | {m['sharpe']:.2f} | {m['benchmark_sharpe']:.2f} |",
        f"| Trades executed | {m['trades']} | 1 |",
        f"| Friction paid (STT, fees, slippage) | {_inr(m['total_costs'])} | ~0 |",
        f"| Months fully in cash (market filter) | {m['months_in_cash']} / {m['total_months']} | 0 |",
        "",
        "## Year by year",
        "",
        f"| Year | Strategy | {BENCHMARK_LABEL} |",
        "|---|---:|---:|",
        *[f"| {y} | {_pct(r.strategy)} | {_pct(r.benchmark)} |" for y, r in yearly.iterrows()],
        "",
        "## Read this before you believe it",
        "",
        "- **Survivorship bias is large here.** The universe is *today's* index members, "
        "i.e. the companies that already won. Stocks that collapsed and were dropped from "
        "the index are invisible to this test, and a momentum strategy would have bought "
        "some of them on the way up. Published studies of Indian momentum on bias-free "
        "data land around 15-20% CAGR after costs. **Treat anything above that in the table "
        "as bias, not edge.** The *shape* (lower drawdown than the index, cash during "
        "crashes) is the trustworthy part; the headline CAGR is not.",
        "- **Taxes are not included.** Monthly churn means most gains are short-term "
        "capital gains (20%). Nifty buy-and-hold pays long-term rates (12.5%) only when sold.",
        "- **Fractional shares are assumed.** With a small account some high-priced "
        "stocks cannot be bought at the target weight; see `holdings.csv`.",
        "- **The worst drawdown is the number that matters.** Ask yourself honestly "
        "whether you would have kept following the rules while down that much.",
        "",
        f"![equity curve]({chart.name})",
    ]
    report = out_dir / "report.md"
    report.write_text("\n".join(lines))
    return report


def _plot(result: BacktestResult, path: Path, title: str) -> Path:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, (ax1, ax2) = plt.subplots(
        2, 1, figsize=(11, 7), sharex=True, gridspec_kw={"height_ratios": [3, 1]}
    )
    ax1.plot(result.equity.index, result.equity, label="Momentum strategy", color="#1f77b4")
    ax1.plot(result.benchmark.index, result.benchmark, label=f"{BENCHMARK_LABEL} buy & hold", color="#888", alpha=0.9)
    ax1.set_yscale("log")
    ax1.set_title(title)
    ax1.set_ylabel("Portfolio value (₹, log scale)")
    ax1.legend(loc="upper left")
    ax1.grid(alpha=0.3)

    for s, color in ((result.equity, "#1f77b4"), (result.benchmark, "#888")):
        dd = s / s.cummax() - 1
        ax2.fill_between(dd.index, dd, 0, color=color, alpha=0.35)
    ax2.set_ylabel("Drawdown")
    ax2.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax2.grid(alpha=0.3)

    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)
    return path
