# API contract (Person 4 endpoints + what the screens expect from /claim)

All amounts are whole dollars (CAD). Live docs: `http://localhost:8000/docs`.
The server answers in snake_case; `web/lib/adapters.ts` maps it to the camelCase types in `web/lib/types.ts`.

## Running it

```
cd api && python -m uvicorn dev_main:app --reload      # needs: pip install fastapi uvicorn
cd web && npm run dev                                   # web/.env.local: NEXT_PUBLIC_API_URL=http://localhost:8000
```

`dev_main.py` has our three routers, CORS for `http://localhost:3000`, and a stand-in `/claim` that returns
`demo_assets/maya_claim_result.json`. **Person 2:** copy its CORS block and `include_router` loop into `main.py`,
then delete the stand-in. Pool state lives in memory: a server restart resets it to `data/pool.json`.

If the server is unreachable, the screens fall back to `web/lib/fake.ts` and show an "Offline demo data" chip.

---

## GET /pool
```json
{
  "name": "Toronto Solo Makers Circle",
  "monthly_contribution": 40,
  "pledge_per_member": 800, "max_gift_per_claim": 2000, "max_months": 3, "waiting_months": 3, "active_claims": 0,
  "health": {"balance": 9600, "members": 12, "monthly_inflow": 480, "reserve_ratio": 4.8,
             "max_payout_now": 2000, "status": "healthy"},
  "members": [{"id": "maya", "first_name": "Maya", "trade": "Baker", "months_in_group": 19, "is_you": false}],
  "ledger": [{"date": "2026-10-01", "type": "contribution", "member_id": null, "amount": 480, "note": "...", "member": null}],
  "rules": {"waiting_period_days": 90, "one_payout_per_days": 365, "max_per_request": 2000,
            "max_share_of_balance": 0.3, "reserve_floor": 3000},
  "disclaimer": "Mutual aid, not insurance. BYOB never holds money: ..."
}
```
- `health.balance` is what members have pledged in total (shown as "Left to pledge").
- `status`: `healthy` (a full $2,000 gift is possible), `watch` (only a reduced gift), `low` (none until next month's pledges).
- `ledger` is newest first, last 10 entries. `active_claims` = gifts in the last 30 days.

## POST /pool/request
The current user needs no id: leave out `member_id` and they become member `"you"`.
```json
// request (only amount is required)
{"amount": 2000, "months_in_group": 8, "uncovered_gap": 2000, "name": "Maya", "trade": "Solo bakery",
 "reason": "Uncovered repair cost"}
// response
{"approved": true, "amount": 2000,
 "message": "Your group has pledged $2,000. Members send it from their own savings. It's a gift, not a guarantee.",
 "decision": "approved", "requested": 2000,
 "checks": [{"rule": "waiting_period", "passed": true, "detail": "In the group 8 months (needs 3)"}],
 "pool": { "...updated GET /pool..." }}
```
- `decision`: `approved` | `partial` | `denied`. When denied, `message` is the plain-language reason
  (e.g. "New members can ask for help after 3 months. You've been in the group 1 month.").
- Rules in `checks`: `member`, `waiting_period`, `one_per_year`, `insurance_first`, `pool_limits`.
- Gift limit: the lowest of $2,000, 30% of pledges, or what keeps $3,000 pledged.

## GET /pool/whatif?claims=3&amount=2000
```json
{"claims": 3, "amount_each": 2000, "gifts": [2000, 2000, 1680], "claims_fully_covered": 2,
 "total_gifted": 5680, "per_member": 473, "balance_after": 3920, "survives": false,
 "message": "The group can fully support 2 of 3 claims at once and still keeps $3,920 pledged."}
```

## POST /pool/join
Adds a named member (any business). `is_new: true` makes them fail the waiting period.
`{"name": "Sam", "trade": "Courier", "is_new": false}` -> `{"member": {...}, "pool": {...}}`

## POST /pool/reset
Demo only. Reloads the seed data and returns `GET /pool`.

---

## POST /claim/plan
The recovery plan after something breaks, for insured, uninsured and "not sure" users. It previews the group
gift but doesn't record it; the user confirms on the pool page.
```json
// request
{"has_insurance": "yes", "repair_cost": 6000, "insurer_pays": 3500, "fund_balance": 500,
 "equipment": "deck oven", "weekly_expenses": 1131}
// response
{"branch": "yes", "repair_cost": 6000, "insurer_pays": 3500, "uncovered_gap": 2500,
 "steps": [
   {"step": "insurance", "title": "Insurance claim", "amount": 3500, "note": "From your policy"},
   {"step": "fund", "title": "Your repair fund", "amount": 500, "note": "From the $500 you've set aside"},
   {"step": "pool", "title": "Ask your group for a gift", "amount": 2000, "note": "Pledged by your group, not guaranteed. ..."},
   {"step": "backup", "title": "Keep working while it's fixed", "amount": 0, "note": "While your deck oven is out, ..."}],
 "still_uncovered": 0, "pool_checks": [], "checklist": [], "weeks_covered": 2.2}
```
- `has_insurance`: `yes` | `no` | `not_sure`. `not_sure` fills `checklist`. The `pool` step is left out when the fund covers the gap.
- `weeks_covered` = (fund_balance + biggest group gift now) / weekly_expenses; `null` without `weekly_expenses`.
- The screen uses `fund_balance` from the "Repair fund saved" field (prefilled from `profile.repairFundSaved`).

## POST /nudge
```json
// request (oldest week first)
{"name": "Maya", "fund_weeks_covered": 2.1, "work_log": [{"days_worked": 6}, {"days_worked": 6}, {"days_worked": 6}, {"days_worked": 6}]}
// response
{"should_take_break": true, "severity": "strong",
 "message": "Maya, you've worked 6-day weeks for 4 weeks straight and your fund covers 2.1 weeks off. Consider booking a week off.",
 "weeks_off_covered": 2.1, "reasons": ["4 weeks in a row with 6+ working days", "..."],
 "resources": [{"name": "211 Ontario", "detail": "..."}], "disclaimer": "Not medical advice. ..."}
```
`severity`: `none` | `heads_up` (2+ long weeks in a row, or a 4-week average above 5.5 days) | `strong` (4+ in a row).
The screen sends `profile.daysWorked` and works out fund weeks as a year of 4% time-off savings / weekly income.

---

## What the screens expect from /claim (Person 2)
`ClaimResult` in `web/lib/types.ts`, camelCase. `demo_assets/maya_claim_result.json` is a full example. Required:
`status` (`covered` | `partial` | `not_covered`), `summary`, `covered[]`, `notCovered[]`, `documents[]`,
`insurerPays`, `uncovered`, `draft`, `source`. Optional, shown when present:
- `sourceClauses: [{section, quote}]`: exact quotes from the PDF, so the screen shows where each answer came from.
- `calculation: [{label, amount}]`: how `insurerPays` was worked out (cost, age rule, cap, deductible).
- `deadline`: when the insurer must be notified.

## Asks for Person 3 (/forecast)
- The screens currently derive the time-off weeks and weekly income from `average` and `timeOffMonthly`.
  A `timeOffWeeks` field would be cleaner.
- `repairFundSaved` and `daysWorked` are new optional `Profile` fields (set in `web/lib/examples.ts`).
