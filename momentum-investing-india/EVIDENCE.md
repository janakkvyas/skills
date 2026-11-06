# Evidence

Numbers the skill relies on, with sources. Collected 2026-11-06. Re-verify
anything older than a year before quoting it as current.

## 1. Bias-free momentum performance in India

NSE computes the Nifty200 Momentum 30 index back to April 2005 using the
constituents *as they were* at each review, so it has no survivorship bias.
Selection: 50% 12-month + 50% 6-month price return, volatility-adjusted,
30 stocks, tilt-weighted, rebalanced in June and December.

**Since inception (Apr 1 2005 → Jun 30 2026), total-return CAGR**
(HDFC AMC presentation, July 2026, data from NSE Indices):

| Index | CAGR |
|---|---|
| Nifty200 Momentum 30 TRI | **18.8%** |
| Nifty 200 TRI | 13.9% |
| Nifty 50 TRI | 13.6% |

**Average rolling returns (daily rolling, Apr 2005 → Jun 2026):**

| Horizon | Momentum 30 | Nifty 200 | Nifty 50 | Momentum std-dev |
|---|---|---|---|---|
| 1 year | 22.3% | 16.4% | 15.9% | 28.6% |
| 3 year | 18.2% | 12.8% | 12.5% | 8.7% |
| 5 year | 18.6% | 12.9% | 12.6% | 6.3% |
| 10 year | 19.1% | 12.6% | 12.2% | 2.9% |

**Financial-year returns, Momentum 30 TRI vs Nifty 50 TRI** (same source):

| FY | Momentum 30 | Nifty 50 | Note |
|---|---|---|---|
| FY06 | 79.7% | 67.4% | |
| FY07 | 4.7% | 14.3% | underperformed |
| FY08 | 40.9% | 25.1% | |
| FY09 | **-34.9%** | -35.4% | GFC |
| FY10 | 62.9% | 75.3% | underperformed in the rebound (momentum crash pattern) |
| FY11 | 14.1% | 12.4% | |
| FY12 | -0.3% | -8.2% | |
| FY13 | 16.4% | 8.7% | |
| FY14 | 21.4% | 19.5% | |
| FY15 | 60.2% | 28.2% | |
| FY16 | -4.4% | -7.8% | |
| FY17 | 40.2% | 20.2% | |
| FY18 | 21.6% | 11.8% | |
| FY19 | 11.6% | 16.4% | underperformed, narrow market |
| FY20 | -16.4% | -25.0% | COVID |
| FY21 | 62.4% | 72.5% | underperformed in the rebound |
| FY22 | 37.7% | 20.3% | |
| FY23 | -9.2% | 0.6% | underperformed |
| FY24 | 70.0% | 30.1% | |
| FY25 | **-7.6%** | 6.7% | underperformed |
| FY26 | -3.4% | -4.0% | |
| FY27 YTD | 14.4% | 7.4% | to Jun 30 2026 |

Outperformed Nifty 50 in 15 of 21 years (71%). The two worst relative
years (FY10, FY21) are both post-crash rebounds, exactly what Daniel &
Moskowitz predict.

**NSE factsheet (as of Mar 28 2025):** since-inception TRI 18.05% CAGR,
annualised volatility 22.31% since inception (19.4% over 1 and 5 years),
beta to Nifty 50 ≈ 1.15. 1-year return at that point: -8.48%.

Fund-level max drawdown reported for the Sep 2024 → Apr 2025 slide:
about -31.7% to -31.9% (ETF/fund pages; index-level figure not verified).

Sources:
- HDFC NIFTY200 Momentum 30 Index Fund presentation, July 2026:
  https://files.hdfcfund.com/s3fs-public/Others/2026-07/HDFC%20NIFTY200%20Momentum%2030%20Index%20Fund_PPT%20%28July%202026%29.pdf
- NSE Indices factsheet: https://www.niftyindices.com/Factsheet/Factsheet_Nifty200_Momentum30.pdf
- freefincal independent review (warns: high churn, more volatile, needs
  "robot-like discipline" to replicate; taxes and brokerage significant):
  https://freefincal.com/nifty200-momentum-30-index-a-new-strategy-index-from-the-nse/
- Dealplexus summary of NSE white paper (Apr 2005 → Feb 2026: 19.19% vs
  15.08% for Nifty 200): https://www.dealplexus.com/blog/momentum-funds-india

## 2. Academic basis

- **Jegadeesh & Titman (1993)**, "Returns to Buying Winners and Selling
  Losers", Journal of Finance. First documentation of 3-12 month momentum
  in US stocks, 1965-1989. Origin of the 12-1 formation rule.
