from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

import pool

DEMO_DAY = date(2026, 10, 17)


def fresh():
    return pool.load_seed()


def test_maya_gets_full_uncovered_gap():
    p = fresh()
    r = pool.evaluate_request(p, "maya", 2500, uncovered_gap=2500, today=DEMO_DAY)
    assert r["decision"] == "approved"
    assert r["approved"] == 2500
    assert all(c["passed"] for c in r["checks"])


def test_pool_never_pays_more_than_the_gap():
    p = fresh()
    r = pool.evaluate_request(p, "maya", 6000, uncovered_gap=2500, today=DEMO_DAY)
    assert r["approved"] == 2500
    assert r["decision"] == "partial"


def test_new_member_in_waiting_period_is_denied():
    p = fresh()
    r = pool.evaluate_request(p, "eli", 500, today=DEMO_DAY)
    assert r["decision"] == "denied"
    assert any(c["rule"] == "waiting_period" and not c["passed"] for c in r["checks"])


def test_one_payout_per_year():
    p = fresh()
    r = pool.evaluate_request(p, "sofia", 500, today=DEMO_DAY)
    assert r["decision"] == "denied"


def test_unknown_member_is_denied():
    r = pool.evaluate_request(fresh(), "nobody", 100, today=DEMO_DAY)
    assert r["decision"] == "denied"


def test_large_request_is_capped():
    p = fresh()
    r = pool.evaluate_request(p, "omar", 10000, today=DEMO_DAY)
    assert r["decision"] == "partial"
    assert r["approved"] == pool.max_payout(p) == 2880  # 30% of $9,600


def test_reserve_floor_protects_pool():
    p = fresh()
    p["balance"] = 3500
    assert pool.max_payout(p) == 500
    p["balance"] = 2000
    assert pool.max_payout(p) == 0
    assert pool.pool_health(p)["status"] == "low"


def test_api_flow_and_reset():
    app = FastAPI()
    app.include_router(pool.router)
    client = TestClient(app)

    before = client.post("/pool/reset").json()["health"]["balance"]
    r = client.post("/pool/request", json={
        "member_id": "maya", "amount": 2500, "uncovered_gap": 2500, "reason": "Oven replacement"})
    body = r.json()
    assert r.status_code == 200
    assert body["approved"] == 2500
    assert body["pool"]["health"]["balance"] == before - 2500
    assert body["pool"]["ledger"][0]["member"] == "Maya"

    # second request in the same year is denied
    assert client.post("/pool/request", json={
        "member_id": "maya", "amount": 100, "reason": "again"}).json()["decision"] == "denied"

    assert client.post("/pool/reset").json()["health"]["balance"] == before
    assert client.post("/pool/request", json={
        "member_id": "maya", "amount": -5, "reason": "x"}).status_code == 422
