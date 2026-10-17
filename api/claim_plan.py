"""Recovery plan after something breaks: insurance -> own fund -> group -> backup.

Works with or without insurance, so the app never depends on a policy:
  yes       uses insurer_pays from /claim (the policy reader)
  no        skips the policy reader
  not_sure  adds a checklist of what to look for, and plans as if uninsured

Endpoint (include with app.include_router(claim_plan.router) in main.py):
  POST /claim/plan
"""
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

import pool

NOT_SURE_CHECKLIST = [
    "Look for an 'equipment breakdown' section in any business policy you have.",
    "Home insurance often excludes equipment used for business; check the exclusions.",
    "Check for 'business interruption' cover, which replaces lost income during repairs.",
    "Note the deductible and any per-claim limit.",
    "Check whether older equipment is paid at a reduced (depreciated) rate.",
]


def build_plan(has_insurance: str, repair_cost: int, insurer_pays: Optional[int] = None,
               fund_balance: int = 0, member_id: Optional[str] = None,
               equipment: str = "equipment", weekly_expenses: Optional[int] = None) -> dict:
    steps = []
    insured = has_insurance == "yes"
    insurer = min(insurer_pays or 0, repair_cost) if insured else 0

    if insured:
        note = ("From your policy" if insurer_pays is not None
                else "Upload your policy to see how much it covers")
        steps.append({"step": "insurance", "title": "Insurance claim", "amount": insurer, "note": note})
    elif has_insurance == "no":
        steps.append({"step": "insurance", "title": "No insurance", "amount": 0,
                      "note": "Worth comparing basic business coverage options. BYOB explains them and never sells."})
    else:
        steps.append({"step": "insurance", "title": "Check your existing policies", "amount": 0,
                      "note": "Until you know, this plan assumes nothing is covered."})

    gap = repair_cost - insurer
    from_fund = min(fund_balance, gap)
    steps.append({"step": "fund", "title": "Your repair fund", "amount": from_fund,
                  "note": f"From the ${fund_balance:,} you've set aside" if fund_balance else
                          "No repair fund yet. BYOB can set a monthly amount for next time."})

    remaining = gap - from_fund
    with pool._lock:
        if member_id:
            check = pool.evaluate_request(pool._pool, member_id, remaining, uncovered_gap=remaining)
            from_pool = check["approved"]
            pool_checks = check["checks"]
        else:
            from_pool = min(remaining, pool.max_payout(pool._pool))
            pool_checks = []
        max_gift = pool.max_payout(pool._pool)
    if remaining > 0:
        steps.append({"step": "pool", "title": "Ask your group for a gift", "amount": from_pool,
                      "note": "Pledged by your group, not guaranteed. Request it on the pool page."})

    still_uncovered = remaining - from_pool
    steps.append({"step": "backup", "title": "Keep working while it's fixed", "amount": 0,
                  "note": f"While your {equipment} is out, rent shared equipment or workspace "
                          "(e.g. a commercial kitchen) or ask a group member with spare capacity."})

    weeks_covered = None
    if weekly_expenses:
        weeks_covered = round((fund_balance + max_gift) / weekly_expenses, 1)

    return {
        "branch": has_insurance,
        "repair_cost": repair_cost,
        "insurer_pays": insurer,
        "uncovered_gap": gap,
        "steps": steps,
        "still_uncovered": still_uncovered,
        "pool_checks": pool_checks,
        "checklist": NOT_SURE_CHECKLIST if has_insurance == "not_sure" else [],
        "weeks_covered": weeks_covered,
    }


class PlanRequest(BaseModel):
    has_insurance: Literal["yes", "no", "not_sure"]
    repair_cost: int = Field(gt=0)
    insurer_pays: Optional[int] = Field(None, ge=0, description="From /claim, when insured")
    fund_balance: int = Field(0, ge=0, description="Repair fund saved so far, from /forecast")
    member_id: Optional[str] = Field(None, description="Pool member id, to preview the pool's rules")
    equipment: str = Field("equipment", max_length=40)
    weekly_expenses: Optional[int] = Field(None, gt=0, description="For the 'weeks covered' number")


router = APIRouter(prefix="/claim", tags=["claim"])


@router.post("/plan")
def claim_plan(req: PlanRequest):
    return build_plan(**req.model_dump())
