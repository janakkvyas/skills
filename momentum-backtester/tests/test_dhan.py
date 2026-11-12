"""Offline tests for the read-only Dhan connector."""

import inspect
import io
import json
import sys
import urllib.error
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from momentum import dhan  # noqa: E402
from momentum.dhan import DhanClient, DhanError, summarize_trades  # noqa: E402


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def patch_urlopen(monkeypatch, handler):
    seen = []

    def fake(req, timeout=None):
        seen.append(req)
        return handler(req)

    monkeypatch.setattr(dhan.urllib.request, "urlopen", fake)
    return seen


def http_error(code, payload):
    return urllib.error.HTTPError("u", code, "err", {}, io.BytesIO(json.dumps(payload).encode()))


def test_module_is_get_only():
    src = inspect.getsource(dhan)
    for word in ("POST", "PUT", "DELETE", "/orders"):
        assert word not in src


def test_funds_sends_token_header(monkeypatch):
    seen = patch_urlopen(monkeypatch, lambda r: FakeResp(b'{"availabelBalance": 11000.0}'))
    out = DhanClient(token="abc").funds()
    assert out["availabelBalance"] == 11000.0
    assert seen[0].get_method() == "GET"
    assert seen[0].get_header("Access-token") == "abc"
    assert seen[0].full_url.endswith("/v2/fundlimit")


def test_no_holdings_error_means_empty(monkeypatch):
    def h(r):
        raise http_error(500, {"errorCode": "DH-1111", "errorMessage": "No holdings available"})
    patch_urlopen(monkeypatch, h)
    assert DhanClient(token="x").holdings() == []


def test_expired_token_gives_clear_message(monkeypatch):
    def h(r):
        raise http_error(401, {"errorCode": "DH-901"})
    patch_urlopen(monkeypatch, h)
    with pytest.raises(DhanError, match="expired"):
        DhanClient(token="x").funds()


def test_trades_paginates_until_empty(monkeypatch):
    pages = {0: [{"orderId": 1}], 1: [{"orderId": 2}], 2: []}
    patch_urlopen(monkeypatch, lambda r: FakeResp(json.dumps(pages[int(r.full_url.rsplit("/", 1)[1])]).encode()))
    assert [t["orderId"] for t in DhanClient(token="x").trades("2026-01-01", "2026-01-31")] == [1, 2]


def test_summarize_trades_net_cash_and_charges():
    trades = [
        {"tradingSymbol": "BHEL", "transactionType": "BUY", "tradedQuantity": 10, "tradedPrice": 400, "stt": 4},
        {"tradingSymbol": "BHEL", "transactionType": "SELL", "tradedQuantity": 10, "tradedPrice": 450, "stt": 4.5},
        {"tradingSymbol": "MCX", "transactionType": "BUY", "tradedQuantity": 1, "tradedPrice": 3500},
    ]
    rows = {r["symbol"]: r for r in summarize_trades(trades)}
    assert rows["BHEL"]["net_cash"] == pytest.approx(500 - 8.5)
    assert rows["BHEL"]["open_qty"] == 0
    assert rows["MCX"]["open_qty"] == 1
