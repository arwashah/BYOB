# API contract (Person 4 endpoints + what we need from /claim)

All amounts are whole dollars (CAD). Every endpoint has live docs at `http://localhost:8000/docs`.

## Setup for main.py (Person 2)

```python
from fastapi.middleware.cors import CORSMiddleware
import pool, nudge, claim_plan

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])
for module in (pool, nudge, claim_plan):
    app.include_router(module.router)
```

Pool state lives in memory: restarting the server (including `--reload`) resets it to `data/pool.json`.

---

## GET /pool
What the group has pledged, plus health, members, recent gifts and rules.
```json
{
  "name": "Toronto Solo Makers Circle",
  "monthly_contribution": 40,
  "health": {"balance": 9600, "members": 12, "monthly_inflow": 480,
             "reserve_ratio": 3.2, "max_payout_now": 2880, "status": "healthy"},
  "members": [{"id": "maya", "first_name": "Maya", "trade": "Baker"}],
  "ledger": [{"date": "2026-10-01", "type": "contribution", "member_id": null, "amount": 480,
              "note": "October contributions (12 members)", "member": null}],
  "rules": {"waiting_period_days": 90, "one_payout_per_days": 365, "max_per_request": 3000,
            "max_share_of_balance": 0.3, "reserve_floor": 3000},
  "disclaimer": "Mutual aid, not insurance. ..."
}
```
`status` is `healthy` | `watch` | `low`. `ledger` is newest first, last 10 entries.

## POST /pool/join
Adds the current user (any business). `is_new: true` makes them fail the 3-month wait, to demo that rule.
```json
// request
{"name": "Sam", "trade": "Courier", "is_new": false}
// response
{"member": {"id": "sam", "first_name": "Sam", "trade": "Courier", "joined": "2026-06-19", "active": true},
 "pool": { "...same as GET /pool..." }}
```
Use the returned `member.id` for `/pool/request` and `/claim/plan`.

## POST /pool/request
Ask the group for a gift. Approved amounts are recorded immediately.
```json
// request
{"member_id": "maya", "amount": 2000, "reason": "Oven replacement", "uncovered_gap": 2000}
// response
{"decision": "approved", "requested": 2000, "approved": 2000,
 "checks": [{"rule": "waiting_period", "passed": true, "detail": "Member for 595 days (needs 90)"}],
 "pool": { "...updated GET /pool..." }}
```
`decision` is `approved` | `partial` | `denied`. Show every `checks[].detail` on screen (that's the "why"). Rules: `member`, `waiting_period`, `one_per_year`, `insurance_first`, `pool_limits`.

## GET /pool/whatif?claims=3&amount=2000
"Can the group survive several claims at once?"
```json
{"claims": 3, "amount_each": 2000, "gifts": [2000, 2000, 1680], "claims_fully_covered": 2,
 "total_gifted": 5680, "balance_after": 3920, "survives": false,
 "message": "The group can fully support 2 of 3 simultaneous claims and still keeps $3,920 in reserve."}
```

## POST /pool/reset
Demo only. Reloads the seed data and returns `GET /pool`.

---

## POST /claim/plan
The recovery plan after something breaks, for insured, uninsured and "not sure" users. It previews the pool and doesn't record a gift; the user confirms on the pool page via `/pool/request`.
```json
// request
{"has_insurance": "yes", "repair_cost": 6000, "insurer_pays": 3500, "fund_balance": 500,
 "member_id": "maya", "equipment": "oven", "weekly_expenses": 1200}
// response
{"branch": "yes", "repair_cost": 6000, "insurer_pays": 3500, "uncovered_gap": 2500,
 "steps": [
   {"step": "insurance", "title": "Insurance claim", "amount": 3500, "note": "From your policy"},
   {"step": "fund", "title": "Your repair fund", "amount": 500, "note": "From the $500 you've set aside"},
   {"step": "pool", "title": "Ask your group for a gift", "amount": 2000, "note": "Pledged by your group, not guaranteed. ..."},
   {"step": "backup", "title": "Keep working while it's fixed", "amount": 0, "note": "While your oven is out, ..."}],
 "still_uncovered": 0, "pool_checks": [], "checklist": [], "weeks_covered": 2.8}
```
- `has_insurance`: `yes` | `no` | `not_sure`. For `no`/`not_sure` leave out `insurer_pays`. `not_sure` fills `checklist`.
- The `pool` step is omitted when the fund covers the whole gap.
- `weeks_covered` = (fund_balance + max gift the group can give now) / weekly_expenses, for the "before 0 weeks, after X weeks" beat. It's `null` without `weekly_expenses`.
- **Needs from Person 3 (/forecast):** `fund_balance` (repair fund saved) and `weekly_expenses`. Please confirm the field names.

## POST /nudge
"Should this user take a break?"
```json
// request (oldest week first)
{"name": "Maya", "fund_weeks_covered": 3,
 "work_log": [{"week": "2026-09-21", "days_worked": 6}, {"week": "2026-09-28", "days_worked": 6},
              {"week": "2026-10-05", "days_worked": 6}, {"week": "2026-10-12", "days_worked": 6}]}
// response
{"should_take_break": true, "severity": "strong",
 "message": "Maya, you've worked 6-day weeks for 4 weeks straight and your fund covers 3 weeks off. Consider booking a week off.",
 "weeks_off_covered": 3.0,
 "reasons": ["4 weeks in a row with 6+ working days", "Averaging 6.0 working days a week over the last 4 weeks"],
 "resources": [{"name": "988 Suicide Crisis Helpline", "detail": "Call or text 988, 24/7, anywhere in Canada"}],
 "disclaimer": "Not medical advice. ..."}
```
`severity` is `none` | `heads_up` (2+ long weeks in a row, or a 4-week average above 5.5 days) | `strong` (4+ long weeks in a row).
- **Needs:** `work_log` in the example user files (Person 3), and `fund_weeks_covered` from `/forecast`.

---

## Proposed /claim response (Person 2, please confirm)
The claim page is built against `demo_assets/maya_claim_result.json`, which uses this shape:
```json
{"status": "partial", "equipment": "Deck oven (Bakemaster DX-3)", "repair_cost": 6000,
 "insurer_pays": 3500, "uncovered_gap": 2500,
 "calculation": [{"label": "Age rule: oven is 6 years old, paid at 70%", "amount": 4200}],
 "covered_items": ["..."], "excluded_items": ["..."], "required_documents": ["..."],
 "deadline": "Notify the insurer in writing within 30 days of the breakdown",
 "source_clauses": [{"section": "2. Equipment Breakdown Coverage", "quote": "..."}],
 "claim_draft": "To: Maple Mutual ..."}
```
- `status`: `covered` | `partial` | `not_covered`.
- `source_clauses` are exact quotes from the PDF, so the UI can show where each answer came from.
- The claim page passes `insurer_pays` to `/claim/plan`, then the pool step's amount to `/pool/request` as both `amount` and `uncovered_gap`.
