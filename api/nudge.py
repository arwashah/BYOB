"""Burnout nudge for BYOB: "Should this user take a break?"

Deterministic rules on the user's recent work weeks, so every nudge can be
explained. Not medical advice.

Endpoint (include with app.include_router(nudge.router) in main.py):
  POST /nudge   work log + time-off fund -> nudge message and reasons
"""
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

LONG_WEEK_DAYS = 6        # a week with this many working days counts as long
STRONG_STREAK = 4         # 4+ long weeks in a row (about a month) -> strong nudge
HEADS_UP_STREAK = 2       # 2+ long weeks in a row -> heads-up
HEADS_UP_AVERAGE = 5.5    # or a 4-week average above this
TIME_OFF_RATE = 0.04      # set aside 4% of each payment, like employer vacation pay

# Free supports. Verify on canada.ca / ontario.ca before pitching.
RESOURCES = [
    {"name": "988 Suicide Crisis Helpline", "detail": "Call or text 988, 24/7, anywhere in Canada"},
    {"name": "211 Ontario", "detail": "Call 211 or visit 211ontario.ca to find local mental health services"},
]


def long_week_streak(days: list[int]) -> int:
    """Long weeks in a row, counting back from the most recent week."""
    streak = 0
    for d in reversed(days):
        if d < LONG_WEEK_DAYS:
            break
        streak += 1
    return streak


def weeks_label(weeks: float) -> str:
    return f"{weeks:g} week" + ("" if weeks == 1 else "s")


def evaluate_nudge(days: list[int], fund_weeks_covered: float = 0, name: Optional[str] = None) -> dict:
    recent = days[-4:]
    average = round(sum(recent) / len(recent), 1) if recent else 0
    streak = long_week_streak(days)

    reasons = []
    if streak >= HEADS_UP_STREAK:
        reasons.append(f"{streak} weeks in a row with {LONG_WEEK_DAYS}+ working days")
    if average > HEADS_UP_AVERAGE:
        reasons.append(f"Averaging {average} working days a week over the last {len(recent)} weeks")

    if streak >= STRONG_STREAK:
        severity = "strong"
    elif reasons:
        severity = "heads_up"
    else:
        severity = "none"

    weeks = round(max(fund_weeks_covered, 0), 1)
    if severity == "none":
        message = f"your workload looks sustainable. Your fund covers {weeks_label(weeks)} off when you need it."
    else:
        pace = (f"you've worked {LONG_WEEK_DAYS}-day weeks for {streak} weeks straight"
                if streak >= HEADS_UP_STREAK else f"you're averaging {average} days a week")
        if weeks > 0:
            ask = "Consider booking a week off." if severity == "strong" else "Try to protect a day off this week."
            message = f"{pace} and your fund covers {weeks_label(weeks)} off. {ask}"
        else:
            message = (f"{pace}, and you don't have a time-off fund yet. Setting aside "
                       f"{int(TIME_OFF_RATE * 100)}% of each payment builds about 2 paid weeks off a year.")
    message = f"{name}, {message}" if name else message[0].upper() + message[1:]

    return {
        "should_take_break": severity != "none",
        "severity": severity,
        "message": message,
        "weeks_off_covered": weeks,
        "reasons": reasons,
        "resources": RESOURCES if severity != "none" else [],
        "disclaimer": "Not medical advice. If you're struggling, reach out to the resources listed.",
    }


class WeekLog(BaseModel):
    week: Optional[str] = Field(None, description="Week start date, e.g. 2026-09-21")
    days_worked: int = Field(ge=0, le=7)


class NudgeRequest(BaseModel):
    work_log: list[WeekLog] = Field(max_length=104, description="Oldest week first")
    fund_weeks_covered: float = Field(0, ge=0, description="From /forecast: weeks off the time-off fund covers")
    name: Optional[str] = Field(None, max_length=40)


router = APIRouter(tags=["nudge"])


@router.post("/nudge")
def nudge(req: NudgeRequest):
    return evaluate_nudge([w.days_worked for w in req.work_log], req.fund_weeks_covered, req.name)
