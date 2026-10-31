// Advisory risk helper shared by the bounded investigation and the dashboard.
// The inputs are illustrative demonstration data derived from the transaction
// amount; the resulting score is advisory only and never decides a dispute.

import { calculateRisk, type RiskInputs, type Weights } from "./domain/risk";

export const EQUAL_WEIGHTS: Weights = { amount: 0.2, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };

export function riskInputsFor(amountMinor: number): RiskInputs {
  const amount = amountMinor / 100;
  return {
    zMax: 3,
    amount: { x: amount, xMax: 10000 },
    history: { history: [220, 240, 210, 255, 230, 245, 225, 235], current: amount },
    velocity: { mu: 2, sigma: 0.5, current: 2.2 },
    merchant: { chargebacks: 3, total: 40 },
    geography: { requiredVel: 50, vMax: 900 },
  };
}

// Advisory risk score in [0,1] for a transaction amount, or null if unavailable.
export function advisoryScore(amountMinor: number): number | null {
  return calculateRisk(riskInputsFor(amountMinor), EQUAL_WEIGHTS).score;
}

export type RiskBand = "low" | "medium" | "high";
export function riskBand(score: number): RiskBand {
  if (score < 0.34) return "low";
  if (score < 0.67) return "medium";
  return "high";
}
