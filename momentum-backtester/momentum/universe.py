"""Stock universe: which NSE symbols the strategy is allowed to pick from.

Pulls the current constituent list for an NSE index (Nifty 200 by default)
from NSE's public archive and caches it locally.

IMPORTANT CAVEAT - survivorship bias:
    This is the list of companies in the index *today*. Companies that were
    in the index years ago but later collapsed or were dropped are not in it,
    so a backtest over this universe is somewhat optimistic. Treat the results
    as an upper bound, not a promise.
"""

from __future__ import annotations

import csv
import io
import urllib.request
from pathlib import Path

NSE_INDEX_URLS = {
    "nifty50": "https://archives.nseindia.com/content/indices/ind_nifty50list.csv",
    "nifty100": "https://archives.nseindia.com/content/indices/ind_nifty100list.csv",
    "nifty200": "https://archives.nseindia.com/content/indices/ind_nifty200list.csv",
    "nifty500": "https://archives.nseindia.com/content/indices/ind_nifty500list.csv",
}

# Nifty 50 ETF, dividends reinvested (auto_adjust). A fairer benchmark than the
# ^NSEI price index because the stock prices we use also include dividends.
BENCHMARK_TICKER = "NIFTYBEES.NS"
BENCHMARK_LABEL = "Nifty 50 ETF (NIFTYBEES)"


def fetch_universe(index: str = "nifty200", cache_dir: Path | None = None) -> list[str]:
    """Return NSE symbols (without the .NS suffix) for the given index.

    Uses a cached CSV in ``cache_dir`` if present, otherwise downloads it.
    """
    if index not in NSE_INDEX_URLS:
        raise ValueError(f"Unknown index {index!r}; choose from {sorted(NSE_INDEX_URLS)}")

    cache_file = (cache_dir / f"{index}.csv") if cache_dir else None
    if cache_file and cache_file.exists():
        text = cache_file.read_text()
    else:
        req = urllib.request.Request(
            NSE_INDEX_URLS[index], headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8-sig")
        if cache_file:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(text)

    return parse_constituents(text)


def parse_constituents(csv_text: str) -> list[str]:
    reader = csv.DictReader(io.StringIO(csv_text))
    symbols = []
    for row in reader:
        sym = (row.get("Symbol") or "").strip()
        if sym and row.get("Series", "EQ").strip() == "EQ":
            symbols.append(sym)
    if not symbols:
        raise ValueError("No symbols parsed from constituent CSV")
    return sorted(set(symbols))


def to_yahoo(symbol: str) -> str:
    """NSE symbol -> Yahoo Finance ticker."""
    return f"{symbol}.NS"
