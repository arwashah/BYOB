from nudge import evaluate_nudge


def test_sustainable_workload_no_nudge():
    r = evaluate_nudge([5, 5, 4, 5], fund_weeks_covered=2)
    assert r["severity"] == "none"
    assert not r["should_take_break"]
    assert r["resources"] == []


def test_month_of_six_day_weeks_is_strong():
    r = evaluate_nudge([5, 6, 6, 6, 6], fund_weeks_covered=3, name="Maya")
    assert r["severity"] == "strong"
    assert r["message"].startswith("Maya, you've worked 6-day weeks for 4 weeks straight")
    assert "3 weeks off" in r["message"]
    assert r["resources"]


def test_two_long_weeks_is_heads_up():
    r = evaluate_nudge([5, 5, 6, 7], fund_weeks_covered=1)
    assert r["severity"] == "heads_up"
    assert "1 week off" in r["message"]


def test_high_average_without_streak_is_heads_up():
    r = evaluate_nudge([7, 7, 7, 5])
    assert r["severity"] == "heads_up"
    assert r["message"].startswith("You're averaging 6.5 days a week")


def test_no_fund_suggests_starting_one():
    r = evaluate_nudge([6, 6, 6, 6], fund_weeks_covered=0)
    assert "don't have a time-off fund yet" in r["message"]


def test_empty_log():
    r = evaluate_nudge([])
    assert r["severity"] == "none"
