# Momentum Backtester (NSE)

Stage 1 of a build-up plan: **prove a rules-based strategy on historical data
before any real money touches it.** No broker account needed; it runs on free
Yahoo Finance data.

The strategy is classic 12-1 momentum rotation, one of the most studied and
most robust anomalies in finance, and one of the few that needs just one short
session a month to run:

1. At each month end, score every stock in the universe (Nifty 200 by default)
   by its return over the last 12 months, skipping the most recent month.
2. Buy the top 10, equal weight. Never buy a stock whose score is negative.
3. If Nifty 50 is below its 200-day average, hold 100% cash (earning a liquid
   fund rate). This is the crash filter.
4. Repeat next month. Friction (STT, stamp duty, slippage) is charged on every
   rupee traded.

## Run it

```bash
cd momentum-backtester
pip install -r requirements.txt
python run.py                                 # Nifty 200, top 10, from 2010
python run.py --capital 30000 --start 2015-01-01
python run.py --index nifty500 --top-n 15
python run.py --no-market-filter              # how much is the crash filter worth?
python run.py --show-data-issues              # list odd price jumps in the data
python -m pytest tests                        # offline unit tests
```

Output lands in `output/`: `report.md` (metrics, year-by-year table, caveats),
`equity_curve.png`, `equity.csv` and `holdings.csv` (what it held each month).
Prices are cached in `data/`; pass `--refresh` to re-download.

## Reading the results honestly

The headline CAGR from this tool is **too high** and you should know why
before you look at it:

- **Survivorship bias.** The universe is the index's members *today*: the
  survivors. Companies that collapsed and got kicked out are invisible. A
  momentum strategy would have bought some of them on the way up. Bias-free
  studies of Indian momentum land around **15-20% CAGR after costs**; treat
  anything above that as bias, not edge.
- **Taxes are ignored.** Monthly churn means short-term capital gains (20%)
  on most profits; a Nifty index fund pays 12.5% and only when you sell.
- **Fractional shares are assumed.** With ₹30k, a ₹3,000 slot cannot buy one
  share of a ₹5,000 stock. Real small-account results will deviate.
- **Demergers and relistings look like crashes** in the data (a stock drops
  60% because a spun-off company was handed to shareholders). The tool leaves
  these in because they make the test more conservative, and `--show-data-issues`
  lists them.

What *is* trustworthy: the **shape**. Lower drawdowns than the index, sitting
in cash through 2011 and 2020, and the long flat stretches where the strategy
goes nowhere for a year. If you could not have sat through those, the strategy
is not for you, whatever the CAGR says.

## Project layout

```
run.py                 CLI
momentum/universe.py   NSE index constituents (fetched + cached)
momentum/data.py       price download, caching, bad-tick cleaning
momentum/strategy.py   momentum scores, filters, portfolio selection
momentum/backtest.py   monthly-rebalance engine with costs and cash yield
momentum/report.py     metrics, markdown report, chart
tests/                 offline tests on synthetic prices
```

## Next stages

- **Stage 2 — paper trading.** Connect a broker API (Dhan has a free one),
  compute this month's picks from live data, and log simulated orders. Run it
  for 1-2 months and compare the paper P&L with the backtest's expectations.
- **Stage 3 — small real allocation.** Only after Stage 2, only with money
  whose loss would not matter, with hard loss limits coded in.

## Disclaimer

Educational tool, not investment advice. Past performance in a backtest is
not an indication of future returns, and this backtest in particular is
knowingly optimistic for the reasons above.
