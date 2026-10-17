"""Mutual aid pool (Broodfonds-style) for Backstop.

Hackathon version: members and money are synthetic and live in memory, seeded
from data/pool.json. The support rules are real, so the demo can explain every
decision. This is mutual aid, not insurance: support is at the pool's
discretion and never guaranteed.

Endpoints (include with app.include_router(pool.router) in main.py):
  GET  /pool          pool balance, health, members, recent ledger
  POST /pool/request  ask the pool for support; approved amounts are paid out
  POST /pool/reset    reload the seed data (demo only)
"""
import copy
import json
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

SEED_FILE = Path(__file__).parent / "data" / "pool.json"

# Rules, in dollars. Shown to users so every decision is explainable.
WAITING_PERIOD_DAYS = 90       # must be a member this long before asking
COOLDOWN_DAYS = 365            # at most one payout per member per year
HARD_CAP = 3000                # most any single request can receive
SHARE_CAP = 0.30               # or 30% of the current balance, if lower
RESERVE_FLOOR = 3000           # balance never drops below this after a payout


def load_seed() -> dict:
    with open(SEED_FILE, encoding="utf-8") as f:
        return json.load(f)


_lock = threading.Lock()
_pool = load_seed()


# ---------- pure logic (no FastAPI, easy to test) ----------

def find_member(pool: dict, member_id: str) -> Optional[dict]:
    return next((m for m in pool["members"] if m["id"] == member_id), None)


def max_payout(pool: dict) -> int:
    """Largest amount the pool can pay right now under its caps and reserve."""
    balance = pool["balance"]
    return max(0, min(HARD_CAP, int(balance * SHARE_CAP), balance - RESERVE_FLOOR))


def pool_health(pool: dict) -> dict:
    active = [m for m in pool["members"] if m["active"]]
    balance = pool["balance"]
    reserve_ratio = round(balance / HARD_CAP, 2)
    if reserve_ratio >= 2:
        status = "healthy"
    elif reserve_ratio >= 1:
        status = "watch"
    else:
        status = "low"
    return {
        "balance": balance,
        "members": len(active),
        "monthly_inflow": len(active) * pool["monthly_contribution"],
        "reserve_ratio": reserve_ratio,  # how many max-size requests the balance covers
        "max_payout_now": max_payout(pool),
        "status": status,
    }


def evaluate_request(pool: dict, member_id: str, amount: int,
                     uncovered_gap: Optional[int] = None,
                     today: Optional[date] = None) -> dict:
    """Decide how much of a request the pool can support, with a reason per rule."""
    today = today or date.today()
    checks = []

    def check(rule: str, passed: bool, detail: str):
        checks.append({"rule": rule, "passed": passed, "detail": detail})
        return passed

    member = find_member(pool, member_id)
    ok = check("member", member is not None and member["active"],
               "Active member of the pool" if member else f"No member '{member_id}'")

    if ok:
        joined = date.fromisoformat(member["joined"])
        days = (today - joined).days
        ok &= check("waiting_period", days >= WAITING_PERIOD_DAYS,
                    f"Member for {days} days (needs {WAITING_PERIOD_DAYS})")

        last = max((date.fromisoformat(e["date"]) for e in pool["ledger"]
                    if e["type"] == "payout" and e["member_id"] == member_id), default=None)
        recent = last is not None and today - last < timedelta(days=COOLDOWN_DAYS)
        ok &= check("one_per_year", not recent,
                    f"Last support on {last}" if last else "No support received in the last year")

    approved = 0
    if ok:
        requested = amount
        if uncovered_gap is not None:
            # Insurance pays first; the pool only fills what's left.
            check("insurance_first", True,
                  f"Pool covers only the uncovered gap of ${uncovered_gap:,}")
            requested = min(requested, uncovered_gap)
        limit = max_payout(pool)
        approved = min(requested, limit)
        check("pool_limits", approved == requested,
              f"Pool can give up to ${limit:,} now (cap ${HARD_CAP:,}, "
              f"{int(SHARE_CAP * 100)}% of balance, keeps ${RESERVE_FLOOR:,} in reserve)")

    if approved <= 0:
        decision = "denied"
    elif approved < amount:
        decision = "partial"
    else:
        decision = "approved"
    return {"decision": decision, "requested": amount, "approved": approved, "checks": checks}


def apply_payout(pool: dict, member_id: str, amount: int, note: str,
                 today: Optional[date] = None) -> dict:
    pool["balance"] -= amount
    entry = {"date": (today or date.today()).isoformat(), "type": "payout",
             "member_id": member_id, "amount": amount, "note": note}
    pool["ledger"].append(entry)
    return entry


def public_view(pool: dict) -> dict:
    """What the dashboard shows. Members see only first names and trades of others."""
    names = {m["id"]: m["first_name"] for m in pool["members"]}
    return {
        "name": pool["name"],
        "monthly_contribution": pool["monthly_contribution"],
        "health": pool_health(pool),
        "members": [{"id": m["id"], "first_name": m["first_name"], "trade": m["trade"]}
                    for m in pool["members"] if m["active"]],
        "ledger": [{**e, "member": names.get(e["member_id"])} for e in pool["ledger"][-10:]][::-1],
        "rules": {
            "waiting_period_days": WAITING_PERIOD_DAYS,
            "one_payout_per_days": COOLDOWN_DAYS,
            "max_per_request": HARD_CAP,
            "max_share_of_balance": SHARE_CAP,
            "reserve_floor": RESERVE_FLOOR,
        },
        "disclaimer": "Mutual aid, not insurance. Support is at the pool's discretion.",
    }


# ---------- API ----------

class SupportRequest(BaseModel):
    member_id: str
    amount: int = Field(gt=0, description="Dollars requested")
    reason: str = Field(min_length=1, max_length=200)
    uncovered_gap: Optional[int] = Field(None, ge=0, description="Cost left after insurance, from /claim")


router = APIRouter(prefix="/pool", tags=["pool"])


@router.get("")
def get_pool():
    with _lock:
        return public_view(_pool)


@router.post("/request")
def request_support(req: SupportRequest):
    with _lock:
        result = evaluate_request(_pool, req.member_id, req.amount, req.uncovered_gap)
        if result["approved"] > 0:
            apply_payout(_pool, req.member_id, result["approved"], req.reason)
        return {**result, "pool": public_view(_pool)}


@router.post("/reset")
def reset_pool():
    global _pool
    with _lock:
        try:
            _pool = load_seed()
        except (OSError, json.JSONDecodeError) as e:
            raise HTTPException(500, f"Could not load seed data: {e}")
        return public_view(_pool)
