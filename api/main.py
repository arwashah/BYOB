"""BYOB (Bring Your Own Benefits) - the main server (Person 2).

Run from api/:   python -m uvicorn main:app --reload
Test page:       http://localhost:8000/docs
Screens:         web/.env.local  ->  NEXT_PUBLIC_API_URL=http://localhost:8000

Endpoints and shapes match web/lib/types.ts (camelCase) and api/CONTRACT.md:
  POST /profile   {description}                 -> Profile    (Gemini)
  POST /gaps      Profile                       -> Gap[]      (Gemini, grounded in rules.md)
  POST /forecast  Profile                       -> Forecast   (plain maths)
  POST /claim     form: policy, profile, item, repair_cost -> ClaimResult (Gemini reads the PDF)
  + Person 4's routers: /pool, /pool/request, /pool/whatif, /pool/join, /pool/reset, /nudge, /claim/plan

If Gemini fails, the endpoint returns an error and the screens fall back to their
offline stand-in data, so the demo never shows a blank page.
"""
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import claim_plan
import nudge
import pool

HERE = Path(__file__).parent
load_dotenv(HERE / ".env")  # GEMINI_API_KEY (and optional GEMINI_MODEL)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
RULES = (HERE / "rules.md").read_text(encoding="utf-8")
TIME_OFF_RATE = 0.04  # same as employer vacation pay
MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]

app = FastAPI(title="BYOB API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Person 4's endpoints (pool, nudge, claim plan)
for module in (pool, nudge, claim_plan):
    app.include_router(module.router)


# ---------------------------------------------------------------- Gemini helper

_client = None


def gemini():
    """Create the Gemini client the first time it's needed, so /pool etc. work without a key."""
    global _client
    if _client is None:
        key = os.getenv("GEMINI_API_KEY")
        if not key or key.startswith("paste"):
            raise HTTPException(500, "GEMINI_API_KEY missing: put it in api/.env and restart the server")
        from google import genai
        _client = genai.Client(api_key=key)
    return _client


BUSY_SIGNS = ("503", "UNAVAILABLE", "overloaded", "high demand", "429", "RESOURCE_EXHAUSTED", "500", "INTERNAL")
# Wi-Fi drops / stale connections: reconnect and try again
NETWORK_SIGNS = ("10053", "10054", "10060", "aborted", "reset by peer", "forcibly closed", "timed out",
                 "timeout", "ConnectError", "RemoteProtocolError", "ReadError", "Connection", "EOF")


CACHE_DIR = HERE / "cache"  # saved Gemini answers (gitignored). Delete the folder to start fresh.


def cache_key(contents, file_bytes: bytes = b"") -> str:
    h = hashlib.sha256()
    h.update(MODEL.encode())
    for part in contents if isinstance(contents, list) else [contents]:
        if isinstance(part, str):
            h.update(part.encode("utf-8"))
    h.update(file_bytes)
    return h.hexdigest()[:32]


def ask(contents, schema, file_bytes: bytes = b""):
    """Send a prompt (and optionally a file) to Gemini; get JSON back in a fixed shape.

    The exact same question twice is answered instantly from api/cache (great for the
    live demo: run it once beforehand). Turn off with USE_CACHE=0 in .env.
    If Gemini is busy (503/429), wait and retry, then try the backup models in
    GEMINI_FALLBACK_MODELS (comma-separated, in api/.env) before giving up.
    """
    use_cache = os.getenv("USE_CACHE", "1") != "0"
    path = CACHE_DIR / f"{cache_key(contents, file_bytes)}.json"
    if use_cache and path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass  # broken cache file: ask Gemini again
    result = ask_gemini(contents, schema)
    if use_cache:
        try:
            CACHE_DIR.mkdir(exist_ok=True)
            (CACHE_DIR / ".gitignore").write_text("*\n")  # never upload saved answers
            path.write_text(json.dumps(result), encoding="utf-8")
        except OSError:
            pass
    return result


_backups = None
SKIP_WORDS = ("image", "tts", "live", "audio", "embed", "native", "vision", "exp", "preview", "thinking", "omni", "latest")


def backup_models() -> list:
    """Other Flash models this key can use, found automatically (newest first), so a busy
    model doesn't break the demo. GEMINI_FALLBACK_MODELS in .env overrides this."""
    global _backups
    configured = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "").split(",") if m.strip()]
    if configured:
        return configured
    if _backups is None:
        found = []
        try:
            for m in gemini().models.list():
                name = (m.name or "").replace("models/", "")
                actions = getattr(m, "supported_actions", None) or ["generateContent"]
                if ("flash" in name and name != MODEL and "generateContent" in actions
                        and not any(w in name for w in SKIP_WORDS)):
                    found.append(name)
        except Exception as err:
            print(f"Couldn't list backup models: {str(err)[:80]}")
        found.sort(reverse=True)  # newest version numbers first
        found.sort(key=lambda n: "lite" in n)  # full Flash before Flash-Lite (more accurate)
        _backups = found[:3]
        print(f"Backup models: {_backups or 'none found'}")
    return _backups


