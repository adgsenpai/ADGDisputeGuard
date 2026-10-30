// Deterministic, explainable, advisory risk indicators.
// TypeScript port of engine/src/risk.rs. Every result is advisory only.

export const EARTH_RADIUS_KM = 6371.0;

export type Weights = {
  amount: number;
  velocity: number;
  merchant: number;
  history: number;
  geography: number;
};

export function weightsSum(w: Weights): number {
  return w.amount + w.velocity + w.merchant + w.history + w.geography;
}

export function weightsValid(w: Weights): boolean {
  const all = [w.amount, w.velocity, w.merchant, w.history, w.geography];
  const nonneg = all.every((x) => Number.isFinite(x) && x >= 0);
  return nonneg && Math.abs(weightsSum(w) - 1) < 1e-9;
}

// null means "unavailable / unknown" — never a silent zero.
export type Signals = {
  amount: number | null;
  velocity: number | null;
  merchant: number | null;
  history: number | null;
  geography: number | null;
};

export type RiskError =
  | { kind: "missing-signal"; name: string }
  | { kind: "signal-out-of-range"; name: string }
  | { kind: "invalid-weights" };

export function combinedScore(signals: Signals, weights: Weights): number | RiskError {
  if (!weightsValid(weights)) return { kind: "invalid-weights" };
  const pairs: [string, number | null, number][] = [
    ["amount", signals.amount, weights.amount],
    ["velocity", signals.velocity, weights.velocity],
    ["merchant", signals.merchant, weights.merchant],
    ["history", signals.history, weights.history],
    ["geography", signals.geography, weights.geography],
  ];
  let score = 0;
  for (const [name, value, weight] of pairs) {
    if (value === null) return { kind: "missing-signal", name };
    if (value < 0 || value > 1) return { kind: "signal-out-of-range", name };
    score += weight * value;
  }
  return score;
}

export function amountSignal(x: number, xMax: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(xMax) || x < 0 || xMax <= 0) return null;
  const denom = Math.log(1 + xMax);
  if (denom <= 0) return null;
  return Math.min(1, Math.log(1 + x) / denom);
}

export function meanStd(xs: number[]): [number, number] | null {
  const n = xs.length;
  if (n < 2) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return [mean, Math.sqrt(variance)];
}

export function zScore(history: number[], x: number): number | null {
  const ms = meanStd(history);
  if (ms === null) return null;
  const [mean, s] = ms;
  if (s <= 0) return null;
  return (x - mean) / s;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const v = [...xs].sort((a, b) => a - b);
  const n = v.length;
  return n % 2 === 1 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

export function robustZScore(history: number[], x: number): number | null {
  const m = median(history);
  if (m === null) return null;
  const mad = median(history.map((xi) => Math.abs(xi - m)));
  if (mad === null || mad <= 0) return null;
  return (0.6745 * (x - m)) / mad;
}

export function velocity(count: number, window: number): number | null {
  if (!Number.isFinite(window) || window <= 0) return null;
  return count / window;
}

export function velocityZScore(mu: number, sigma: number, current: number): number | null {
  if (![mu, sigma, current].every(Number.isFinite) || sigma <= 0) return null;
  return (current - mu) / sigma;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function requiredVelocity(distanceKm: number | null, elapsed: number): number | null {
  if (distanceKm === null) return null;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return null;
  return distanceKm / elapsed;
}

// --- Signal normalisation ---------------------------------------------------

export function zscoreToSignal(z: number, zMax: number): number | null {
  if (!Number.isFinite(z) || !Number.isFinite(zMax) || zMax <= 0) return null;
  return Math.min(1, Math.abs(z) / zMax);
}

export function historySignal(history: number[], x: number, zMax: number): number | null {
  const z = zScore(history, x);
  return z === null ? null : zscoreToSignal(z, zMax);
}

export function velocitySignal(mu: number, sigma: number, current: number, zMax: number): number | null {
  const z = velocityZScore(mu, sigma, current);
  return z === null ? null : zscoreToSignal(z, zMax);
}

export function geographySignal(requiredVel: number | null, vMax: number): number | null {
  if (requiredVel === null) return null;
  if (!Number.isFinite(vMax) || vMax <= 0 || !Number.isFinite(requiredVel) || requiredVel < 0) {
    return null;
  }
  return Math.min(1, requiredVel / vMax);
}

export function merchantSignal(chargebacks: number, total: number): number | null {
  if (total === 0 || chargebacks > total || chargebacks < 0) return null;
  return chargebacks / total;
}

// --- Integration ------------------------------------------------------------

export type RiskInputs = {
  zMax: number;
  amount?: { x: number; xMax: number };
  history?: { history: number[]; current: number };
  velocity?: { mu: number; sigma: number; current: number };
  merchant?: { chargebacks: number; total: number };
  geography?: { requiredVel: number | null; vMax: number };
};

export function assembleSignals(inputs: RiskInputs): Signals {
  return {
    amount: inputs.amount ? amountSignal(inputs.amount.x, inputs.amount.xMax) : null,
    velocity: inputs.velocity
      ? velocitySignal(inputs.velocity.mu, inputs.velocity.sigma, inputs.velocity.current, inputs.zMax)
      : null,
    merchant: inputs.merchant ? merchantSignal(inputs.merchant.chargebacks, inputs.merchant.total) : null,
    history: inputs.history ? historySignal(inputs.history.history, inputs.history.current, inputs.zMax) : null,
    geography: inputs.geography ? geographySignal(inputs.geography.requiredVel, inputs.geography.vMax) : null,
  };
}

export type RiskResult = {
  score: number | null;
  signals: Signals;
  explanation: string;
};

export function calculateRisk(inputs: RiskInputs, weights: Weights): RiskResult {
  const signals = assembleSignals(inputs);
  const result = combinedScore(signals, weights);
  if (typeof result === "number") {
    return { score: result, signals, explanation: "All required signals available." };
  }
  switch (result.kind) {
    case "missing-signal":
      return { score: null, signals, explanation: `One or more required inputs are unavailable: ${result.name}` };
    case "signal-out-of-range":
      return { score: null, signals, explanation: `A signal was outside [0,1]: ${result.name}` };
    case "invalid-weights":
      return { score: null, signals, explanation: "Configured weights are negative or do not sum to 1." };
  }
}
