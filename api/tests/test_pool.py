from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

import pool

DEMO_DAY = date(2026, 10, 17)


def fresh():
    return pool.load_seed()


def client():
    app = FastAPI()
    app.include_router(pool.router)
    c = TestClient(app)
    c.post("/pool/reset")
    return c


def test_maya_gets_the_gap_left_after_her_fund():
    r = pool.evaluate_request(fresh(), "you", 2000, uncovered_gap=2000, today=DEMO_DAY)
    assert r["decision"] == "approved"
    assert r["approved"] is True and r["amount"] == 2000
    assert "pledged $2,000" in r["message"]
    assert all(c["passed"] for c in r["checks"])


def test_group_never_pays_more_than_the_gap():
    r = pool.evaluate_request(fresh(), "you", 6000, uncovered_gap=1500, today=DEMO_DAY)
    assert r["amount"] == 1500
    assert r["decision"] == "partial"


def test_new_member_in_waiting_period_is_denied_with_reason():
    r = pool.evaluate_request(fresh(), "eli", 500, today=DEMO_DAY)
    assert r["decision"] == "denied" and r["approved"] is False
    assert r["message"].startswith("New members can ask for help after 3 months")
    assert any(c["rule"] == "waiting_period" and not c["passed"] for c in r["checks"])


def test_one_gift_per_year():
    r = pool.evaluate_request(fresh(), "sofia", 500, today=DEMO_DAY)
    assert r["decision"] == "denied"
    assert "once a year" in r["message"]


def test_unknown_member_is_denied():
    assert pool.evaluate_request(fresh(), "nobody", 100, today=DEMO_DAY)["decision"] == "denied"


def test_large_request_is_capped():
    p = fresh()
    r = pool.evaluate_request(p, "omar", 10000, today=DEMO_DAY)
    assert r["decision"] == "partial"
    assert r["amount"] == pool.max_payout(p) == pool.HARD_CAP


def test_reserve_floor_protects_pool():
    p = fresh()
    p["balance"] = 3500
    assert pool.max_payout(p) == 500
    assert pool.pool_health(p)["status"] == "watch"
    p["balance"] = 2000
    assert pool.max_payout(p) == 0
    assert pool.pool_health(p)["status"] == "low"
    r = pool.evaluate_request(p, "omar", 500, today=DEMO_DAY)
    assert "stretched" in r["message"]


def test_what_if_three_claims_at_once():
    r = pool.what_if(fresh(), 3, 2000)
    assert r["gifts"] == [2000, 2000, 1680]
    assert r["claims_fully_covered"] == 2
    assert r["per_member"] == round(5680 / 12)
    assert not r["survives"]
    assert r["balance_after"] >= pool.RESERVE_FLOOR
    assert r["message"].startswith("2 get the full $2,000 and 1 gets a smaller gift")

    eight = pool.what_if(fresh(), 8, 2000)
    assert (eight["claims_fully_covered"], eight["claims_reduced"], eight["claims_waiting"]) == (2, 2, 4)
    assert "4 wait for next month's pledges" in eight["message"]
    assert pool.what_if(fresh(), 1, 2000)["message"].startswith("Every one of the 1")


def test_full_gifts_left():
    assert pool.pool_health(fresh())["full_gifts_left"] == 2
    assert pool.full_gifts_left(3000) == 0


def test_joined_user_passes_wait_but_new_user_does_not():
    p = fresh()
    judge = pool.add_member(p, "Sam", "Courier", today=DEMO_DAY)
    newbie = pool.add_member(p, "Sam", "Courier", is_new=True, today=DEMO_DAY)
    assert judge["id"] == "sam" and newbie["id"] == "sam-2"
    assert pool.evaluate_request(p, "sam", 500, today=DEMO_DAY)["decision"] == "approved"
    assert pool.evaluate_request(p, "sam-2", 500, today=DEMO_DAY)["decision"] == "denied"


def test_current_user_months_drive_waiting_period():
    p = fresh()
    pool.upsert_current_user(p, months_in_group=1, today=DEMO_DAY)
    assert pool.evaluate_request(p, "you", 500, today=DEMO_DAY)["decision"] == "denied"
    pool.upsert_current_user(p, months_in_group=8, name="Maya", today=DEMO_DAY)
    assert pool.evaluate_request(p, "you", 500, today=DEMO_DAY)["decision"] == "approved"
    assert pool.find_member(p, "you")["first_name"] == "Maya"


def test_public_view_has_ui_fields():
    v = pool.public_view(fresh(), today=DEMO_DAY)
    assert v["pledge_per_member"] == 800
    assert v["max_gift_per_claim"] == 2000
    assert v["waiting_months"] == 3 and v["max_months"] == 3
    assert v["members"][1]["months_in_group"] > 12


def test_api_flow_matches_ui_contract():
    c = client()
    before = c.get("/pool").json()["health"]["balance"]

    # Person 1's body: no member id, just amount + months in group
    body = c.post("/pool/request", json={"amount": 2000, "months_in_group": 8,
                                         "uncovered_gap": 2000, "reason": "Oven replacement"}).json()
    assert body["approved"] is True and body["amount"] == 2000
    assert body["pool"]["health"]["balance"] == before - 2000
    assert body["pool"]["ledger"][0]["member"] == "You"
    assert body["pool"]["active_claims"] == 1
    assert any(m["is_you"] for m in body["pool"]["members"])

    # second request in the same year is denied, with a reason
    again = c.post("/pool/request", json={"amount": 100}).json()
    assert again["approved"] is False and "once a year" in again["message"]

    assert c.post("/pool/reset").json()["health"]["balance"] == before
    assert c.post("/pool/request", json={"amount": -5}).status_code == 422
    assert c.get("/pool/whatif?claims=2").json()["claims"] == 2