def ask_gemini(contents, schema):
    global _client
    from google.genai import types
    settings = dict(response_mime_type="application/json", response_schema=schema, temperature=0.2)
    # Less "thinking" = much faster answers. Set GEMINI_THINKING=medium in .env for more careful ones.
    thinking = os.getenv("GEMINI_THINKING", "low")
    try:
        fast_config = types.GenerateContentConfig(
            **settings, thinking_config=types.ThinkingConfig(thinking_level=thinking)
        )
    except Exception:  # older library without thinking levels
        fast_config = types.GenerateContentConfig(**settings)
    plain_config = types.GenerateContentConfig(**settings)

    last_err = None
    models = [MODEL]
    tried_backups = False
    while models:
        model = models.pop(0)
        config = fast_config
        waits = (0, 2, 5) if model == MODEL else (0, 3)
        attempt = 0
        while attempt < len(waits):
            if waits[attempt]:
                time.sleep(waits[attempt])
            attempt += 1
            try:
                response = gemini().models.generate_content(model=model, contents=contents, config=config)
                if model != MODEL:
                    print(f"Answered by backup model {model}")
                return json.loads(response.text)
            except HTTPException:
                raise
            except Exception as err:
                last_err = err
                text = str(err)
                if "thinking" in text.lower() and config is not plain_config:
                    config = plain_config  # this model doesn't take a thinking level: drop it
                    attempt -= 1  # doesn't count as a try
                    continue
                if any(sign.lower() in text.lower() for sign in NETWORK_SIGNS):
                    _client = None  # throw away the broken connection, make a fresh one
                    print(f"Connection to Gemini dropped, reconnecting... ({text[:80]})")
                    continue
                if "404" in text or "NOT_FOUND" in text:
                    print(f"Model {model} not available, skipping")
                    break
                if not any(sign in text for sign in BUSY_SIGNS):
                    # not a "busy" error (bad key, unreadable file...): retrying won't help
                    raise HTTPException(502, f"Gemini call failed ({model}): {err}")
                print(f"Gemini busy on {model}, retrying... ({text[:80]})")
        if not models and not tried_backups:
            tried_backups = True
            models = [m for m in backup_models() if m != MODEL]
            if models:
                print(f"{MODEL} is busy, switching to backup: {models[0]}")
    raise HTTPException(503, f"Gemini is busy right now, try again in a minute: {last_err}")


# ---------------------------------------------------------------- shapes for Gemini
# Plain fields only (no defaults), so Gemini always fills every one.

class AIEquipment(BaseModel):
    name: str
    ageYears: Optional[float]
    repairs: Optional[int]
    replacementCost: Optional[float]
    isOnlyOne: Optional[bool]


class AIProfile(BaseModel):
    name: Optional[str]
    business: str
    city: Optional[str]
    equipment: list[AIEquipment]
    yearlyIncome: Optional[float]
    monthlyIncome: list[float]  # 12 numbers Nov..Oct only if they gave month-by-month amounts
    busyMonths: list[str]  # e.g. ["May", "Jun", ...] if they said when they're busy
    slowMonths: list[str]
    insurance: str  # yes / no / not_sure
    hasHealthPlan: bool
    eiRegistered: bool
    lifeEvents: list[str]


