import type { Profile } from "./types";

// Only used by the "Use an example" buttons. Real users type their own business.

export const EXAMPLES: Record<string, Profile> = {
  maya: {
    name: "Maya",
    business: "Solo bakery",
    city: "Toronto",
    description:
      "I run a one-person bakery in Toronto. I make about $60k a year selling bread and cakes to cafes and at a weekend market. My deck oven is 6 years old and has been repaired twice, and it's the only one I have. I don't have health or dental benefits and I'm not sure if my insurance covers the oven.",
    equipment: [
      { name: "Deck oven", ageYears: 6, repairs: 2, replacementCost: 6000, isOnlyOne: true },
      { name: "Stand mixer", ageYears: 3, repairs: 0, replacementCost: 1200, isOnlyOne: true },
      { name: "Walk-in fridge", ageYears: 4, repairs: 1, replacementCost: 5000, isOnlyOne: true },
    ],
    monthlyIncome: [3900, 4100, 4600, 4900, 5200, 5600, 5800, 5400, 5000, 4800, 5600, 4800],
    insurance: "not_sure",
    hasHealthPlan: false,
    eiRegistered: false,
    lifeEvents: [],
    daysWorked: [6, 6, 6, 6],
    repairFundSaved: 500,
  },
  dev: {
    name: "Dev",
    business: "Freelance photographer",
    city: "Mississauga",
    description:
      "I'm a freelance wedding and event photographer in Mississauga. Income is very seasonal, around $48k a year, mostly May to October. I have two camera bodies, a lens kit and a laptop for editing. I have business insurance. My partner and I are expecting a baby next spring.",
    equipment: [
      { name: "Camera body", ageYears: 4, repairs: 1, replacementCost: 3500, isOnlyOne: false },
      { name: "Lens kit", ageYears: 5, repairs: 0, replacementCost: 6000, isOnlyOne: true },
      { name: "Editing laptop", ageYears: 3, repairs: 0, replacementCost: 2800, isOnlyOne: true },
    ],
    monthlyIncome: [1200, 1000, 1800, 3200, 5800, 7200, 6900, 7400, 6200, 4300, 1800, 1200],
    insurance: "yes",
    hasHealthPlan: false,
    eiRegistered: false,
    lifeEvents: ["baby"],
    daysWorked: [4, 5, 6, 6],
    repairFundSaved: 1200,
  },
  priya: {
    name: "Priya",
    business: "Delivery courier",
    city: "Scarborough",
    description:
      "I do food and parcel delivery in Scarborough with my own car, around $38k a year. The car is 9 years old and has needed three repairs this year. I don't have business insurance, just my regular car insurance. No benefits.",
    equipment: [
      { name: "Car", ageYears: 9, repairs: 3, replacementCost: 15000, isOnlyOne: true },
      { name: "Phone", ageYears: 2, repairs: 0, replacementCost: 900, isOnlyOne: true },
    ],
    monthlyIncome: [2900, 2700, 3000, 3100, 3200, 3300, 3400, 3200, 3100, 3200, 3300, 3600],
    insurance: "no",
    hasHealthPlan: false,
    eiRegistered: false,
    lifeEvents: [],
    daysWorked: [5, 5, 5, 5],
    repairFundSaved: 300,
  },
};

export const DEFAULT_EXAMPLE = EXAMPLES.maya;
