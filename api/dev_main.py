"""Dev server for Person 4's endpoints, until Person 2's main.py is ready.

Run from api/:  uvicorn dev_main:app --reload
Docs:           http://localhost:8000/docs

Person 2: copy the CORS block and the include_router loop into main.py.
The /claim route here is a stand-in that returns the Maya fixture; delete it
once the real policy reader exists.
"""
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import claim_plan
import nudge
import pool

app = FastAPI(title="BYOB (dev)")

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])

for module in (pool, nudge, claim_plan):
    app.include_router(module.router)

CLAIM_FIXTURE = Path(__file__).parent / "demo_assets" / "maya_claim_result.json"


@app.post("/claim", tags=["dev stand-in"])
def claim_stand_in():
    """Returns the Maya result for any upload. Replace with Person 2's /claim."""
    return json.loads(CLAIM_FIXTURE.read_text(encoding="utf-8"))
