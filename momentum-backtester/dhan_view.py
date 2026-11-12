#!/usr/bin/env python3
"""Read-only view of your Dhan account. Cannot place orders.

    python dhan_view.py                       funds, holdings, open positions
    python dhan_view.py journal               trades in the last 90 days, P&L by symbol
    python dhan_view.py journal --days 365
    python dhan_view.py journal --csv out.csv also save every trade to CSV

On your own computer: export DHAN_ACCESS_TOKEN=... first (token lasts 24 hours).
In a Claude Code cloud session the saved token is injected automatically.
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, timedelta

from momentum.dhan import DhanClient, DhanError, summarize_trades


def inr(x: float) -> str:
    return f"₹{x:,.2f}"


def cmd_summary(client: DhanClient) -> None:
    f = client.funds()
    print(f"Dhan account {f.get('dhanClientId', '?')}")
    print(f"  available to trade   {inr(float(f.get('availabelBalance', 0)))}")
    print(f"  withdrawable         {inr(float(f.get('withdrawableBalance', 0)))}")
    print(f"  used today           {inr(float(f.get('utilizedAmount', 0)))}")

    h = client.holdings()
    print(f"\nHoldings ({len(h)})")
    if not h:
        print("  none")
    total = 0.0
    for x in h:
        cost = float(x.get("avgCostPrice", 0)) * int(x.get("totalQty", 0))
        total += cost
        print(f"  {x.get('tradingSymbol', '?'):<14} {int(x.get('totalQty', 0)):>6} sh  "
              f"avg {inr(float(x.get('avgCostPrice', 0))):>12}  cost {inr(cost):>14}")
    if h:
        print(f"  {'total cost':<14} {'':>28}{inr(total):>14}")

    p = client.positions()
    print(f"\nOpen positions ({len(p)})")
    if not p:
        print("  none")
    for x in p:
        print(f"  {x.get('tradingSymbol', '?'):<24} net {int(x.get('netQty', 0)):>6}  "
              f"realised {inr(float(x.get('realizedProfit', 0))):>12}  "
              f"unrealised {inr(float(x.get('unrealizedProfit', 0))):>12}")


def cmd_journal(client: DhanClient, days: int, csv_path: str | None) -> None:
    to_d = date.today()
    from_d = to_d - timedelta(days=days)
    trades = client.trades(from_d.isoformat(), to_d.isoformat())
    print(f"Trades {from_d} → {to_d}: {len(trades)}")
    if not trades:
        return
    rows = summarize_trades(trades)
    print(f"\n{'symbol':<26}{'bought':>14}{'sold':>14}{'charges':>11}{'net cash':>14}  open")
    for r in rows:
        print(f"{r['symbol'][:25]:<26}{inr(r['buy_value']):>14}{inr(r['sell_value']):>14}"
              f"{inr(r['charges']):>11}{inr(r['net_cash']):>14}  {r['open_qty']}")
    closed = [r for r in rows if r["open_qty"] == 0]
    print(f"\nClosed out: {len(closed)} symbols, net {inr(sum(r['net_cash'] for r in closed))} "
          f"after {inr(sum(r['charges'] for r in rows))} in charges")
    print("(Symbols with open quantity show cash spent, not profit.)")
    if csv_path:
        keys = sorted({k for t in trades for k in t})
        with open(csv_path, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=keys)
            w.writeheader()
            w.writerows(trades)
        print(f"Saved {len(trades)} trades to {csv_path}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")
    j = sub.add_parser("journal")
    j.add_argument("--days", type=int, default=90)
    j.add_argument("--csv")
    a = p.parse_args()
    client = DhanClient.from_env()
    try:
        if a.cmd == "journal":
            cmd_journal(client, a.days, a.csv)
        else:
            cmd_summary(client)
    except DhanError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    main()
