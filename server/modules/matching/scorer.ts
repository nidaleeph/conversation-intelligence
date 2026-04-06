interface MatchableSignal {
  id: string;
  type: string;
  location: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  createdAt: string;
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

// Area is treated as a prerequisite gate.
// Without area overlap, at most 40% of remaining weight applies (capped at 0.4).
// With area overlap, full score possible.
const WEIGHTS = {
  budget: 0.30,
  bedrooms: 0.25,
  propertyType: 0.20,
  recency: 0.10,
};

// Maximum non-area score = 0.30 + 0.25 + 0.20 + 0.10 = 0.85
// Area multiplier: with overlap → 1.0 applied to full score + area bonus
// Without overlap → score capped at 0.4 (below the 0.5 gate)

export function scoreMatch(
  demand: MatchableSignal,
  supply: MatchableSignal
): ScoreResult {
  const reasons: string[] = [];

  // --- Area overlap (gate) ---
  const demandAreas = new Set(demand.location.map((l) => l.toLowerCase()));
  const supplyAreas = new Set(supply.location.map((l) => l.toLowerCase()));
  let areaOverlap = 0;
  for (const area of Array.from(supplyAreas)) {
    if (demandAreas.has(area)) areaOverlap++;
  }
  const hasAreaOverlap = areaOverlap > 0;
  const overlapRatio = hasAreaOverlap
    ? areaOverlap / Math.max(supplyAreas.size, 1)
    : 0;
  if (hasAreaOverlap) reasons.push("area overlap");

  // --- Budget fit ---
  let budgetScore = 0;
  if (demand.budgetMax && supply.budgetMax) {
    const tolerance = demand.budgetMax * 0.15;
    if (supply.budgetMax <= demand.budgetMax + tolerance) {
      const ratio = Math.min(supply.budgetMax / demand.budgetMax, 1);
      budgetScore = WEIGHTS.budget * (ratio > 0.5 ? 1 : ratio * 2);
      reasons.push("budget fit");
    }
  } else if (!demand.budgetMax && !supply.budgetMax) {
    budgetScore = WEIGHTS.budget * 0.5;
  }

  // --- Bedrooms ---
  let bedroomScore = 0;
  if (demand.bedrooms !== null && supply.bedrooms !== null) {
    const diff = Math.abs(demand.bedrooms - supply.bedrooms);
    if (diff === 0) {
      bedroomScore = WEIGHTS.bedrooms;
      reasons.push("bedroom match");
    } else if (diff === 1) {
      bedroomScore = WEIGHTS.bedrooms * 0.7;
      reasons.push("bedroom match");
    }
  } else if (demand.bedrooms === null && supply.bedrooms === null) {
    bedroomScore = WEIGHTS.bedrooms * 0.5;
  }

  // --- Property type ---
  let propertyTypeScore = 0;
  if (demand.propertyType && supply.propertyType) {
    if (demand.propertyType.toLowerCase() === supply.propertyType.toLowerCase()) {
      propertyTypeScore = WEIGHTS.propertyType;
      reasons.push("property type match");
    }
  } else if (!demand.propertyType || !supply.propertyType) {
    propertyTypeScore = WEIGHTS.propertyType * 0.5;
  }

  // --- Recency ---
  let recencyScore = 0;
  const now = Date.now();
  const demandAge = (now - new Date(demand.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const supplyAge = (now - new Date(supply.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const avgAge = (demandAge + supplyAge) / 2;
  if (avgAge <= 7) {
    recencyScore = WEIGHTS.recency;
    reasons.push("recent");
  } else if (avgAge <= 30) {
    recencyScore = WEIGHTS.recency * (1 - (avgAge - 7) / 23);
  }

  const subScore = budgetScore + bedroomScore + propertyTypeScore + recencyScore;

  let score: number;
  if (hasAreaOverlap) {
    // Area bonus: up to 0.15 based on overlap ratio
    const areaBonus = 0.15 * overlapRatio;
    score = subScore + areaBonus;
  } else {
    // No area: cap at 40% of the sub-score to stay below 0.5
    score = subScore * 0.4;
  }

  return { score: Math.round(score * 100) / 100, reasons };
}
