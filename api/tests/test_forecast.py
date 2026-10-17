import json
from pathlib import Path

from forecast import compute_forecast, income_from_csv


MAYA = json.loads((Path(__file__).parent.parent / "data" / "maya.json").read_text())


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
    with_gift = compute_forecast(MAYA, biggest_gift=2000)["weeksCoveredAfter"]
    without = compute_forecast(MAYA, biggest_gift=0)["weeksCoveredAfter"]
    assert with_gift > without


def test_flat_income_has_no_lean_months():
    out = compute_forecast({"monthlyIncome": [4000] * 12, "equipment": []})
    assert out["leanMonths"] == []


def test_empty_profile_does_not_crash():
    out = compute_forecast({"monthlyIncome": [], "equipment": []})
    assert out["average"] == 0

def test_csv_matches_maya_income():
    text = (Path(__file__).parent.parent / "data" / "invoices.csv").read_text()
    assert income_from_csv(text) == MAYA["monthlyIncome"]