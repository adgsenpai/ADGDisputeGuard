// Assemble a read-only case context from the store and run a bounded,
// Ollama-backed investigation. The model sees only this context; it never
// touches the database.

import type { DisputeStore } from "../domain/service";
import { calculateRisk, type RiskInputs, type Weights } from "../domain/risk";
import { investigate, type CaseContext, type InvestigationResult } from "../ollama/investigation";
import type { AsyncProposer, Budget } from "../domain/investigation";
import { OllamaClient } from "../ollama/client";
import { SEED_TRANSACTIONS } from "./store";

const EQUAL_WEIGHTS: Weights = { amount: 0.2, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };

// Illustrative risk inputs derived from the transaction amount. Values are
// demonstration data; the score is advisory only.
function riskInputsFor(amountMinor: number): RiskInputs {
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

export function buildCaseContext(store: DisputeStore, disputeId: number): CaseContext | null {
  const dispute = store.dispute(disputeId);
  if (!dispute) return null;
  const seed = SEED_TRANSACTIONS.find((t) => t.id === dispute.transactionId);
  const amountMinor = seed?.amountMinor ?? 0;
  const risk = calculateRisk(riskInputsFor(amountMinor), EQUAL_WEIGHTS);
  const evidenceEvents = store.eventsFor(disputeId).filter((e) => e.detail.kind !== "dispute-created");
  return {
    disputeId,
    state: dispute.state,
    get_transaction: seed
      ? { id: seed.id, merchant: seed.merchant, category: seed.category, amountMinor: seed.amountMinor, reason: seed.reason }
      : { id: dispute.transactionId },
    get_evidence_metadata: { events: evidenceEvents.length },
    get_risk_signals: { score: risk.score, signals: risk.signals, explanation: risk.explanation },
  };
}

export async function runInvestigation(
  store: DisputeStore,
  disputeId: number,
  options: { budget?: Budget; proposer?: AsyncProposer; client?: OllamaClient | null } = {},
): Promise<{ status: number; body: unknown }> {
  const context = buildCaseContext(store, disputeId);
  if (!context) return { status: 404, body: { error: "unknown-dispute" } };
  const result: InvestigationResult = await investigate(context, options);
  return {
    status: 200,
    body: {
      disputeId,
      usedModel: result.usedModel,
      summary: result.summary,
      stage: result.loop.stage,
      observations: result.loop.observations,
      toolCalls: result.loop.toolCalls,
      history: result.loop.history,
      context,
    },
  };
}
