import test from "node:test";
import assert from "node:assert/strict";

import {
  parseMoney,
  addMoney,
  toDecimalString,
  isMoneyError,
  ZAR,
  USD,
  JPY,
} from "../lib/domain/money.ts";
import { canView, canCreateDispute } from "../lib/domain/access.ts";
import {
  transition,
  actorMayPerform,
  applyTransition,
  isTransitionError,
} from "../lib/domain/lifecycle.ts";
import {
  amountSignal,
  zScore,
  robustZScore,
  haversineKm,
  requiredVelocity,
  combinedScore,
  calculateRisk,
} from "../lib/domain/risk.ts";
import { receiveEvidence, demoPolicy, isEvidenceError } from "../lib/domain/evidence.ts";
import { runBounded } from "../lib/domain/investigation.ts";
import { DisputeStore } from "../lib/domain/service.ts";

test("money: exact minor units and currency-checked addition", () => {
  const m = parseMoney("1234.56", ZAR);
  assert.ok(!isMoneyError(m));
  assert.equal(m.minor, 123456n);
  assert.equal(toDecimalString(m), "1234.56");
  const sum = addMoney(parseMoney("0.10", ZAR), parseMoney("0.20", ZAR));
  assert.equal(sum.minor, 30n);
  assert.ok(isMoneyError(parseMoney("1.5", JPY))); // bad precision
  assert.ok(isMoneyError(addMoney(parseMoney("1.00", ZAR), parseMoney("1.00", USD))));
});

test("access: ownership and role rules", () => {
  const tx = { id: 10, ownerId: 1 };
  assert.ok(canView({ id: 1, role: "customer" }, tx));
  assert.ok(!canView({ id: 2, role: "customer" }, tx));
  assert.ok(canView({ id: 9, role: "analyst" }, tx));
  assert.ok(canCreateDispute({ id: 1, role: "customer" }, tx));
  assert.ok(!canCreateDispute({ id: 9, role: "analyst" }, tx));
});

test("lifecycle: transitions, role gating, version checks", () => {
  assert.equal(transition("submitted", "begin_review"), "under_review");
  assert.equal(transition("submitted", "issue_refund"), null);
  assert.ok(actorMayPerform("analyst", "begin_review"));
  assert.ok(!actorMayPerform("customer", "begin_review"));
  assert.ok(!actorMayPerform("admin", "issue_refund"));

  const d = { id: 1, transactionId: 10, state: "submitted", version: 3 };
  const ok = applyTransition(d, "begin_review", 3);
  assert.ok(!isTransitionError(ok));
  assert.equal(ok.state, "under_review");
  assert.equal(ok.version, 4);
  const stale = applyTransition(d, "begin_review", 2);
  assert.ok(isTransitionError(stale) && stale.kind === "version-conflict");
});

test("risk: signals, guards, haversine, combined score", () => {
  assert.equal(amountSignal(0, 10000), 0);
  assert.ok(amountSignal(1_000_000, 10000) === 1);
  assert.ok(zScore([220, 240, 210, 255, 230, 245, 225, 235], 900) > 3);
  assert.equal(zScore([100, 100, 100, 100], 900), null); // zero variance
  assert.equal(robustZScore([100, 100, 100, 100], 900), null); // MAD = 0
  const d = haversineKm(-26.2041, 28.0473, -33.9249, 18.4241);
  assert.ok(Math.abs(d - 1262) < 25);
  assert.equal(requiredVelocity(d, 0), null);

  const weights = { amount: 0.2, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };
  const score = combinedScore(
    { amount: 0.5, velocity: 0.4, merchant: 0.1, history: 0.9, geography: 0.3 },
    weights,
  );
  assert.ok(Math.abs(score - 0.44) < 1e-9);
  const missing = combinedScore(
    { amount: 0.5, velocity: 0.4, merchant: 0.1, history: 0.9, geography: null },
    weights,
  );
  assert.ok(typeof missing !== "number" && missing.kind === "missing-signal");
});