class AIGap(BaseModel):
    id: str
    title: str
    severity: str  # high / medium / low
    why: str
    fixes: list[str]
    source: str


class AIClause(BaseModel):
    section: str
    quote: str


class AIStep(BaseModel):
    label: str
    amount: float


class AIClaim(BaseModel):
    status: str  # covered / partial / not_covered
    summary: str
    covered: list[str]
    notCovered: list[str]
    documents: list[str]
    insurerPays: float
    draft: str
    sourceClauses: list[AIClause]
    calculation: list[AIStep]
    deadline: Optional[str]


# ---------------------------------------------------------------- small helpers

def pick(value, allowed, fallback):
    value = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return value if value in allowed else fallback


def money(x, fallback=0):
    try:
        return max(0, int(round(float(x))))
    except (TypeError, ValueError):
        return fallback


def seasonal_income(yearly: int, busy: list, slow: list) -> list:
    """Spread a yearly income over Nov..Oct: busy months weigh 1.5, slow 0.5, others 1.
    The 12 months always add up to the yearly amount."""
    busy = {str(m)[:3].title() for m in busy}
    slow = {str(m)[:3].title() for m in slow} - busy
    if busy and not slow:  # "busy May to Oct" means the other months are slow
        slow = set(MONTHS) - busy
    weights = [1.5 if m in busy else 0.5 if m in slow else 1.0 for m in MONTHS]
    total = sum(weights)
    return [round(yearly * w / total) for w in weights]


# ---------------------------------------------------------------- /profile

class ProfileIn(BaseModel):
    description: str


@app.post("/profile")
def profile(body: ProfileIn):
    """Any user's own description -> their Profile (web/lib/types.ts)."""
    prompt = (
        "A self-employed person in Canada described their business. Fill in their profile.\n"
        "Rules:\n"
        "- Use only what they said. Never invent numbers: use null when unknown.\n"
        "- equipment: every tool, machine or vehicle their income depends on. isOnlyOne is true "
        "unless they say they have a backup.\n"
        "- yearlyIncome: their yearly income if they gave one (convert monthly to yearly).\n"
        "- monthlyIncome: 12 amounts from November to October ONLY if they gave actual "
        "month-by-month numbers; otherwise an empty list.\n"
        "- busyMonths / slowMonths: three-letter month names (Jan, Feb, ...) they said are busy "
        "or slow. Expand ranges: 'May to October' = May, Jun, Jul, Aug, Sep, Oct. Empty if not said.\n"
        "- insurance: 'yes' if they have business insurance, 'no' if they don't (home or car "
        "insurance alone counts as no), 'not_sure' if unclear.\n"
        "- hasHealthPlan: true only if they say they have health or dental benefits.\n"
        "- eiRegistered: true only if they say they registered for EI.\n"
        "- lifeEvents: short words like 'baby', 'caregiving', 'surgery', 'moving' if mentioned.\n\n"
        f"Description: {body.description}"
    )
    ai = ask(prompt, AIProfile)

    months = [money(v) for v in ai.get("monthlyIncome") or []]
    if len(months) != 12:
        months = seasonal_income(
            money(ai.get("yearlyIncome"), 48000),
            ai.get("busyMonths") or [],
            ai.get("slowMonths") or [],
        )

    equipment = [
        {
            "name": (e.get("name") or "Main tool").strip().capitalize(),
            "ageYears": money(e.get("ageYears"), 3),
            "repairs": money(e.get("repairs"), 0),
            "replacementCost": money(e.get("replacementCost"), 2000),
            "isOnlyOne": e.get("isOnlyOne") is not False,
        }
        for e in ai.get("equipment") or []
    ] or [{"name": "Main tool", "ageYears": 3, "repairs": 0, "replacementCost": 2000, "isOnlyOne": True}]

    return {
        "name": ai.get("name") or "You",
        "business": ai.get("business") or "Your business",
        "city": ai.get("city") or "Ontario",
        "description": body.description,
        "equipment": equipment,
        "monthlyIncome": months,
        "insurance": pick(ai.get("insurance"), {"yes", "no", "not_sure"}, "not_sure"),
        "hasHealthPlan": bool(ai.get("hasHealthPlan")),
        "eiRegistered": bool(ai.get("eiRegistered")),
        "lifeEvents": ai.get("lifeEvents") or [],
        # daysWorked and repairFundSaved are left out on purpose: the user didn't say them,
        # and the screens let them fill those in.
    }


