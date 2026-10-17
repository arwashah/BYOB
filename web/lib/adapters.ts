// The Python server answers in snake_case; the screens use the camelCase types in
// types.ts. These functions are the only place that knows both shapes.

import type { ClaimPlan, Insurance, Nudge, Pool, PoolCheck, PoolRequestResult, PoolStatus, PoolWhatIf } from "./types";

export interface RawPool {
  name: string;
  pledge_per_member: number;
  max_gift_per_claim: number;
  max_months: number;
  waiting_months: number;
  active_claims: number;
  health: { balance: number; max_payout_now: number; full_gifts_left: number; status: PoolStatus };
  members: { first_name: string; trade: string; months_in_group: number; is_you: boolean }[];
  ledger: { date: string; type: "payout" | "contribution"; member: string | null; amount: number; note: string }[];
  disclaimer: string;
}

export interface RawPoolRequest {
  approved: boolean;
  amount: number;
  message: string;
  decision: "approved" | "partial" | "denied";
  checks: PoolCheck[];
  pool: RawPool;
}

export interface RawWhatIf {
  claims: number;
  gifts: number[];
  claims_fully_covered: number;
  per_member: number;
  survives: boolean;
  message: string;
}

export interface RawClaimPlan {
  branch: Insurance;
  repair_cost: number;
  insurer_pays: number;
  uncovered_gap: number;
  steps: ClaimPlan["steps"];
  still_uncovered: number;
  checklist: string[];
  weeks_covered: number | null;
}

export interface RawNudge {
  should_take_break: boolean;
  severity: Nudge["severity"];
  message: string;
  weeks_off_covered: number;
  reasons: string[];
  resources: Nudge["resources"];
  disclaimer: string;
}

export const toPool = (r: RawPool): Pool => ({
  groupName: r.name,
  members: r.members.map((m) => ({ name: m.first_name, trade: m.trade, monthsInGroup: m.months_in_group, isYou: m.is_you })),
  pledgePerMember: r.pledge_per_member,
  maxGiftPerClaim: r.max_gift_per_claim,
  maxMonths: r.max_months,
  waitingMonths: r.waiting_months,
  activeClaims: r.active_claims,
  health: {
    pledged: r.health.balance,
    maxGiftNow: r.health.max_payout_now,
    fullGiftsLeft: r.health.full_gifts_left,
    status: r.health.status,
  },
  gifts: r.ledger
    .filter((e) => e.type === "payout")
    .map((e) => ({ date: e.date, member: e.member ?? "A member", amount: e.amount, note: e.note })),
  disclaimer: r.disclaimer,
});

export const toPoolRequest = (r: RawPoolRequest): PoolRequestResult => ({
  approved: r.approved,
  amount: r.amount,
  message: r.message,
  decision: r.decision,
  checks: r.checks,
  pool: toPool(r.pool),
});

export const toWhatIf = (r: RawWhatIf): PoolWhatIf => ({
  claims: r.claims,
  gifts: r.gifts,
  claimsFullyCovered: r.claims_fully_covered,
  perMember: r.per_member,
  survives: r.survives,
  message: r.message,
});

export const toClaimPlan = (r: RawClaimPlan): ClaimPlan => ({
  branch: r.branch,
  repairCost: r.repair_cost,
  insurerPays: r.insurer_pays,
  uncoveredGap: r.uncovered_gap,
  steps: r.steps,
  stillUncovered: r.still_uncovered,
  checklist: r.checklist,
  weeksCovered: r.weeks_covered,
});

export const toNudge = (r: RawNudge): Nudge => ({
  shouldTakeBreak: r.should_take_break,
  severity: r.severity,
  message: r.message,
  weeksOffCovered: r.weeks_off_covered,
  reasons: r.reasons,
  resources: r.resources,
  disclaimer: r.disclaimer,
});
