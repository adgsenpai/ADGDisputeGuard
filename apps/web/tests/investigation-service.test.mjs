import test from "node:test";
import assert from "node:assert/strict";

import {
  investigate,
  deterministicProposer,
  makeOllamaProposer,
  DEFAULT_BUDGET,
} from "../lib/ollama/investigation.ts";
import { runBoundedAsync } from "../lib/domain/investigation.ts";
import { createSeededStore } from "../lib/api/store.ts";
import { createDispute } from "../lib/api/handlers.ts";
import { buildCaseContext, runInvestigation } from "../lib/api/investigation.ts";

const CONTEXT = {
  disputeId: 1,
  state: "submitted",
  get_transaction: { id: 42, amountMinor: 124900 },
  get_evidence_metadata: { events: 0 },
  get_risk_signals: { score: 0.4, signals: {}, explanation: "ok" },
};

// A fake Ollama client that returns scripted JSON without any network.
function fakeClient(script) {
  let i = 0;
  return {
    model: "fake",
    isReachable: async () => true,
    chatJson: async () => {
      const v = script[Math.min(i, script.length - 1)];
      i += 1;
      return v;
    },
  };
}

test("deterministic proposer walks the allowlist then stops", async () => {
  const result = await investigate(CONTEXT, { proposer: deterministicProposer });
  assert.equal(result.loop.stage, "review");
  assert.equal(result.loop.observations, 3);
  assert.equal(result.usedModel, false);
});

test("budget is enforced regardless of the model's eagerness", async () => {
  // A proposer that always wants another tool must be capped by the budget.
  const greedy = async () => ({ tool: "get_transaction" });
  const result = await investigate(CONTEXT, { proposer: greedy, budget: { maxIterations: 2, maxToolCalls: 2 } });
  assert.equal(result.loop.stage, "stopped");
  assert.equal(result.loop.toolCalls, 2);
});

test("a disallowed tool from the model is blocked before execution", async () => {
  const rogue = async () => ({ tool: "issue_refund" });
  const loop = await runBoundedAsync(DEFAULT_BUDGET, rogue);
  assert.equal(loop.stage, "stopped");
  assert.equal(loop.toolCalls, 0);
  assert.match(loop.history.at(-1), /not an allowed/);
});

test("model-backed proposer parses JSON and falls back on junk", async () => {
  // Model proposes a valid tool, then junk (falls back to deterministic),
  // then stops.
  const client = fakeClient([{ tool: "get_risk_signals" }, { nonsense: true }, { stop: true, reason: "done" }]);
  const proposer = makeOllamaProposer(client, CONTEXT);
  const result = await investigate(CONTEXT, { proposer, client, budget: { maxIterations: 5, maxToolCalls: 5 } });
  assert.ok(result.loop.observations >= 1);
  assert.ok(result.loop.stage === "review" || result.loop.stage === "stopped");
});

test("rogue model tool name is still rejected by the service", async () => {
  const client = fakeClient([{ tool: "DROP TABLE disputes" }]);
  const proposer = makeOllamaProposer(client, CONTEXT);
  // The parser rejects the non-allowlisted tool and falls back, so the loop
  // still only ever runs allowlisted tools.
  const result = await investigate(CONTEXT, { proposer, client, budget: { maxIterations: 3, maxToolCalls: 3 } });
  assert.ok(result.loop.history.every((h) => !h.includes("DROP TABLE")));
});

test("buildCaseContext and runInvestigation work end-to-end with a mock proposer", async () => {
  const store = createSeededStore();
  const created = createDispute(store, { id: 1, role: "customer" }, { transactionId: 42, idempotencyKey: "k" }).body.dispute;
  const ctx = buildCaseContext(store, created.id);
  assert.ok(ctx && ctx.get_risk_signals);
  const res = await runInvestigation(store, created.id, { proposer: deterministicProposer });
  assert.equal(res.status, 200);
  assert.equal(res.body.stage, "review");
  assert.ok(typeof res.body.summary === "string");
  // Unknown dispute -> 404.
  const missing = await runInvestigation(store, 99999, { proposer: deterministicProposer });
  assert.equal(missing.status, 404);
});
