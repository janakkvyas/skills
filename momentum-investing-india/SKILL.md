---
name: momentum-investing-india
description: Evaluate trading and investing ideas for an Indian retail investor with evidence, and run a staged, rules-based momentum plan (backtest → paper trade → small real money) instead of discretionary or options gambling. Use when the user shares a Reddit/WSB gain screenshot, asks how to copy a trade, asks about options/F&O, SPX/0DTE, Nifty weekly expiry, "passive income from trading", momentum funds, or wants to build/run the momentum-backtester tools in this repo.
---

# Momentum Investing (India)

A skill for turning "how do I get those gains?" into a plan that survives
contact with the market. It encodes what the evidence says, what Indian rules
allow, and how to use the `momentum-backtester/` tools in this repo.

## Quick start

When the user brings a trade idea, screenshot or strategy:

1. **Triage it** with the checklist below. Say plainly what the screenshot
   does and doesn't show.
2. **Translate it** to the nearest *rules-based* version that can be tested.
   Discretionary 0DTE buying has no testable rule; "buy the top-N 12-1
   momentum stocks monthly, cash when Nifty < 200-DMA" does.
3. **Run the stage the user is at** (see Staged plan). Never skip a stage.
4. **Quote numbers from [EVIDENCE.md](EVIDENCE.md)**, not from memory, and
   name the source.

## Triage checklist for a "gain" post

Work through these out loud with the user:

- **Weekly vs all-time return.** A Robinhood card shows both. +5,207% past
  week next to +295% all-time means the account was deeply down before the
  jackpot. Compute the implied prior balance.
- **Instrument.** 0DTE / weekly options bought far out of the money are
  lottery tickets. Most expire worthless; only the winners get posted.
- **Order history.** Dozens of rapid buys/sells and cancels = a coin-flip
  streak, not a method. Ask: what rule decided each entry?
- **Survivorship.** r/wallstreetbets and r/IndianStreetBets are highlight
  reels. SEBI's data on the population: ~9 in 10 F&O traders lose money,
  every year it has been measured (see EVIDENCE.md).
- **Can this be done from India at all?** Options buying on SPX from India
  via LRS is a grey area and leveraged/margin trading abroad is not
  permitted under LRS; Nifty/Sensex weekly options are the local equivalent
  and carry the same base rates.

Then redirect: the *passive, low-effort, rules-based* relative of a momentum
trade is monthly momentum rotation or a momentum index fund. That is the
thing worth building.

## The strategy this skill endorses

**12-1 cross-sectional momentum with a trend filter**, monthly:

| Rule | Why |
|---|---|
| Score = return over last 12 months, skipping the most recent month | Jegadeesh-Titman (1993); the 1-month skip avoids short-term reversal |
| Hold top-N (10 default; 5 for accounts < ₹50k) equal weight | Diversifies single-stock blowups; whole-share sizing needs big slots |
| Never buy a stock with negative 12-1 return (absolute momentum) | Antonacci (2013): absolute momentum cuts downside |
| If Nifty 50 < 200-day average → 100% cash | Faber (2007) 10-month SMA rule; Daniel-Moskowitz (2016) momentum crashes happen in post-crash rebounds |
| Charge ~0.2% per side; count idle cash at ~6% | Realistic Indian delivery friction; liquid-fund yield |
| Monthly loss limit (10%) → cash until next month | Behavioural guardrail; keeps a bad month survivable |

**Honest expectation (bias-free NSE data, Apr 2005 → Jun 2026):** Nifty200
Momentum 30 TRI 18.8% CAGR vs Nifty 50 TRI 13.6%. It lost 34.9% in FY09,
underperformed Nifty in 6 of 21 financial years, and had a losing streak
FY25-FY26 (-7.6%, -3.4%) while Nifty was flat. Plan on 15-20% over a decade
with 30-40% drawdowns, not the 30%+ a survivorship-biased backtest prints.

## Staged plan

Do not let the user jump stages. Each has an exit test.

| Stage | What | Tool | Exit test |
|---|---|---|---|
| 0 | Index fund SIP (Nifty 50, direct, growth); emergency fund first | none | Running; never touched for trading |
| 1 | Backtest the rules on history | `python run.py` | User has read `output/report.md` incl. the caveats and worst drawdown |
| 2 | Paper trade on live prices, simulated orders | `python paper.py` | ≥ 2 monthly rebalances; paper P&L compared with backtest; user still wants to |
| 3 | Real money, ≤ 5% of capital, loss limits on | broker adapter (not built; behind an explicit `--live` flag) | 6 months of real results before scaling to 15-20% |

An easier Stage 3 for most people: a **Nifty200 Momentum 30 index fund**
(UTI, HDFC, ICICI Pru, SBI, Motilal Oswal, Bandhan, Baroda BNP all run one).
Same factor, no execution, no monthly chore, semi-annual rebalance, lower
tax drag. The DIY version wins only if the user values control and the
200-DMA cash filter, which the index does not have.

## Running the tools

```bash
cd momentum-backtester && pip install -r requirements.txt
python -m pytest tests                     # 21 offline tests
python run.py --capital 30000 --start 2015-01-01
python paper.py init --capital 30000 --top-n 5
python paper.py rebalance --dry-run        # see this month's orders
python paper.py rebalance                  # record them (once per month)
python paper.py status                     # value, holdings, loss-limit check
```

Paper-account state (`paper/`) is committed to the repo so it survives
between sessions. Month-end routine: `rebalance`, then `status`, commit.

Interpreting `run.py` output: the CAGR is inflated by survivorship bias
(universe = today's index members). Trust the drawdown shape, the months
in cash, and the year-by-year pattern; distrust the headline number.

## Indian constraints to state when relevant

- **F&O base rates:** SEBI FY22-24: 93% of individual F&O traders lost money,
  ₹1.8 lakh crore total. FY25: 91%, ₹1.06 lakh crore. FY26: 87.7%; 90% of
  option *buyers* lost. Only ~1% made > ₹1 lakh/year after costs.
- **Lot sizes:** one Nifty lot ≈ ₹19 lakh notional; option selling needs
  ₹1-1.5 lakh margin per lot. Sub-₹5 lakh accounts cannot do this sanely.
- **Tax (FY26-27, unchanged by Budget 2026):** equity STCG 20%, LTCG 12.5%
  above ₹1.25 lakh/year. Monthly rotation is almost all STCG. F&O profit is
  business income at slab rate.
- **Investing abroad:** LRS allows buying US stocks/ETFs; margin and
  leveraged derivatives are not permitted; TCS applies above the threshold;
  foreign assets must be reported in the ITR.
- **Algo rules:** SEBI's 2025 retail-algo framework requires broker
  registration of API strategies, static IP, and exchange approval above an
  order-rate threshold. Paper trading needs none of this.

## What this skill refuses

- Building a bot that places real 0DTE/weekly option trades autonomously.
- Presenting a biased backtest CAGR as an expected return.
- Skipping Stage 2 because the backtest "looked good".
- Taking API keys in chat. A broker key goes into the environment's secret
  store via the secure form, and only when Stage 3 is actually reached.

## See also

- [EVIDENCE.md](EVIDENCE.md): every number above with its source.
- `momentum-backtester/README.md`: tool details and the full caveat list.
