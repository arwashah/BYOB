"""Mutual aid pool (Broodfonds-style) for BYOB.

Hackathon version: members and money are synthetic and live in memory, seeded
from data/pool.json. `balance` is the total members have pledged from their own
savings; no real money moves. The support rules are real, so the demo can
explain every decision. This is mutual aid, not insurance: gifts are pledged by
members, capped, and never guaranteed.

Endpoints (include with app.include_router(pool.router) in main.py):
  GET  /pool          what the group has pledged, health, members, recent gifts
  POST /pool/join     add a named user to the group (demo)
  POST /pool/request  ask the group for a gift; approved amounts are recorded
  GET  /pool/whatif   can the group cope with several claims at once?
  POST /pool/reset    reload the seed data (demo only)
"""
import json
import re
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

SEED_FILE = Path(__file__).parent / "data" / "pool.json"

# Rules, in dollars. Shown to users so every decision is explainable.
WAITING_PERIOD_DAYS = 90       # must be a member this long before asking
COOLDOWN_DAYS = 365            # at most one gift per member per year
HARD_CAP = 2000                # most any single claim can receive
SHARE_CAP = 0.30               # or 30% of what's pledged, if lower
RESERVE_FLOOR = 3000           # pledges never drop below this after a gift
MAX_MONTHS = 3                 # longest a member can be supported for an illness
CURRENT_USER = "you"           # member id for whoever is using the app


def load_seed() -> dict:
    with open(SEED_FILE, encoding="utf-8") as f:
        return json.load(f)


_lock = threading.Lock()
_pool = load_seed()


# ---------- pure logic (no FastAPI, easy to test) ----------

def find_member(pool: dict, member_id: str) -> Optional[dict]:
    return next((m for m in pool["members"] if m["id"] == member_id), None)


def months_since(joined: str, today: date) -> int:
    return (today - date.fromisoformat(joined)).days // 30


def max_payout(pool: dict) -> int:
    """Largest gift the group can give right now under its caps and reserve."""
    balance = pool["balance"]
    return max(0, min(HARD_CAP, int(balance * SHARE_CAP), balance - RESERVE_FLOOR))


def full_gifts_left(balance: int, limit: int = 10) -> int:
    """How many more full-size gifts the pledges can cover, one after another."""
    count = 0
    while count < limit and max_payout({"balance": balance}) >= HARD_CAP:
        balance -= HARD_CAP
        count += 1
    return count


def pool_health(pool: dict) -> dict:
    active = [m for m in pool["members"] if m["active"]]
    balance = pool["balance"]
    reserve_ratio = round(balance / HARD_CAP, 2)
    can_give = max_payout(pool)
    # healthy: a full gift is still possible; watch: only a reduced one; low: none
    if can_give >= HARD_CAP:
        status = "healthy"
    elif can_give > 0:
        status = "watch"
    else:
        status = "low"
    return {
        "balance": balance,
        "members": len(active),
        "monthly_inflow": len(active) * pool["monthly_contribution"],
        "reserve_ratio": reserve_ratio,  # how many max-size gifts the pledges cover
        "max_payout_now": can_give,
        "full_gifts_left": full_gifts_left(balance),
        "status": status,
    }


