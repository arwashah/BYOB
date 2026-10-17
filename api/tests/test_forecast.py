from main import compute_forecast

# Maya exactly as typed in web/lib/examples.ts (months run Nov..Oct)
MAYA = {
    "monthlyIncome": [3900, 4100, 4600, 4900, 5200, 5600, 5800, 5400, 5000, 4800, 5600, 4800],
    "equipment": [
        {"name": "Deck oven", "ageYears": 6, "repairs": 2, "replacementCost": 6000, "isOnlyOne": True},
        {"name": "Stand mixer", "ageYears": 3, "repairs": 0, "replacementCost": 1200, "isOnlyOne": True},
        {"name": "Walk-in fridge", "ageYears": 4, "repairs": 1, "replacementCost": 5000, "isOnlyOne": True},
    ],
}


def test_maya_headline_numbers():
    out = compute_forecast(MAYA)
    assert out["average"] == 4975
    assert out["timeOffMonthly"] == 199
    assert out["repairFundMonthly"] == 354
    assert out["timeOffWeeks"] == 2.1
    assert out["leanMonths"] == ["Nov", "Dec"]


def test_oven_is_high_risk():
    oven = compute_forecast(MAYA)["equipment"][0]
    assert oven["name"] == "Deck oven"
    assert oven["level"] == "high"
    assert oven["monthlySetAside"] == 250


def test_low_risk_gear_is_left_out_of_repair_fund():
    out = compute_forecast(MAYA)
    mixer = next(e for e in out["equipment"] if e["name"] == "Stand mixer")
    assert mixer["level"] == "low"
    assert out["repairFundMonthly"] == 250 + 104


def test_pool_gift_adds_weeks():
    out = compute_forecast(MAYA)
    assert out["weeksCoveredAfter"] >= out["timeOffWeeks"]


def test_flat_income_has_no_lean_months():
    out = compute_forecast({"monthlyIncome": [4000] * 12, "equipment": []})
    assert out["leanMonths"] == []


def test_empty_profile_does_not_crash():
    out = compute_forecast({"monthlyIncome": [], "equipment": []})
    assert out["average"] == 0
