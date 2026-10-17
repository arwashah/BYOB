# API (Person 2)

FastAPI server. Run with `uvicorn main:app --reload` from this folder.
The Gemini key goes in `api/.env` (gitignored, never commit it).

Endpoints the screens call (shapes in `web/lib/types.ts`):

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /profile | `{ description }` | `Profile` |
| POST | /gaps | `Profile` | `Gap[]` |
| POST | /forecast | `Profile` | `Forecast` |
| POST | /claim | form-data: `policy` (PDF), `profile` (JSON string), `item`, `repair_cost` | `ClaimResult` |
| GET | /pool | | `Pool` |
| POST | /pool/request | `{ amount, months_in_group }` | `PoolRequestResult` |

Add CORS for http://localhost:3000 so the browser can reach the server.
