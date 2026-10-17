// Stand-in answers used until the FastAPI server is running (and as a backup if it
// goes down mid-demo). Everything is worked out from the user's own profile, so a
// baker, a photographer and a courier still get different results.

import type {
  ClaimResult,
  Equipment,
  EquipmentRisk,
  Forecast,
  Gap,
  Pool,
  PoolRequestResult,
  Profile,
} from "./types";
import { DEFAULT_EXAMPLE } from "./examples";

const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const TIME_OFF_RATE = 0.04;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export function fakeProfile(description: string): Profile {
  const text = description.toLowerCase();
  const yearly = text.match(/\$?\s?(\d{2,3})\s?k/);
  const monthly = yearly ? (Number(yearly[1]) * 1000) / 12 : 4000;

  const known: [RegExp, Equipment][] = [
    [/oven/, { name: "Oven", ageYears: 5, repairs: 1, replacementCost: 8000, isOnlyOne: true }],
    [/camera/, { name: "Camera", ageYears: 4, repairs: 0, replacementCost: 3500, isOnlyOne: true }],
    [/laptop|computer/, { name: "Laptop", ageYears: 3, repairs: 0, replacementCost: 2500, isOnlyOne: true }],
    [/car|van|truck/, { name: "Vehicle", ageYears: 7, repairs: 2, replacementCost: 15000, isOnlyOne: true }],
    [/bike/, { name: "Bike", ageYears: 3, repairs: 1, replacementCost: 2000, isOnlyOne: true }],
    [/sewing|machine/, { name: "Machine", ageYears: 5, repairs: 1, replacementCost: 3000, isOnlyOne: true }],
  ];
  const equipment = known.filter(([re]) => re.test(text)).map(([, e]) => e);

  return {
    name: "You",
    business: "Your business",
    city: "Ontario",
    description,
    equipment: equipment.length ? equipment : [{ name: "Main tool", ageYears: 3, repairs: 0, replacementCost: 2000, isOnlyOne: true }],
    monthlyIncome: Array(12).fill(Math.round(monthly)),
    insurance: /no (business )?insurance|don't have (business )?insurance/.test(text) ? "no" : "not_sure",
    hasHealthPlan: /dental|health plan|benefits/.test(text) && !/no (health|dental|benefits)|don't have/.test(text),
    eiRegistered: false,
    lifeEvents: /baby|pregnan|expecting/.test(text) ? ["baby"] : [],
  };
}

export function equipmentRisk(e: Equipment): EquipmentRisk {
  const score = Math.min(100, Math.round((e.ageYears / 10) * 50 + e.repairs * 15 + (e.isOnlyOne ? 20 : 0)));
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const months = level === "high" ? 24 : level === "medium" ? 48 : 96;
  const parts = [
    `${e.ageYears} years old`,
    `${e.repairs} repair${e.repairs === 1 ? "" : "s"}`,
    e.isOnlyOne ? "your only one" : "you have a backup",
  ];
  return {
    name: e.name,
    score,
    level,
    reason: parts.join(", "),
    monthlySetAside: Math.round(e.replacementCost / months),
  };
}

export function fakeForecast(p: Profile): Forecast {
  const income = p.monthlyIncome.length === 12 ? p.monthlyIncome : Array(12).fill(p.monthlyIncome[0] ?? 0);
  const average = Math.round(avg(income));
  const months = income.map((v, i) => ({ label: MONTHS[i], income: v }));
  const equipment = p.equipment.map(equipmentRisk).sort((a, b) => b.score - a.score);
  const timeOffMonthly = Math.round(average * TIME_OFF_RATE);
  const repairFundMonthly = sum(equipment.filter((e) => e.level !== "low").map((e) => e.monthlySetAside));
  const weeklyIncome = (average * 12) / 52;
  const pool = fakePool();

  return {
    months,
    average,
    leanMonths: months.filter((m) => m.income < average * 0.85).map((m) => m.label),
    timeOffMonthly,
    repairFundMonthly,
    equipment,
    weeksCoveredBefore: 0,
    // a year of 4% savings plus the most the pool could gift
    weeksCoveredAfter: Math.round(((timeOffMonthly * 12 + pool.maxGiftPerClaim) / weeklyIncome) * 10) / 10,
  };
}