# ---------------------------------------------------------------- /forecast
# Plain maths, same rules as web/lib/fake.ts so the numbers match offline mode.
# Arwa: if you write a better version, replace compute_forecast and keep the output keys.

def equipment_risk(e: dict) -> dict:
    age, repairs = money(e.get("ageYears")), money(e.get("repairs"))
    only_one = e.get("isOnlyOne", True)
    score = min(100, round(age / 10 * 50 + repairs * 15 + (20 if only_one else 0)))
    level = "high" if score >= 70 else "medium" if score >= 40 else "low"
    months = {"high": 24, "medium": 48, "low": 96}[level]
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
        "monthlySetAside": round(money(e.get("replacementCost")) / months),
    }


def compute_forecast(p: dict) -> dict:
    income = [money(v) for v in p.get("monthlyIncome") or []]
    if len(income) != 12:
        income = [income[0] if income else 0] * 12
    average = round(sum(income) / 12)
    months = [{"label": MONTHS[i], "income": v} for i, v in enumerate(income)]
    equipment = sorted((equipment_risk(e) for e in p.get("equipment") or []),
                       key=lambda r: r["score"], reverse=True)
    time_off = round(average * TIME_OFF_RATE)
    weekly_income = average * 12 / 52 or 1
    with pool._lock:
        biggest_gift = pool.max_payout(pool._pool)
    return {
        "months": months,
        "average": average,
        "leanMonths": [m["label"] for m in months if m["income"] < average * 0.85],
        "timeOffMonthly": time_off,
        "repairFundMonthly": sum(r["monthlySetAside"] for r in equipment if r["level"] != "low"),
        "equipment": equipment,
        "weeksCoveredBefore": 0,
        # a year of 4% savings plus the biggest gift the group can give right now
        "weeksCoveredAfter": round((time_off * 12 + biggest_gift) / weekly_income, 1),
        "timeOffWeeks": round(time_off * 12 / weekly_income, 1),
    }


@app.post("/forecast")
def forecast(p: dict):
    return compute_forecast(p)


# ---------------------------------------------------------------- /gaps

@app.post("/gaps")
def gaps(p: dict):
    """Profile -> what an employer would cover that this person is missing, and why."""
    numbers = compute_forecast(p)
    person = {k: v for k, v in p.items() if k != "description"}
    prompt = (
        "You help self-employed Canadians find what an employer would normally give them that "
        "they are missing. Use ONLY the RULES below; never invent programs, amounts or eligibility.\n"
        "Return 3 to 6 gaps, most urgent first. For each:\n"
        "- id: short kebab-case id (e.g. 'time-off', 'ei', 'insurance', 'health', 'equipment-oven')\n"
        "- title: short, plain words\n"
        "- severity: 'high', 'medium' or 'low'\n"
        "- why: 1-2 sentences that mention THIS person's own details and numbers. Only use facts "
        "that appear in PERSON or NUMBERS; never assume how many days they work or what they've saved\n"
        "- fixes: 2-3 concrete actions, cheapest or most urgent first; use the dollar amounts in "
        "NUMBERS where they fit; never tell them to buy a specific product\n"
        "- source: the rule you used, short (e.g. 'Ontario ESA: 4% vacation pay')\n"
        "Always include time off / sick income. Flag EI as high if they are not registered and "
        "have a life event coming. Flag equipment rated 'high' in NUMBERS. Flag insurance if it is "
        "'no' or 'not_sure', and health/dental if hasHealthPlan is false.\n\n"
        f"RULES:\n{RULES}\n\nPERSON:\n{json.dumps(person)}\n\nNUMBERS:\n{json.dumps(numbers)}"
    )
    result = ask(prompt, list[AIGap])
    rank = {"high": 0, "medium": 1, "low": 2}
    out = []
    for i, g in enumerate(result):
        out.append({
            "id": g.get("id") or f"gap-{i}",
            "title": g.get("title", ""),
            "severity": pick(g.get("severity"), {"high", "medium", "low"}, "medium"),
            "why": g.get("why", ""),
            "fixes": g.get("fixes") or [],
            "source": g.get("source") or None,
        })
    return sorted(out, key=lambda g: rank[g["severity"]])


