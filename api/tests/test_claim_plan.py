from claim_plan import build_plan


def amounts(plan):
    return {s["step"]: s["amount"] for s in plan["steps"]}


def test_maya_insured_fund_then_pool():
    p = build_plan("yes", 6000, insurer_pays=3500, fund_balance=500, member_id="maya",
                   equipment="oven", weekly_expenses=1200)
    assert p["uncovered_gap"] == 2500
    assert amounts(p) == {"insurance": 3500, "fund": 500, "pool": 2000, "backup": 0}
    assert p["still_uncovered"] == 0
    assert all(c["passed"] for c in p["pool_checks"])
    assert p["weeks_covered"] == round((500 + 2880) / 1200, 1)


def test_no_insurance_skips_policy():
    p = build_plan("no", 6000, fund_balance=1000)
    assert p["insurer_pays"] == 0
    assert amounts(p)["fund"] == 1000
    assert amounts(p)["pool"] == 2880          # capped at 30% of the pool
    assert p["still_uncovered"] == 6000 - 1000 - 2880
    assert p["checklist"] == []


def test_not_sure_returns_checklist():
    p = build_plan("not_sure", 2000)
    assert p["checklist"]
    assert p["insurer_pays"] == 0


def test_fund_covers_everything_no_pool_step():
    p = build_plan("yes", 1000, insurer_pays=400, fund_balance=5000)
    assert "pool" not in amounts(p)
    assert amounts(p)["fund"] == 600


def test_new_member_gets_no_pool_gift():
    p = build_plan("no", 3000, member_id="eli")
    assert amounts(p)["pool"] == 0
    assert p["still_uncovered"] == 3000


def test_insurer_cannot_pay_more_than_cost():
    p = build_plan("yes", 1000, insurer_pays=5000)
    assert p["insurer_pays"] == 1000 and p["uncovered_gap"] == 0
