"""Read-only Dhan connector.

This module can only send HTTP GET requests. It has no code path that places,
modifies or cancels an order, so running it cannot touch your money.

Authentication: Dhan expects the access token in an ``access-token`` header.
In a Claude Code cloud session the network proxy injects the saved token, so
no secret lives in this code or in an environment variable. On your own
computer, set ``DHAN_ACCESS_TOKEN`` before running. Tokens expire after
24 hours; regenerate one on web.dhan.co → DhanHQ Trading APIs when you get
a 401.

Endpoints used (free tier, Dhan API v2):
    GET /fundlimit                       cash and margin
    GET /holdings                        delivery holdings
    GET /positions                       open intraday / F&O positions
    GET /trades/{from}/{to}/{page}       executed trades with charges
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

BASE_URL = "https://api.dhan.co/v2"

# Dhan returns HTTP 500 with this code when the account simply has no holdings.
NO_HOLDINGS_CODE = "DH-1111"


class DhanError(RuntimeError):
    pass


@dataclass
class DhanClient:
    token: str = ""
    base_url: str = BASE_URL
    timeout: int = 30

    @classmethod
    def from_env(cls) -> "DhanClient":
        # "proxy-injected" is a placeholder: in a cloud session the proxy
        # overwrites the header with the real saved token.
        return cls(token=os.environ.get("DHAN_ACCESS_TOKEN", "proxy-injected"))

    def _get(self, path: str):
        req = urllib.request.Request(
            f"{self.base_url}/{path.lstrip('/')}",
            method="GET",
            headers={
                "access-token": self.token,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode()
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            try:
                err = json.loads(body)
            except json.JSONDecodeError:
                err = {}
            if err.get("errorCode") == NO_HOLDINGS_CODE:
                return []
            if e.code in (401, 403):
                raise DhanError(
                    "Dhan rejected the token (it may have expired; tokens last 24 hours). "
                    "Generate a new one on web.dhan.co → DhanHQ Trading APIs."
                ) from None
            raise DhanError(f"GET {path} failed: HTTP {e.code} {body[:200]}") from None
        return json.loads(body) if body.strip() else []

    # ---- read-only endpoints ------------------------------------------
    def funds(self) -> dict:
        return self._get("fundlimit")

    def holdings(self) -> list[dict]:
        return self._get("holdings")

    def positions(self) -> list[dict]:
        return self._get("positions")

    def trades(self, from_date: str, to_date: str, max_pages: int = 50) -> list[dict]:
        """All executed trades between two YYYY-MM-DD dates (inclusive)."""
        out: list[dict] = []
        for page in range(max_pages):
            batch = self._get(f"trades/{from_date}/{to_date}/{page}")
            if not batch:
                break
            out.extend(batch)
        return out


def trade_charges(t: dict) -> float:
    keys = ("sebiTax", "stt", "brokerageCharges", "serviceTax",
            "exchangeTransactionCharges", "stampDuty")
    return float(sum(float(t.get(k) or 0) for k in keys))


def summarize_trades(trades: list[dict]) -> list[dict]:
    """Per-symbol buy/sell totals, realised cash flow and charges."""
    agg: dict[str, dict] = {}
    for t in trades:
        sym = t.get("customSymbol") or t.get("tradingSymbol") or str(t.get("securityId"))
        a = agg.setdefault(sym, {"symbol": sym, "buy_qty": 0, "buy_value": 0.0,
                                 "sell_qty": 0, "sell_value": 0.0, "charges": 0.0})
        qty = int(t.get("tradedQuantity") or 0)
        value = qty * float(t.get("tradedPrice") or 0)
        if str(t.get("transactionType")).upper() == "BUY":
            a["buy_qty"] += qty
            a["buy_value"] += value
        else:
            a["sell_qty"] += qty
            a["sell_value"] += value
        a["charges"] += trade_charges(t)
    for a in agg.values():
        a["net_cash"] = a["sell_value"] - a["buy_value"] - a["charges"]
        a["open_qty"] = a["buy_qty"] - a["sell_qty"]
    return sorted(agg.values(), key=lambda a: a["net_cash"])