export function fakeGaps(p: Profile): Gap[] {
  const f = fakeForecast(p);
  const gaps: Gap[] = [
    {
      id: "time-off",
      title: "No paid time off or sick income",
      severity: "high",
      why: "An Ontario employee gets 4% vacation pay, 9 paid holidays and 3 sick days. If you stop working, your income stops the same day.",
      fixes: [
        `Set aside 4% of each payment (about $${f.timeOffMonthly}/month) into a time-off fund`,
        "Join a mutual aid pool for longer illness",
        "Compare individual or association group disability coverage",
      ],
      source: "Ontario ESA: vacation pay is 4% of wages for under 5 years of service",
    },
  ];

  if (!p.eiRegistered) {
    const soon = p.lifeEvents.length > 0;
    gaps.push({
      id: "ei",
      title: soon ? "Register for EI now: a baby is on the way" : "Not registered for EI special benefits",
      severity: soon ? "high" : "medium",
      why: "Self-employed people can opt in to EI sickness, maternity, parental and caregiving benefits, but you generally have to register about 12 months before you claim.",
      fixes: ["Opt in to EI special benefits for self-employed people through Service Canada", "Check last year's earnings meet the minimum"],
      source: "Canada.ca: EI special benefits for self-employed people",
    });
  }

  for (const e of f.equipment.filter((x) => x.level === "high")) {
    gaps.push({
      id: `equipment-${e.name}`,
      title: `${e.name} failure risk`,
      severity: "high",
      why: `Your ${e.name.toLowerCase()} is ${e.reason}. If it breaks, you can't earn until it's fixed.`,
      fixes: [
        "Check your policy for equipment breakdown coverage (often a cheap add-on)",
        `Save about $${e.monthlySetAside}/month into a repair fund`,
        "Line up a backup, like a shared space or a pool member with spare capacity",
      ],
    });
  }

  if (p.insurance === "no") {
    gaps.push({
      id: "insurance",
      title: "No business insurance",
      severity: "high",
      why: "Home and car policies usually exclude business equipment and business use, so a breakdown or accident could be entirely on you.",
      fixes: ["Compare basic business coverage options (we explain, never sell)", "Your fund and the pool still back you up meanwhile"],
    });
  } else if (p.insurance === "not_sure") {
    gaps.push({
      id: "insurance",
      title: "Not sure what your insurance covers",
      severity: "medium",
      why: "Home insurance often excludes business equipment. Upload your policy on the Claim page and we'll read it for you.",
      fixes: ["Look for 'business use' and 'equipment breakdown' in your policy", "Upload it so BYOB can check"],
    });
  }

  if (!p.hasHealthPlan) {
    gaps.push({
      id: "health",
      title: "No health or dental plan",
      severity: "medium",
      why: "Employees usually get health and dental through work. You pay for every visit yourself.",
      fixes: ["Check Canadian Dental Care Plan eligibility", "Compare small-business group plans, e.g. through a chamber of commerce"],
      source: "Canada.ca: Canadian Dental Care Plan",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return gaps.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function fakeClaim(p: Profile, item: string, repairCost: number): ClaimResult {
  const deductible = 500;
  const insurerPays = Math.max(0, repairCost - deductible);
  const lostIncome = Math.round(avg(p.monthlyIncome) / 4); // about a week
  return {
    status: "partial",
    summary: `Your ${item.toLowerCase()} breakdown is covered for parts and labour after a $${deductible} deductible. Lost income while it's being fixed is not covered.`,
    covered: [`Repair or replacement of the ${item.toLowerCase()} (parts and labour)`, "Emergency service call-out fee"],
    notCovered: [`$${deductible} deductible`, `Lost income while closed (about $${lostIncome})`, "Damage from normal wear and tear"],
    documents: ["Repair invoice or quote", "Photo of the damaged equipment", "Proof of purchase or age", "Maintenance records"],
    insurerPays,
    uncovered: deductible + lostIncome,
    draft: `To the claims department,

I am writing to file a claim under my policy's Equipment Breakdown section for my ${item.toLowerCase()}, which stopped working on ${new Date().toLocaleDateString("en-CA")}.

The repair estimate is $${repairCost.toLocaleString()}. I have attached the repair quote, photos of the equipment, proof of purchase and maintenance records.

Please confirm receipt and let me know if anything else is needed.

Sincerely,
${p.name}
${p.business}, ${p.city}`,
    source: 'Section 4.2: "We will pay for direct physical loss to covered equipment caused by mechanical or electrical breakdown."',
  };
}

export function fakePool(): Pool {
  const trades = ["Baker", "Florist", "Caterer", "Barista", "Pastry chef", "Food truck", "Cake decorator", "Chocolatier"];
  const names = ["Sam", "Leila", "Jordan", "Ana", "Kwame", "Mei", "Omar", "Tess", "Raj", "Nora", "Luis", "Ivy", "Ben", "Zara", "Theo", "Hana", "Malik", "Rosa", "Eli", "Fatima", "Noah", "Gwen", "Yusuf", "Clara"];
  return {
    groupName: "Toronto Food Makers",
    members: names.map((name, i) => ({ name, trade: trades[i % trades.length], monthsInGroup: 3 + ((i * 7) % 30) })),
    pledgePerMember: 100,
    maxGiftPerClaim: 2000,
    maxMonths: 3,
    waitingMonths: 3,
    activeClaims: 1,
  };
}

export function fakePoolRequest(amount: number, monthsInGroup: number, pool = fakePool()): PoolRequestResult {
  if (monthsInGroup < pool.waitingMonths) {
    return { approved: false, amount: 0, message: `New members can ask for help after ${pool.waitingMonths} months. You've been in the group ${monthsInGroup}.` };
  }
  const capacity = pool.members.length * pool.pledgePerMember;
  const gift = Math.min(amount, pool.maxGiftPerClaim, capacity / (pool.activeClaims + 1));
  return {
    approved: true,
    amount: Math.round(gift),
    message: `Your group has pledged up to $${Math.round(gift).toLocaleString()}. Members send it from their own savings. It's a gift, not a guarantee.`,
  };
}

export { DEFAULT_EXAMPLE };