def evaluate_request(pool: dict, member_id: str, amount: int,
                     uncovered_gap: Optional[int] = None,
                     today: Optional[date] = None) -> dict:
    """Decide how much of a request the group can support, with a reason per rule."""
    today = today or date.today()
    checks = []
    denial = None

    def check(rule: str, passed: bool, detail: str, why_not: str = ""):
        nonlocal denial
        checks.append({"rule": rule, "passed": passed, "detail": detail})
        if not passed and denial is None:
            denial = why_not or detail
        return passed

    member = find_member(pool, member_id)
    ok = check("member", member is not None and member["active"],
               "Active member of the group" if member else "Not a member of this group",
               "You're not in this group yet.")

    if ok:
        days = (today - date.fromisoformat(member["joined"])).days
        months = days // 30
        ok &= check("waiting_period", days >= WAITING_PERIOD_DAYS,
                    f"In the group {months} month{'s' * (months != 1)} (needs {WAITING_PERIOD_DAYS // 30})",
                    f"New members can ask for help after {WAITING_PERIOD_DAYS // 30} months. "
                    f"You've been in the group {months} month{'s' * (months != 1)}.")

        last = max((date.fromisoformat(e["date"]) for e in pool["ledger"]
                    if e["type"] == "payout" and e["member_id"] == member_id), default=None)
        recent = last is not None and today - last < timedelta(days=COOLDOWN_DAYS)
        ok &= check("one_per_year", not recent,
                    f"Last gift on {last}" if last else "No gift received in the last year",
                    f"You received a gift on {last}. Members can ask once a year.")

    amount_ok = 0
    if ok:
        requested = amount
        if uncovered_gap is not None:
            # Insurance and your own fund come first; the group only fills what's left.
            check("insurance_first", True, f"Group covers only the uncovered gap of ${uncovered_gap:,}")
            requested = min(requested, uncovered_gap)
        limit = max_payout(pool)
        amount_ok = min(requested, limit)
        check("pool_limits", amount_ok == requested,
              f"Group can gift up to ${limit:,} now (cap ${HARD_CAP:,}, "
              f"{int(SHARE_CAP * 100)}% of pledges, keeps ${RESERVE_FLOOR:,} in reserve)",
              "Your group's pledges are stretched right now. Try again after next month's pledges.")

    if amount_ok <= 0:
        decision = "denied"
        message = denial or "Your group can't help with this request."
    else:
        decision = "partial" if amount_ok < amount else "approved"
        message = (f"Your group has pledged ${amount_ok:,}. Members send it from their own savings. "
                   "It's a gift, not a guarantee.")
    return {"approved": amount_ok > 0, "amount": amount_ok, "message": message,
            "decision": decision, "requested": amount, "checks": checks}


def apply_payout(pool: dict, member_id: str, amount: int, note: str,
                 today: Optional[date] = None) -> dict:
    pool["balance"] -= amount
    entry = {"date": (today or date.today()).isoformat(), "type": "payout",
             "member_id": member_id, "amount": amount, "note": note}
    pool["ledger"].append(entry)
    return entry


def what_if(pool: dict, n_claims: int, amount: int = HARD_CAP) -> dict:
    """Stress test: n members each ask for `amount` at the same time."""
    sim_balance = pool["balance"]
    gifts = []
    for _ in range(n_claims):
        gift = min(amount, max_payout({"balance": sim_balance}))
        gifts.append(gift)
        sim_balance -= gift
    covered = sum(1 for g in gifts if g == amount)
    reduced = sum(1 for g in gifts if 0 < g < amount)
    waiting = n_claims - covered - reduced
    members = max(1, sum(1 for m in pool["members"] if m["active"]))

    if covered == n_claims:
        message = (f"Every one of the {n_claims} gets the full ${amount:,}, "
                   f"and the group still keeps ${sim_balance:,} pledged.")
    else:
        parts = [f"{covered} get{'s' * (covered == 1)} the full ${amount:,}"] if covered else []
        if reduced:
            parts.append(f"{reduced} get{'s' * (reduced == 1)} a smaller gift")
        if waiting:
            parts.append(f"{waiting} wait{'s' * (waiting == 1)} for next month's pledges")
        message = (", ".join(parts[:-1]) + " and " + parts[-1] if len(parts) > 1 else parts[0]) + \
                  f". The group never goes below ${RESERVE_FLOOR:,} pledged."
        message = message[0].upper() + message[1:]

    return {
        "claims": n_claims,
        "amount_each": amount,
        "gifts": gifts,
        "claims_fully_covered": covered,
        "claims_reduced": reduced,
        "claims_waiting": waiting,
        "total_gifted": sum(gifts),
        "per_member": round(sum(gifts) / members),
        "balance_after": sim_balance,
        "survives": covered == n_claims,
        "message": message,
    }


def add_member(pool: dict, name: str, trade: str, is_new: bool = False,
               today: Optional[date] = None) -> dict:
    """Add a named user. Existing-member joins backdate past the waiting period."""
    today = today or date.today()
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "member"
    member_id, n = base, 2
    while find_member(pool, member_id):
        member_id, n = f"{base}-{n}", n + 1
    joined = today if is_new else today - timedelta(days=WAITING_PERIOD_DAYS + 30)
    member = {"id": member_id, "first_name": name, "trade": trade,
              "joined": joined.isoformat(), "active": True}
    pool["members"].append(member)
    return member


