// Shapes shared by the screens and the Python server.
// Person 2/3/4: if you return something different from FastAPI, change it here
// and TypeScript will point at every screen that needs updating.

export type Insurance = "yes" | "no" | "not_sure";

export interface Equipment {
  name: string;
  ageYears: number;
  repairs: number;
  replacementCost: number;
  isOnlyOne: boolean;
}

export interface Profile {
  name: string;
  business: string;
  city: string;
  description: string;
  equipment: Equipment[];
  monthlyIncome: number[]; // 12 months, oldest first
  insurance: Insurance;
  hasHealthPlan: boolean;
  eiRegistered: boolean;
  lifeEvents: string[]; // e.g. "baby", "caregiving"
  language?: string; // AI answers are written in this; the claim letter stays English
  daysWorked?: number[]; // days worked in each of the last 4 weeks, oldest first
  repairFundSaved?: number; // already set aside for repairs
}

export type Severity = "high" | "medium" | "low";

export interface Gap {
  id: string;
  title: string;
  severity: Severity;
  why: string;
  fixes: string[];
  source?: string; // the rule from rules.md this is grounded in
  sourceName?: string; // e.g. "Canada.ca: EI special benefits for self-employed people"
  sourceUrl?: string | null;
  checkedOn?: string; // when the rule was last checked, e.g. "2026-10-17"
}

export interface EquipmentRisk {
  name: string;
  score: number; // 0-100
  level: Severity;
  reason: string;
  monthlySetAside: number;
}

export interface Forecast {
  months: { label: string; income: number; trend?: number }[];
  average: number;
  leanMonths: string[];
  timeOffMonthly: number; // 4% of income
  repairFundMonthly: number;
  equipment: EquipmentRisk[];
  weeksCoveredBefore: number;
  weeksCoveredAfter: number;
  // Optional: the real server (api/forecast.py) returns these, the offline fake data doesn't.
  timeOffWeeks?: number;
  volatility?: number;
  totalMonthlySetAside?: number;
}

export interface ClaimResult {
  status: "covered" | "partial" | "not_covered";
  summary: string;
  covered: string[];
  notCovered: string[];
  documents: string[];
  insurerPays: number;
  uncovered: number;
  draft: string;
  source?: string; // quoted clause from the policy
  sourceClauses?: { section: string; quote: string }[]; // every clause the answer relies on
  calculation?: { label: string; amount: number }[]; // how insurerPays was worked out
  deadline?: string;
}

export interface PoolMember {
  name: string;
  trade: string;
  monthsInGroup: number;
  isYou?: boolean;
}

export type PoolStatus = "healthy" | "watch" | "low";

export interface PoolHealth {
  pledged: number; // total members have pledged from their own savings
  maxGiftNow: number;
  fullGiftsLeft: number; // full-size gifts the pledges can still cover, one after another
  status: PoolStatus;
}

export interface Gift {
  date: string;
  member: string;
  amount: number;
  note: string;
}

export interface Pool {
  groupName: string;
  members: PoolMember[];
  pledgePerMember: number; // max gift a member pledges per claim
  maxGiftPerClaim: number;
  maxMonths: number;
  waitingMonths: number;
  activeClaims: number;
  health?: PoolHealth;
  gifts?: Gift[]; // newest first
  disclaimer?: string;
}

export interface PoolCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface PoolRequestResult {
  approved: boolean;
  amount: number;
  message: string;
  decision?: "approved" | "partial" | "denied";
  checks?: PoolCheck[]; // one per rule, so the screen can say why
  pool?: Pool; // the pool after this request
}

export interface PoolRequestInput {
  amount: number;
  monthsInGroup: number;
  uncoveredGap?: number;
  name?: string;
  trade?: string;
  reason?: string;
}

export interface PoolWhatIf {
  claims: number;
  gifts: number[];
  claimsFullyCovered: number;
  perMember: number;
  survives: boolean;
  message: string;
}

export interface PlanStep {
  step: "insurance" | "fund" | "pool" | "backup";
  title: string;
  amount: number;
  note: string;
}

export interface ClaimPlanInput {
  insurance: Insurance;
  repairCost: number;
  insurerPays?: number;
  fundBalance: number;
  equipment: string;
  weeklyExpenses?: number;
}

export interface ClaimPlan {
  branch: Insurance;
  repairCost: number;
  insurerPays: number;
  uncoveredGap: number;
  steps: PlanStep[];
  stillUncovered: number;
  checklist: string[]; // filled when the user isn't sure what their insurance covers
  weeksCovered: number | null;
}

export type NudgeSeverity = "none" | "heads_up" | "strong";

export interface Nudge {
  shouldTakeBreak: boolean;
  severity: NudgeSeverity;
  message: string;
  weeksOffCovered: number;
  reasons: string[];
  resources: { name: string; detail: string }[];
  disclaimer: string;
}