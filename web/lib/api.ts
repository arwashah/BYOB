// One place where the screens talk to the FastAPI server.
//
// Set NEXT_PUBLIC_API_URL=http://localhost:8000 in web/.env.local and restart
// `npm run dev`. If the server is missing or unreachable, calls fall back to the
// stand-in answers in fake.ts so the demo never shows a blank page, and
// useOffline() turns true so the screens can say so.

import { useSyncExternalStore } from "react";
import type {
  ClaimPlan,
  ClaimPlanInput,
  ClaimResult,
  Forecast,
  Gap,
  Nudge,
  Pool,
  PoolRequestInput,
  PoolRequestResult,
  PoolWhatIf,
  Profile,
} from "./types";
import {
  fakeClaimPlan,
  fakeForecast,
  fakeGaps,
  fakeNudge,
  fakePool,
  fakePoolRequest,
  fakeProfile,
  fakeWhatIf,
} from "./fake";
import {
  toClaimPlan,
  toNudge,
  toPool,
  toPoolRequest,
  toWhatIf,
  type RawClaimPlan,
  type RawNudge,
  type RawPool,
  type RawPoolRequest,
  type RawWhatIf,
} from "./adapters";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ---- stand-in flag: true while any endpoint on this screen answered with fake data ----
// Tracked per endpoint, so a later call that works can't hide one that didn't.
const standIn = new Set<string>();
let offline = false;
const listeners = new Set<() => void>();
function mark(path: string, usedFake: boolean) {
  const key = path.split("?")[0];
  if (usedFake) standIn.add(key);
  else standIn.delete(key);
  const next = standIn.size > 0;
  if (offline === next) return;
  offline = next;
  listeners.forEach((l) => l());
}
// Called on every page change: the new screen starts with a clean slate.
export function clearOffline() {
  standIn.clear();
  if (!offline) return;
  offline = false;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useOffline = () => useSyncExternalStore(subscribe, () => offline, () => false);

const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

// Aborted calls reject with AbortError so callers can ignore stale answers.
async function call<R, T>(path: string, init: RequestInit, map: (raw: R) => T, fallback: () => T): Promise<T> {
  if (!API_URL) {
    mark(path, true);
    return fallback();
  }
  try {
    const res = await fetch(`${API_URL}${path}`, init);
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    const out = map((await res.json()) as R);
    mark(path, false);
    return out;
  } catch (err) {
    if (isAbort(err)) throw err;
    console.warn(`API ${path} failed, using stand-in data:`, err);
    mark(path, true);
    return fallback();
  }
}

const same = <T,>(raw: T) => raw;

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

export const api = {
  profile: (description: string, language = "English") =>
    call<Profile, Profile>("/profile", post({ description, language }), same, () => fakeProfile(description)),

  gaps: (profile: Profile) => call<Gap[], Gap[]>("/gaps", post(profile), same, () => fakeGaps(profile)),

  forecast: (profile: Profile) =>
    call<Forecast, Forecast>("/forecast", post(profile), same, () => fakeForecast(profile)),

  // No stand-in here: a made-up payout would be a wrong money number. If the
  // policy can't be read, this throws and the Claim page asks the user to retry.
  claim: async (profile: Profile, item: string, repairCost: number, policy: File): Promise<ClaimResult> => {
    if (!API_URL) throw new Error("No server configured (NEXT_PUBLIC_API_URL)");
    const form = new FormData();
    form.append("policy", policy);
    form.append("profile", JSON.stringify(profile));
    form.append("item", item);
    form.append("repair_cost", String(repairCost));
    form.append("language", profile.language ?? "English");
    const res = await fetch(`${API_URL}/claim`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`/claim returned ${res.status}`);
    return (await res.json()) as ClaimResult;
  },

  claimPlan: (input: ClaimPlanInput, signal?: AbortSignal) =>
    call<RawClaimPlan, ClaimPlan>(
      "/claim/plan",
      post(
        {
          has_insurance: input.insurance,
          repair_cost: input.repairCost,
          insurer_pays: input.insurerPays,
          fund_balance: input.fundBalance,
          equipment: input.equipment,
          weekly_expenses: input.weeklyExpenses,
        },
        signal,
      ),
      toClaimPlan,
      () => fakeClaimPlan(input),
    ),

  pool: () => call<RawPool, Pool>("/pool", { method: "GET" }, toPool, fakePool),

  poolRequest: (input: PoolRequestInput) =>
    call<RawPoolRequest, PoolRequestResult>(
      "/pool/request",
      post({
        amount: input.amount,
        months_in_group: input.monthsInGroup,
        uncovered_gap: input.uncoveredGap,
        name: input.name,
        trade: input.trade,
        reason: input.reason,
      }),
      toPoolRequest,
      () => fakePoolRequest(input.amount, input.monthsInGroup),
    ),

  poolWhatIf: (claims: number, signal?: AbortSignal) =>
    call<RawWhatIf, PoolWhatIf>(`/pool/whatif?claims=${claims}`, { method: "GET", signal }, toWhatIf, () =>
      fakeWhatIf(claims),
    ),

  poolReset: () => call<RawPool, Pool>("/pool/reset", { method: "POST" }, toPool, fakePool),

  nudge: (daysWorked: number[], fundWeeksCovered: number, name?: string, signal?: AbortSignal) =>
    call<RawNudge, Nudge>(
      "/nudge",
      post(
        {
          name,
          fund_weeks_covered: fundWeeksCovered,
          work_log: daysWorked.map((d) => ({ days_worked: d })),
        },
        signal,
      ),
      toNudge,
      () => fakeNudge(daysWorked, fundWeeksCovered, name),
    ),
};
