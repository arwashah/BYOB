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
}

export type Severity = "high" | "medium" | "low";

export interface Gap {
  id: string;
  title: string;
  severity: Severity;
  why: string;
  fixes: string[];
  source?: string; // the rule from rules.md this is grounded in
}

export interface EquipmentRisk {
  name: string;
  score: number; // 0-100
  level: Severity;
  reason: string;
  monthlySetAside: number;
}

export interface Forecast {
  months: { label: string; income: number }[];
  average: number;
  leanMonths: string[];
  timeOffMonthly: number; // 4% of income
  repairFundMonthly: number;
  equipment: EquipmentRisk[];
  weeksCoveredBefore: number;
  weeksCoveredAfter: number;
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
}

export interface PoolMember {
  name: string;
  trade: string;
  monthsInGroup: number;
}

export interface Pool {
  groupName: string;
  members: PoolMember[];
  pledgePerMember: number; // max gift a member pledges per claim
  maxGiftPerClaim: number;
  maxMonths: number;
  waitingMonths: number;
  activeClaims: number;
}

export interface PoolRequestResult {
  approved: boolean;
  amount: number;
  message: string;
}