# ---------------------------------------------------------------- /claim

@app.post("/claim")
async def claim(
    policy: UploadFile = File(...),
    profile: str = Form("{}"),
    item: str = Form("equipment"),
    repair_cost: str = Form("0"),
):
    """The user's own policy (PDF or photo) + what broke -> ClaimResult (web/lib/types.ts)."""
    from google.genai import types

    try:
        person = json.loads(profile)
    except json.JSONDecodeError:
        person = {}
    cost = money(repair_cost)
    data = await policy.read()
    if not data:
        raise HTTPException(400, "The policy file is empty")
    mime = policy.content_type or "application/pdf"
    if mime == "application/octet-stream":
        mime = "application/pdf"
    file_part = types.Part.from_bytes(data=data, mime_type=mime)

    equipment = next((e for e in person.get("equipment", [])
                      if str(e.get("name", "")).lower() == item.lower()), None)
    prompt = (
        "Read this insurance policy carefully. The policyholder says their "
        f"'{item}' broke down. Repair or replacement cost: ${cost:,}. "
        f"Equipment details: {json.dumps(equipment)}. "
        f"Policyholder: {person.get('name', 'the policyholder')}, "
        f"{person.get('business', '')}, {person.get('city', '')}.\n\n"
        "Fill in every field using ONLY what the policy says:\n"
        "- status: 'covered', 'partial' or 'not_covered'\n"
        "- summary: 1-3 plain sentences a non-expert understands\n"
        "- covered / notCovered: short items (include lost income if the policy excludes it)\n"
        "- documents: what the insurer needs for this claim\n"
        "- calculation: the steps from the cost to what the insurer pays, in order "
        "(cost, any age or depreciation rule, any limit, minus the deductible). Do the arithmetic carefully.\n"
        "- insurerPays: the final amount from calculation (0 if not covered)\n"
        "- sourceClauses: the EXACT sentences from the policy you relied on, with their section names\n"
        "- deadline: when the insurer must be notified, or null if the policy doesn't say\n"
        "- draft: a short, polite claim letter the policyholder can send, using the policy's own "
        "names and numbers; leave [date] and [phone/email] as placeholders"
    )
    ai = ask([prompt, file_part], AIClaim, file_bytes=data)

    insurer_pays = min(money(ai.get("insurerPays")), cost) if cost else money(ai.get("insurerPays"))
    clauses = [c for c in ai.get("sourceClauses") or [] if c.get("quote")]
    first = clauses[0] if clauses else None
    return {
        "status": pick(ai.get("status"), {"covered", "partial", "not_covered"}, "partial"),
        "summary": ai.get("summary", ""),
        "covered": ai.get("covered") or [],
        "notCovered": ai.get("notCovered") or [],
        "documents": ai.get("documents") or [],
        "insurerPays": insurer_pays,
        "uncovered": max(0, cost - insurer_pays),
        "draft": ai.get("draft", ""),
        "source": f'{first["section"]}: "{first["quote"]}"' if first else None,
        "sourceClauses": clauses,
        "calculation": [
            {"label": s.get("label", ""), "amount": money(s.get("amount"))}
            for s in ai.get("calculation") or []
        ],
        "deadline": ai.get("deadline"),
    }


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "key_set": bool(os.getenv("GEMINI_API_KEY"))}