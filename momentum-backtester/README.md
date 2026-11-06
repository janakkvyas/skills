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

## Stage 2: paper trading (`paper.py`)

The same rules, run forward on live prices, with **simulated orders only**.
No broker account is needed; prices come from Yahoo Finance. Nothing in this
code can place a real order.

```bash
python paper.py init --capital 30000      # once
python paper.py picks                     # today's ranking and market-filter state
python paper.py rebalance --dry-run       # see this month's orders
python paper.py rebalance                 # record them (only acts once per month)
python paper.py status                    # value, holdings, P&L, loss-limit check
```

State is kept in `paper/` (git-ignored): `account.json`, `orders.csv` with
every simulated fill, and `equity.csv` with a value snapshot per run.

What it does that the backtest did not:

- **Whole shares.** With ₹30k, a ₹3,000 slot cannot hold APARINDS at ₹14,000.
  Unfillable slots are reported and their cash is spread over the affordable
  picks (capped at twice a normal slot). Consider `--top-n 5` for accounts
  under ₹50k so slots are bigger.
- **Monthly loss limit.** If the account falls 10% below its value at the last
  rebalance, `status` sells everything and sits in cash until next month.
  Set it with `init --max-monthly-loss`.
- **Rebalance guard.** `rebalance` refuses to act twice in one calendar month
  unless you pass `--force`.

Run `rebalance` after the close on the last trading day of each month, and
`status` whenever you like. A cron line that does both on weekdays at 16:00
IST (it only trades when a new month has started):

```
0 16 * * 1-5  cd /path/to/momentum-backtester && python paper.py rebalance >> paper/cron.log 2>&1 && python paper.py status >> paper/cron.log 2>&1
```

Give it one or two months. Compare the paper P&L against the Nifty line in
`status` and against what the backtest's year-by-year table led you to expect.
If the experience of watching it is unpleasant at ₹30k, it will be unbearable
at ₹3 lakh, and that is worth knowing before Stage 3.

### Plugging in a broker later

`paper.py` only needs two things from the outside world: daily closes (now
Yahoo via `momentum/data.py`) and, eventually, an order sink. A Dhan or Kite
adapter would replace `live_prices()` with the broker's historical-data
endpoint and, for Stage 3 only, turn `apply_orders` into real order placement
behind an explicit `--live` flag that does not exist yet, on purpose.

## Stage 3: small real allocation

Only after Stage 2, only with money whose loss would not matter, with the
loss limits above still in force.

## Disclaimer

Educational tool, not investment advice. Past performance in a backtest is
not an indication of future returns, and this backtest in particular is
knowingly optimistic for the reasons above.