test("risk: calculateRisk reports unavailable with reason", () => {
  const weights = { amount: 0.2, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };
  const inputs = {
    zMax: 3,
    amount: { x: 900, xMax: 10000 },
    history: { history: [220, 240, 210, 255, 230, 245], current: 232 },
    velocity: { mu: 2, sigma: 0.5, current: 2.2 },
    merchant: { chargebacks: 3, total: 12 },
    geography: { requiredVel: 50, vMax: 900 },
  };
  assert.ok(typeof calculateRisk(inputs, weights).score === "number");
  const bad = { ...inputs, merchant: { chargebacks: 0, total: 0 } };
  const res = calculateRisk(bad, weights);
  assert.equal(res.score, null);
  assert.match(res.explanation, /merchant/);
});

test("evidence: layered validation", () => {
  const policy = demoPolicy();
  const good = { name: "s.pdf", declaredType: "application/pdf", detectedType: "application/pdf", sizeBytes: 1024 };
  const ok = receiveEvidence(true, 1, good, policy, "srv-abc", () => "clean");
  assert.ok(!isEvidenceError(ok) && ok.storageName === "srv-abc");
  assert.ok(isEvidenceError(receiveEvidence(false, 1, good, policy, "s", () => "clean")));
  const spoof = { ...good, detectedType: "application/x-dosexec" };
  const r = receiveEvidence(true, 1, spoof, policy, "s", () => "clean");
  assert.ok(isEvidenceError(r) && r.kind === "detected-type-not-allowed");
  const unavail = receiveEvidence(true, 1, good, policy, "s", () => "unavailable");
  assert.ok(isEvidenceError(unavail) && unavail.kind === "scanner-unavailable");
});

test("investigation: bounded loop enforces budget and allowlist", () => {
  // A proposer that always calls a read-only tool runs until the budget.
  const greedy = runBounded({ maxIterations: 2, maxToolCalls: 10 }, () => ({ tool: "get_transaction" }));
  assert.equal(greedy.stage, "stopped");
  assert.equal(greedy.toolCalls, 2);

  // A proposer that stops yields a review summary.
  const done = runBounded({ maxIterations: 5, maxToolCalls: 10 }, (s) =>
    s.observations >= 2 ? { stop: true, reason: "enough" } : { tool: "get_risk_signals" },
  );
  assert.equal(done.stage, "review");
  assert.equal(done.observations, 2);

  // A disallowed tool is blocked before execution.
  const blocked = runBounded({ maxIterations: 5, maxToolCalls: 10 }, () => ({ tool: "issue_refund" }));
  assert.equal(blocked.stage, "stopped");
  assert.equal(blocked.toolCalls, 0);
  assert.match(blocked.history.at(-1), /not an allowed/);
});

test("service: idempotent creation, uniqueness, audit log", () => {
  const store = new DisputeStore();
  store.addTransaction({ id: 10, ownerId: 1 });
  const owner = { id: 1, role: "customer" };
  const analyst = { id: 9, role: "analyst" };

  const first = store.createDispute(owner, 10, "hashA", "key-1");
  assert.ok("dispute" in first && !first.replayed);
  const retry = store.createDispute(owner, 10, "hashA", "key-1");
  assert.ok("dispute" in retry && retry.replayed && retry.dispute.id === first.dispute.id);
  const reuse = store.createDispute(owner, 10, "hashB", "key-1");
  assert.ok("kind" in reuse && reuse.kind === "key-reuse-with-different-request");
  const second = store.createDispute(owner, 10, "hashC", "key-2");
  assert.ok("kind" in second && second.kind === "active-dispute-exists");

  // Analyst drives the case; customer cannot.
  const id = first.dispute.id;
  assert.ok("kind" in store.transitionDispute(owner, id, "begin_review", 0));
  const r1 = store.transitionDispute(analyst, id, "begin_review", 0);
  assert.ok("state" in r1 && r1.state === "under_review");
  const r2 = store.transitionDispute(analyst, id, "begin_investigation", r1.version);
  const r3 = store.transitionDispute(analyst, id, "approve", r2.version);
  assert.ok("state" in r3 && r3.state === "approved");

  const events = store.eventsFor(id);
  assert.equal(events.length, 4);
  assert.equal(events[0].detail.kind, "dispute-created");
  assert.ok(events.every((e, i) => i === 0 || events[i - 1].seq < e.seq));
});
