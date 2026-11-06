"""Price data: download daily adjusted closes from Yahoo Finance and cache them."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .universe import BENCHMARK_TICKER, to_yahoo


def load_prices(
    symbols: list[str],
    start: str,
    cache_dir: Path,
    refresh: bool = False,
) -> pd.DataFrame:
    """Return a DataFrame of daily adjusted closes.

    Columns are NSE symbols (no suffix) plus ``BENCHMARK_TICKER``.
    Cached as CSV in ``cache_dir`` so repeated runs are instant and offline.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"prices_{start}.csv"

    if cache_file.exists() and not refresh:
        prices = pd.read_csv(cache_file, index_col=0, parse_dates=True)
        missing = [s for s in symbols + [BENCHMARK_TICKER] if s not in prices.columns]
        if not missing:
            return prices
        # Universe grew since the cache was built: refetch everything.

    import yfinance as yf  # imported lazily so tests can run without network

    tickers = [to_yahoo(s) for s in symbols] + [BENCHMARK_TICKER]
    raw = yf.download(
        tickers,
        start=start,
        progress=False,
        auto_adjust=True,  # adjusts for splits and dividends
        group_by="column",
        threads=True,
    )
    close = raw["Close"].copy()
    close.columns = [c if c == BENCHMARK_TICKER else c.removesuffix(".NS") for c in close.columns]
    close.index = pd.to_datetime(close.index).tz_localize(None)
    close = close.sort_index()

    # Drop tickers Yahoo returned nothing for (delisted / renamed).
    close = close.dropna(axis=1, how="all")
    close = clean_prices(close)
    close.to_csv(cache_file)
    return close


def clean_prices(
    prices: pd.DataFrame,
    min_coverage: float = 0.5,
    spike_down: float = -0.5,
    spike_up: float = 1.0,
    reversal_days: int = 3,
    reversal_tol: float = 0.15,
) -> pd.DataFrame:
    """Remove the two kinds of junk Yahoo Finance data is known to contain.

    1. Phantom trading days where almost no stock has a price (e.g. a special
       Saturday session recorded for the ETF only). These rows are dropped.
    2. Bad ticks: a single-day move beyond ``spike_down``/``spike_up`` that
       snaps back to the old level within ``reversal_days``. The bad days are
       blanked and forward-filled.

    Permanent level shifts are left alone on purpose. Some are real
    (demergers, relistings), some are unadjusted splits. Both make a long-only
    backtest look *worse*, not better, so leaving them in is the conservative
    choice. ``data_quality_report`` lists them so you can judge.
    """
    stocks = [c for c in prices.columns if c != BENCHMARK_TICKER]
    coverage = prices[stocks].notna().mean(axis=1)
    prices = prices.loc[coverage >= min_coverage].copy()

    for col in prices.columns:
        s = prices[col]
        ret = s.pct_change()
        spikes = ret.index[(ret < spike_down) | (ret > spike_up)]
        for day in spikes:
            i = s.index.get_loc(day)
            if i == 0:
                continue
            before = s.iloc[i - 1]
            after = s.iloc[i + 1 : i + 1 + reversal_days]
            back = after[(after / before - 1).abs() <= reversal_tol]
            if len(back):
                j = s.index.get_loc(back.index[0])
                prices.loc[s.index[i:j], col] = float("nan")
        prices[col] = prices[col].ffill()
    return prices


def data_quality_report(prices: pd.DataFrame, threshold: float = 0.5) -> pd.Series:
    """Single-day moves larger than ``threshold`` that survived cleaning."""
    ret = prices.pct_change().stack()
    return ret[ret.abs() > threshold].sort_values()


def month_ends(prices: pd.DataFrame) -> pd.DatetimeIndex:
    """Last trading day of each month present in the price index."""
    return prices.groupby([prices.index.year, prices.index.month]).apply(
        lambda g: g.index.max()
    ).sort_values().pipe(pd.DatetimeIndex)
