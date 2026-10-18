# 🌱 BYOB: Bring Your Own Benefits

**The benefits of an employer, even when you're the boss.**

BYOB is a safety net for self-employed Canadians. It finds what an employer would normally give you that you're missing, plans the savings to cover it, reads your own insurance policy when something breaks, and connects you with a small support group of solo workers.

Built at **Hack the Valley 11** (October 2026).

**Try it live: [byobservices.biz](https://byobservices.biz)**
AI server: [byob-api-b9cn.onrender.com](https://byob-api-b9cn.onrender.com) · [API docs](https://byob-api-b9cn.onrender.com/docs)
*(Free hosting: the first request after a quiet spell can take about 50 seconds while the server wakes up.)*

> ⚠️ BYOB informs, never sells. It is not financial, legal or insurance advice.

---

## The problem

When you go solo, you lose everything an employer quietly provides:

| An Ontario employee gets | A self-employed person gets |
|---|---|
| 2 weeks' vacation with 4% vacation pay | Nothing, unless they save it |
| 9 paid public holidays | Unpaid days |
| 3 job-protected sick days | Income stops the day they stop |
| EI for sickness and parental leave | Only if they opt in, and they must wait 12 months to claim |
| Employer pays half of CPP | They pay both halves |
| Often health and dental plans | Pay out of pocket |

One shock (getting sick, a new baby, a broken oven) can mean **zero income and a big bill at the same time.**

And it's not a niche: about **2.7 million Canadians are self-employed** (roughly 13% of workers), and about **700,000** did digital gig work in 2024 (Statistics Canada). A government evaluation found only about **1 in 4** self-employed people knew they could opt into EI (2010–2013 data).

---

## What it does

| Step | What happens |
|---|---|
| **1. Describe your business** | Type it like you'd tell a friend, in **any language**. AI builds your profile: income by season, equipment, insurance, life events. Or start from an example (Maya the baker, Dev the photographer, Priya the courier). |
| **Check it** | A "Does this look right?" screen shows what the AI understood (each piece of equipment, its age, repairs, replacement cost, whether it's your only one). **The AI proposes, you confirm** before anything is calculated. |
| **2. See your gaps** | What you're missing compared to an employee, most urgent first, each with *why*, concrete fixes, and the **official source** it's based on (canada.ca, ontario.ca, WSIB) with a "checked" date. |
| **3. Plan your savings** | A 4% time-off fund (like employer vacation pay), a repair fund based on how risky your equipment is, lean-month warnings, and how many weeks off you're covered, before and after BYOB. |
| **4. When something breaks** | Upload **your own** insurance policy. BYOB works out what's covered step by step, **quotes the exact clauses**, lists the documents you need, gives the deadline, and drafts the claim letter. Then a recovery plan: insurance → your repair fund → your group → a backup plan. Works with no insurance too, and **says "Not covered" when the policy doesn't cover it** (insurer pays $0, never a guessed number). |
| **5. Your support pool** *(optional)* | A small group of solo workers who pledge gifts to each other. **BYOB never holds money.** Gifts, not guarantees, with waiting periods, caps and a "what if 3 people claim at once" check. |
| **6. Burnout nudge** | Flags long stretches of 6-day weeks and shows how much time off your fund can cover. |

**Example:** Maya's 6-year-old deck oven breaks ($6,000). BYOB reads her policy and works out the insurer pays **$3,500** (70% age rule → capped at $4,000 → minus a $500 deductible), quoting each clause. Her repair fund covers $500 and her group pledges $2,000.

**And when the answer is no:** a photographer's broken cameras checked against that same oven policy come back **Not covered**: BYOB quotes the clause listing only the deck oven as insured, shows $0 from the insurer and $2,000 left to plan for, in French because the user wrote in French.

---

## How it works

```
┌──────────────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│  Screens (web/)      │ ───▶ │  AI server (api/main.py)     │ ───▶ │  Google Gemini  │
│  Next.js + Tailwind  │ ◀─── │  FastAPI                     │ ◀─── │  (structured    │
│  Vercel              │      │  Render                      │      │   outputs)      │
└─────────┬────────────┘      │  ├─ rules.md (checked facts) │      └─────────────────┘
          │                   │  ├─ forecast.py (maths)      │
          ▼                   │  └─ pool / nudge / claim plan│
┌──────────────────────┐      └──────────────────────────────┘
│  Supabase (optional) │
│  Login + saved plans │
└──────────────────────┘
```

**Design choices that build trust:**
- **Grounded AI.** Gemini may only use facts from [`api/rules.md`](api/rules.md), checked against official government pages. Every gap links to its source. The AI picks *which* source; the link comes from our code, so it can't invent one.
- **Fixed answer shapes.** Gemini fills a strict schema, so any user, any language and any insurer's wording come back in the same format.
- **AI for understanding, code for maths.** Savings, risk scores and the pool are plain, tested Python. Exact numbers never depend on the AI.
- **No made-up money numbers.** If the AI can't read a policy, the app says "try again" rather than guessing a payout. A "not covered" answer always pays $0, and the insurer amount can never exceed the repair cost.
- **The user stays in control.** Anything the AI understood is shown on a confirm screen and can be edited before it's used.
- **Built to survive a live demo.** Retries when Gemini is busy, automatic backup models, reconnects on dropped Wi-Fi, saved answers for instant repeats, and offline fallback screens.

---

## Tech stack

| Part | Built with |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| AI server | Python, FastAPI, Uvicorn, Pydantic |
| AI | Google Gemini API (`google-genai`): `gemini-3.8-flash` with backup models |
| Login + saved data | Supabase (Auth + Postgres with Row Level Security) |
| Hosting | Vercel (frontend), Render (server) |
| Tests | pytest |

---

## Run it locally

You need **Python 3.10+**, **Node.js 20+** and a free **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey) (use a personal Google account; school accounts may block it).

### 1. The AI server

```bash
cd api
pip install -r requirements.txt
```

Create `api/.env` (never commit it):

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.7-flash,gemini-3.5-flash,gemini-3.5-flash-lite
```

Run it:

```bash
python -m uvicorn main:app
```

Open **http://localhost:8000/docs** to try every endpoint.

### 2. The screens

```bash
cd web
npm install
```

Create `web/.env.local` (see `web/.env.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: login. Leave blank for guest-only.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Run it:

```bash
npm run dev
```

Open **http://localhost:3000** and click an example, or describe your own business.

> If the server isn't reachable, the screens fall back to offline demo data and show an "Offline demo data" label. The claim step never falls back: a made-up payout would be a wrong money number, so it asks you to retry instead.

### 4. Deploying

| Where | Setting | Value |
|---|---|---|
| **Render** (AI server, root `api`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`) | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | as in `api/.env` |
| | `FRONTEND_URL` | your site's addresses, comma-separated, no trailing `/` (e.g. `https://byobservices.biz,https://www.byobservices.biz`) |
| **Vercel** (screens, root directory `web`) | `NEXT_PUBLIC_API_URL` | `https://byob-api-b9cn.onrender.com` (no trailing `/`) |
| | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase (publishable key only, never the secret key) |
| **Supabase** | Authentication → URL Configuration | Site URL and redirect URLs = your live site |

`NEXT_PUBLIC_` values are built into the site, so **redeploy on Vercel after changing them**. As a safety net, the live site always uses the Render server if `NEXT_PUBLIC_API_URL` is missing or points at `localhost`.

### 3. Tests

```bash
cd api
pip install pytest
python -m pytest tests
```

---

## API

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/profile` | A description in any language → a structured profile (Gemini) |
| `POST` | `/gaps` | Profile → missing benefits with why, fixes and official source (Gemini, grounded in `rules.md`) |
| `POST` | `/forecast` | Profile → income, lean months, time-off and repair funds, weeks covered (pure maths) |
| `POST` | `/claim` | A policy PDF or photo + what broke → coverage, calculation, quoted clauses, claim letter (Gemini) |
| `POST` | `/claim/plan` | Recovery plan: insurance → fund → group → backup |
| `GET` | `/pool` | The support group's status and health |
| `POST` | `/pool/request` | Ask your group for a gift (checks waiting period, caps, reserve) |
| `GET` | `/pool/whatif` | Can the group survive several claims at once? |
| `POST` | `/pool/reset` | Reset the demo group to a clean slate |
| `POST` | `/nudge` | Burnout check from days worked |
| `GET` | `/health` | Server status |

Full request and response shapes: [`api/CONTRACT.md`](api/CONTRACT.md) and `web/lib/types.ts`.

---

## Project structure

```
api/
  main.py          AI server: profile, gaps, claim, languages, retries, cache, sources
  rules.md         The only facts the AI may use, with official sources
  forecast.py      Income, savings and equipment-risk maths
  pool.py          Support pool: pledges, gifts, safeguards
  nudge.py         Burnout check
  claim_plan.py    Recovery plan after something breaks
  data/            Example user (Maya), invoices, sample pool
  demo_assets/     Sample insurance policy for the demo
  tests/           pytest tests
web/
  app/             Pages: start, gaps, savings (forecast), claim, pool, login
  lib/             API client, types, examples, offline fallback, Supabase
  components/      Shared UI
```

---

## Privacy and safety

- **No account needed.** Guest mode works fully; login is optional.
- **Each user sees only their own saved data** (Supabase Row Level Security).
- **Insurance PDFs are not stored.** Only the profile and results are saved, when logged in.
- **API keys stay on the server** (`.env` / host environment variables), never in the browser.
- **The pool never moves or holds money.** Members pledge from their own savings.
- Example data is synthetic. Don't upload real personal documents on the free Gemini tier, as Google's free-tier terms allow content to be used to improve its products.

---

## What's next

- Real group invites and stored groups for the support pool
- Weekly automated checks of government pages, flagging changes for human review
- More provinces beyond Ontario
- Upload invoices to forecast from real income
- A paid AI tier so real users' documents stay private
- Leave unknown profile values blank instead of starting guesses
- Calendar reminders for EI registration, CPP at tax time and fund top-ups

---

## Team

| | Role |
|---|---|
| **Ameer** | Screens and design (Next.js) |
| **Zainab** | AI server, Gemini, deployment (FastAPI) |
| **Arwa** | Forecast maths, example data, tests |
| **Shakir** | Support pool, burnout nudge, claim plan, login |

---

## Sources

Rules are checked against official pages; see [`api/rules.md`](api/rules.md):
- [Ontario: Your guide to the Employment Standards Act](https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation)
- [Canada.ca: EI special benefits for self-employed people](https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/reports/self-employed-special-benefits.html)
- [Canada Revenue Agency: CPP for employees and self-employed workers](https://www.canada.ca/en/revenue-agency/services/tax/canada-pension-plan-cpp-employment-insurance-ei-rulings/cpp-ei-explained/employees-self-employed-workers-responsibilities-benefits-entitlements.html)
- [Canada.ca: Canadian Dental Care Plan](https://www.canada.ca/en/services/benefits/dental/dental-care-plan/qualify.html)
- [WSIB: Optional insurance](https://www.wsib.ca/en/businesses/registration-and-coverage/optional-insurance)