- **Daniel & Moskowitz (2016)**, "Momentum Crashes", Journal of Financial
  Economics. Momentum suffers rare, persistent strings of losses in "panic"
  states: after market declines, when volatility is high, during the rebound.
  Partly forecastable → reduce exposure when volatility is high.
  https://www.nber.org/system/files/working_papers/w20439/w20439.pdf
- **Faber (2007)**, "A Quantitative Approach to Tactical Asset Allocation",
  Journal of Wealth Management. Hold when price > 10-month SMA, else cash.
  Equity-like returns with bond-like drawdowns across asset classes since
  1973. Basis of the 200-DMA cash filter.
- **Antonacci (2013)**, "Absolute Momentum: A Simple Rule-Based Strategy and
  Universal Trend-Following Overlay", SSRN 2244633. Only hold an asset whose
  own trailing excess return is positive; cuts downside of long-only
  portfolios. Basis of the "never buy negative momentum" rule.
- **Indian studies** are thin and mixed. One JCAR paper found long-only
  momentum after costs unrewarding for small investors; an NSE 1997-2013
  study found significant short-term momentum. Neither reports a net CAGR on
  a survivorship-free universe, which is why this skill leans on the NSE
  index history above instead.
  https://www.publishingindia.com/archive/jcar/can-small-investors-gain-from-momentum-trading-in-india-an-empirical-investigation

## 3. What retail F&O trading actually returns (SEBI)

| Study | Period | Share of individuals losing | Aggregate net loss |
|---|---|---|---|
| Jan 2023 | FY22 | 89% | avg loss ₹1.1 lakh/person |
| Sep 2024 | FY22-FY24 | 93% (1.13 crore traders) | ₹1.81 lakh crore; ~1% made > ₹1 lakh/yr |
| Jul 2025 | FY25 | > 91% | ₹1.06 lakh crore (+41% YoY) |
| 2026 | FY26 | 87.7%; 90% of option buyers | ₹91,685 crore; costs pushed 4.4 lakh gross winners into net loss |

Options sellers: 43.8% lost in FY26 but with much larger losses when they
did. Of traders who lost two years running and kept going, ~90% lost again.

Sources:
- https://www.moneylife.in/article/93-percentage-of-individual-traders-lost-rs18-lakh-crore-in-equity-fo-in-past-3-years-sebi/75210.html
- https://www.business-standard.com/amp/markets/news/net-losses-of-traders-in-fo-widens-in-fy25-sebi-study-125070701221_1.html
- https://openthemagazine.com/business/sebi-fo-loss-study-explained-why-9-in-10-retail-traders-lost-91685-crore-in-fy26
- https://www.business-standard.com/amp/article/markets/sebi-study-suggests-89-retail-traders-in-equity-f-o-suffered-losses-123012501466_1.html

## 4. Tax (India, FY2026-27)

Budget 2026 left the equity regime unchanged: STCG (≤ 12 months, STT paid)
flat 20%; LTCG (> 12 months) 12.5% without indexation above ₹1.25 lakh per
year; plus surcharge and 4% cess. F&O profits are non-speculative business
income taxed at slab rate, with audit requirements above turnover limits.
Sources:
- https://www.precize.in/blogs/capital-gains-tax-on-shares-in-india-ltcg-stcg-rates-holding-periods-and-budget-2026
- https://www.kotakneo.com/investing-guide/articles/pre-budget-ltcg-stcg-for-indian-investors/

## 5. Community sentiment (secondary; Reddit blocks automated reads)

- r/wallstreetbets: the originating post (u/USSZim, "$1,300 to $111k in 2
  days") was 5 SPX 0DTE calls bought at $2.40 and sold at $52-60, followed by
  a put-selling streak with many cancelled orders. The account's all-time
  return (+295%) vs weekly (+5,207%) implies it was ~90% down before the win.
- r/IndianStreetBets (Apr 2026): a widely shared post of a ₹2.93 lakh loss
  over three years from holding losing bought options without stops; the
  thread's consensus was to cap options at a small share of capital.
- r/IndiaInvestments (2025-26): momentum index funds are debated mainly
  around the 2024-25 drawdown and "factor timing"; the recurring advice is
  SIP rather than lump sum, and to expect multi-year underperformance
  stretches.

Secondary sources:
- https://in.benzinga.com/24/09/40994647/sebi-study-unveils-93-of-individual-f-o-traders-suffered-losses-between-fy22-and-fy24
- https://www.multibagg.ai/market-pulse/articles/motilal-oswal-momentum-30-review-cmozsttmi22trpn0jgg2hgh4j
