"""Person 3: the maths behind /forecast.

Pure Python (no AI, no network). Takes a Profile dict (camelCase, same as web/lib/types.ts)
and returns the Forecast dict the screens expect. Person 2's main.py just calls compute_forecast.


"""
import csv
import io
import statistics

TIME_OFF_RATE = 0.04      # same rate employers use for vacation pay
LEAN_BELOW = 0.85         # a month under 85% of average income is "lean"
MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]


def whole(x, fallback=0):
    try:
        return max(0, int(round(float(x))))
    except (TypeError, ValueError):
        return fallback


# ---------------------------------------------------------------- income

def income_from_csv(text: str) -> list:
    """Turn an uploaded invoices CSV into 12 monthly totals, oldest first.
    Accepts columns: date, amount  (any extra columns are ignored).
    Dates like 2026-03-14. Groups by calendar month and keeps the latest 12 months."""
    totals = {}
    for row in csv.DictReader(io.StringIO(text)):
        row = {k.strip().lower(): v for k, v in row.items() if k}
        date, amount = (row.get("date") or "").strip(), row.get("amount")
        try:
            val = float(str(amount).replace("$", "").replace(",", ""))
        except (TypeError, ValueError):
            continue
        if len(date) >= 7 and date[4] == "-":
            totals[date[:7]] = totals.get(date[:7], 0) + val
    months = sorted(totals)[-12:]
    values = [whole(totals[m]) for m in months]
    return ([0] * (12 - len(values))) + values  # pad the front if under 12 months


def income_from_rough(monthly: float) -> list:
    return [whole(monthly)] * 12


def clean_income(raw) -> list:
    income = [whole(v) for v in raw or []]
    if len(income) == 12:
        return income
    return [income[0] if income else 0] * 12


# ---------------------------------------------------------------- income forecast

def moving_average(values: list, window: int = 3) -> list:
    """Smoothed income line for the chart. First months use whatever is available."""
    out = []
    for i in range(len(values)):
        chunk = values[max(0, i - window + 1): i + 1]
        out.append(round(sum(chunk) / len(chunk)))
    return out


def income_stats(income: list) -> dict:
    average = round(sum(income) / 12)
    stdev = statistics.pstdev(income) if average else 0
    cv = round(stdev / average, 2) if average else 0   # 0 = steady, 0.4+ = very seasonal
    lean = [MONTHS[i] for i, v in enumerate(income) if v < average * LEAN_BELOW]
    return {"average": average, "stdev": round(stdev), "volatility": cv,
            "leanMonths": lean, "lowestMonth": min(income)}


# ---------------------------------------------------------------- equipment risk

def equipment_risk(e: dict) -> dict:
    """Score 0-100 from age, repairs and whether it's the only one.
    Same formula as web/lib/fake.ts so offline mode matches."""
    age, repairs = whole(e.get("ageYears")), whole(e.get("repairs"))
    only_one = bool(e.get("isOnlyOne", True))
    score = min(100, round(age / 10 * 50 + repairs * 15 + (20 if only_one else 0)))
    level = "high" if score >= 70 else "medium" if score >= 40 else "low"
    months = {"high": 24, "medium": 48, "low": 96}[level]   # save up for replacement in this long
    reason = ", ".join([
        f"{age} years old",
        f"{repairs} repair{'' if repairs == 1 else 's'}",
        "your only one" if only_one else "you have a backup",
    ])
    return {
        "name": e.get("name", "Equipment"),
        "score": score,
        "level": level,
        "reason": reason,
        "monthlySetAside": round(whole(e.get("replacementCost")) / months),
    }


# ---------------------------------------------------------------- the main function

def compute_forecast(p: dict, biggest_gift: int = 0) -> dict:
    """biggest_gift: the most the pool could give right now (main.py passes pool.max_payout)."""
    income = clean_income(p.get("monthlyIncome"))
    stats = income_stats(income)
    average = stats["average"]
    smooth = moving_average(income)
    months = [{"label": MONTHS[i], "income": v, "trend": smooth[i]} for i, v in enumerate(income)]

    equipment = sorted((equipment_risk(e) for e in p.get("equipment") or []),
                       key=lambda r: r["score"], reverse=True)

    time_off = round(average * TIME_OFF_RATE)
    weekly_income = average * 12 / 52 or 1
    repair_fund = sum(r["monthlySetAside"] for r in equipment if r["level"] != "low")
    time_off_weeks = round(time_off * 12 / weekly_income, 1)


    return {
        "months": months,
        "average": average,
        "leanMonths": stats["leanMonths"],
        "volatility": stats["volatility"],
        "timeOffMonthly": time_off,
        "repairFundMonthly": repair_fund,
        "totalMonthlySetAside": time_off + repair_fund,
        "equipment": equipment,
        "weeksCoveredBefore": 0,    # what they have today
        # a year of 4% savings plus the biggest gift the group can give right now
        "weeksCoveredAfter": round((time_off * 12 + biggest_gift) / weekly_income, 1),
        "timeOffWeeks": time_off_weeks,
    }