def upsert_current_user(pool: dict, months_in_group: Optional[int] = None,
                        name: Optional[str] = None, trade: Optional[str] = None,
                        today: Optional[date] = None) -> dict:
    """The app has no logins: whoever is using it is member 'you'."""
    today = today or date.today()
    member = find_member(pool, CURRENT_USER)
    if member is None:
        member = {"id": CURRENT_USER, "first_name": "You", "trade": "Solo business",
                  "joined": (today - timedelta(days=365)).isoformat(), "active": True}
        pool["members"].append(member)
    if months_in_group is not None:
        member["joined"] = (today - timedelta(days=months_in_group * 30)).isoformat()
    if name:
        member["first_name"] = name
    if trade:
        member["trade"] = trade
    return member


def public_view(pool: dict, today: Optional[date] = None) -> dict:
    """What the dashboard shows. Members see only first names and trades of others."""
    today = today or date.today()
    active = [m for m in pool["members"] if m["active"]]
    names = {m["id"]: m["first_name"] for m in pool["members"]}
    recent_gifts = [e for e in pool["ledger"] if e["type"] == "payout"
                    and today - date.fromisoformat(e["date"]) < timedelta(days=30)]
    return {
        "name": pool["name"],
        "monthly_contribution": pool["monthly_contribution"],
        "pledge_per_member": pool["balance"] // max(1, len(active)),
        "max_gift_per_claim": HARD_CAP,
        "max_months": MAX_MONTHS,
        "waiting_months": WAITING_PERIOD_DAYS // 30,
        "active_claims": len(recent_gifts),
        "health": pool_health(pool),
        "members": [{"id": m["id"], "first_name": m["first_name"], "trade": m["trade"],
                     "months_in_group": months_since(m["joined"], today),
                     "is_you": m["id"] == CURRENT_USER} for m in active],
        "ledger": [{**e, "member": names.get(e["member_id"])} for e in pool["ledger"][-10:]][::-1],
        "rules": {
            "waiting_period_days": WAITING_PERIOD_DAYS,
            "one_payout_per_days": COOLDOWN_DAYS,
            "max_per_request": HARD_CAP,
            "max_share_of_balance": SHARE_CAP,
            "reserve_floor": RESERVE_FLOOR,
        },
        "disclaimer": ("Mutual aid, not insurance. BYOB never holds money: members keep their pledge "
                       "in their own savings and send a gift if someone needs it. Gifts, not guarantees."),
    }


# ---------- API ----------

class SupportRequest(BaseModel):
    amount: int = Field(gt=0, description="Dollars requested")
    member_id: Optional[str] = Field(None, description="Leave out for the current user")
    months_in_group: Optional[int] = Field(None, ge=0, le=600, description="Current user only (demo)")
    name: Optional[str] = Field(None, max_length=40)
    trade: Optional[str] = Field(None, max_length=40)
    reason: str = Field("Support request", min_length=1, max_length=200)
    uncovered_gap: Optional[int] = Field(None, ge=0, description="Cost left after insurance and own fund")


class JoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    trade: str = Field(min_length=1, max_length=40)
    is_new: bool = Field(False, description="True to demo the 3-month waiting period")


router = APIRouter(prefix="/pool", tags=["pool"])


@router.get("")
def get_pool():
    with _lock:
        return public_view(_pool)


@router.post("/join")
def join_pool(req: JoinRequest):
    with _lock:
        member = add_member(_pool, req.name.strip(), req.trade.strip(), req.is_new)
        return {"member": member, "pool": public_view(_pool)}


@router.get("/whatif")
def whatif(claims: int = Query(3, ge=1, le=10), amount: int = Query(HARD_CAP, gt=0, le=HARD_CAP)):
    with _lock:
        return what_if(_pool, claims, amount)


@router.post("/request")
def request_support(req: SupportRequest):
    with _lock:
        member_id = req.member_id
        if member_id is None:
            member_id = upsert_current_user(_pool, req.months_in_group, req.name, req.trade)["id"]
        result = evaluate_request(_pool, member_id, req.amount, req.uncovered_gap)
        if result["approved"]:
            apply_payout(_pool, member_id, result["amount"], req.reason)
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
