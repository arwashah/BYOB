// One place where the screens talk to the FastAPI server.
//
// Saturday swap: put NEXT_PUBLIC_API_URL=http://localhost:8000 in web/.env.local
// and restart `npm run dev`. Until then (or if the server errors) every call
// falls back to the fake answers in fake.ts, so the demo never shows a blank page.

import type { ClaimResult, Forecast, Gap, Pool, PoolRequestResult, Profile } from "./types";
import { fakeClaim, fakeForecast, fakeGaps, fakePool, fakePoolRequest, fakeProfile } from "./fake";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function call<T>(path: string, init: RequestInit, fallback: () => T): Promise<T> {
  if (!API_URL) return fallback();
  try {
    const res = await fetch(`${API_URL}${path}`, init);
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`API ${path} failed, using fake data:`, err);
    return fallback();
  }
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  profile: (description: string) =>
    call<Profile>("/profile", post({ description }), () => fakeProfile(description)),

  gaps: (profile: Profile) => call<Gap[]>("/gaps", post(profile), () => fakeGaps(profile)),

  forecast: (profile: Profile) => call<Forecast>("/forecast", post(profile), () => fakeForecast(profile)),

  claim: (profile: Profile, item: string, repairCost: number, policy: File) => {
    const form = new FormData();
    form.append("policy", policy);
    form.append("profile", JSON.stringify(profile));
    form.append("item", item);
    form.append("repair_cost", String(repairCost));
    return call<ClaimResult>("/claim", { method: "POST", body: form }, () => fakeClaim(profile, item, repairCost));
  },

  pool: () => call<Pool>("/pool", { method: "GET" }, fakePool),

  poolRequest: (amount: number, monthsInGroup: number) =>
    call<PoolRequestResult>("/pool/request", post({ amount, months_in_group: monthsInGroup }), () =>
      fakePoolRequest(amount, monthsInGroup),
    ),
};
