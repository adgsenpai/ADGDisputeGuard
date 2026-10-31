import test from "node:test";
import assert from "node:assert/strict";
import { availableEvents } from "../lib/domain/lifecycle.ts";
import { createSeededStore } from "../lib/api/store.ts";
import { createDispute, transitionDispute } from "../lib/api/handlers.ts";

const analyst = { id: 9, role: "analyst" };
const customer = { id: 1, role: "customer" };

const expected = {
  submitted: ["begin_review"],
  under_review: ["request_evidence", "begin_investigation"],
  evidence_required: ["evidence_submitted"],
  evidence_received: ["begin_investigation"],
  investigating: ["approve", "reject"],
  approved: [],
  rejected: [],
};

test("console actions respect lifecycle state and role, including closed cases", () => {
  for (const [state, actions] of Object.entries(expected)) {
    assert.deepEqual(availableEvents(state, "analyst"), actions);
    assert.deepEqual(availableEvents(state, "admin"), actions);
    assert.deepEqual(availableEvents(state, "customer"), state === "evidence_required" ? ["evidence_submitted"] : []);
  }
});

test("every offered staff action is accepted by the API at the current version", () => {
  const paths = [
    ["begin_review", "begin_investigation", "approve"],
    ["begin_review", "request_evidence", "evidence_submitted", "begin_investigation", "reject"],
  ];
  for (const path of paths) {
    const store = createSeededStore();
    let dispute = createDispute(store, customer, { transactionId: 42, idempotencyKey: "case" }).body.dispute;
    for (const event of path) {
      assert.ok(availableEvents(dispute.state, analyst.role).includes(event));
      const result = transitionDispute(store, analyst, dispute.id, { event, expectedVersion: dispute.version });
      assert.equal(result.status, 200);
      assert.equal(result.body.dispute.version, dispute.version + 1);
      dispute = result.body.dispute;
    }
    assert.deepEqual(availableEvents(dispute.state, analyst.role), []);
  }
});

test("invalid transitions explain the current state and next actions without mutating the case", () => {
  const store = createSeededStore();
  const dispute = createDispute(store, customer, { transactionId: 42, idempotencyKey: "case" }).body.dispute;
  const result = transitionDispute(store, analyst, dispute.id, { event: "approve", expectedVersion: 0 });
  assert.equal(result.status, 422);
  assert.equal(result.body.error, "invalid-transition");
  assert.match(result.body.message, /Cannot approve while this case is submitted/);
  assert.deepEqual(result.body.availableEvents, ["begin_review"]);
  assert.equal(store.dispute(dispute.id).state, "submitted");
  assert.equal(store.dispute(dispute.id).version, 0);
  assert.equal(store.eventsFor(dispute.id).length, 1);
});

test("a stale repeat action returns a version conflict rather than a misleading 422", () => {
  const store = createSeededStore();
  const dispute = createDispute(store, customer, { transactionId: 42, idempotencyKey: "case" }).body.dispute;
  assert.equal(transitionDispute(store, analyst, dispute.id, { event: "begin_review", expectedVersion: 0 }).status, 200);
  const repeated = transitionDispute(store, analyst, dispute.id, { event: "begin_review", expectedVersion: 0 });
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.error, "version-conflict");
  assert.match(repeated.body.message, /case has changed/);
  assert.equal(store.eventsFor(dispute.id).length, 2);
});

test("customer evidence action is available and accepted only when evidence is requested", () => {
  const store = createSeededStore();
  const dispute = createDispute(store, customer, { transactionId: 42, idempotencyKey: "case" }).body.dispute;
  assert.equal(transitionDispute(store, customer, dispute.id, { event: "evidence_submitted", expectedVersion: 0 }).status, 422);
  transitionDispute(store, analyst, dispute.id, { event: "begin_review", expectedVersion: 0 });
  transitionDispute(store, analyst, dispute.id, { event: "request_evidence", expectedVersion: 1 });
  assert.equal(transitionDispute(store, customer, dispute.id, { event: "evidence_submitted", expectedVersion: 2 }).status, 200);
});
