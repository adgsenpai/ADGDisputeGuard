import test from "node:test";
import assert from "node:assert/strict";

import { createSeededStore, SEED_TRANSACTIONS } from "../lib/api/store.ts";
import {
  createDispute,
  getDispute,
  listDisputes,
  transitionDispute,
  submitEvidence,
  listTransactions,
  hashRequest,
} from "../lib/api/handlers.ts";

const CUSTOMER = { id: 1, role: "customer" };
const STRANGER = { id: 2, role: "customer" };
const ANALYST = { id: 9, role: "analyst" };

test("listTransactions hides other customers' transactions", () => {
  const txs = SEED_TRANSACTIONS.map((t) => ({ id: t.id, ownerId: t.ownerId }));
  const ownedBy = (id) => SEED_TRANSACTIONS.filter((t) => t.ownerId === id).length;

  const asOwner = listTransactions(txs, CUSTOMER).body.transactions;
  assert.equal(asOwner.length, ownedBy(CUSTOMER.id));
  assert.ok(asOwner.every((t) => t.ownerId === CUSTOMER.id));

  // Another customer sees only their own transactions, not the owner's.
  const asOther = listTransactions(txs, STRANGER).body.transactions;
  assert.equal(asOther.length, ownedBy(STRANGER.id));
  assert.ok(asOther.every((t) => t.ownerId === STRANGER.id));

  // Staff see every transaction.
  const asStaff = listTransactions(txs, ANALYST).body.transactions;
  assert.equal(asStaff.length, SEED_TRANSACTIONS.length);
});

test("createDispute enforces ownership, idempotency and uniqueness", () => {
  const store = createSeededStore();
  // Stranger cannot create on someone else's transaction.
  assert.equal(createDispute(store, STRANGER, { transactionId: 42, idempotencyKey: "k" }).status, 403);
  // Missing fields -> 400.
  assert.equal(createDispute(store, CUSTOMER, { transactionId: 42 }).status, 400);

  const first = createDispute(store, CUSTOMER, { transactionId: 42, reason: "x", idempotencyKey: "k1" });
  assert.equal(first.status, 201);
  assert.equal(first.body.replayed, false);
  // Idempotent retry returns 200 + original.
  const retry = createDispute(store, CUSTOMER, { transactionId: 42, reason: "x", idempotencyKey: "k1" });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.dispute.id, first.body.dispute.id);
  // Same key, different body -> 409.
  assert.equal(
    createDispute(store, CUSTOMER, { transactionId: 42, reason: "different", idempotencyKey: "k1" }).status,
    409,
  );
  // Second active dispute on same transaction -> 409.
  assert.equal(createDispute(store, CUSTOMER, { transactionId: 42, idempotencyKey: "k2" }).status, 409);
});

test("transitionDispute is role-gated and version-checked", () => {
  const store = createSeededStore();
  const created = createDispute(store, CUSTOMER, { transactionId: 51, idempotencyKey: "k" }).body.dispute;

  // Customer cannot begin review.
  assert.equal(transitionDispute(store, CUSTOMER, created.id, { event: "begin_review", expectedVersion: 0 }).status, 403);
  // Analyst can.
  const r1 = transitionDispute(store, ANALYST, created.id, { event: "begin_review", expectedVersion: 0 });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.dispute.state, "under_review");
  // Stale version -> 409.
  assert.equal(
    transitionDispute(store, ANALYST, created.id, { event: "begin_investigation", expectedVersion: 0 }).status,
    409,
  );
  // Invalid transition -> 422.
  assert.equal(
    transitionDispute(store, ANALYST, created.id, { event: "approve", expectedVersion: 1 }).status,
    422,
  );
  // Bad input -> 400.
  assert.equal(transitionDispute(store, ANALYST, created.id, { event: "nope", expectedVersion: 1 }).status, 400);
});

test("getDispute returns audit trail; unknown is 404", () => {
  const store = createSeededStore();
  const created = createDispute(store, CUSTOMER, { transactionId: 61, idempotencyKey: "k" }).body.dispute;
  const got = getDispute(store, created.id);
  assert.equal(got.status, 200);
  assert.equal(got.body.events.length, 1);
  assert.equal(got.body.events[0].detail.kind, "dispute-created");
  assert.equal(getDispute(store, 99999).status, 404);
  assert.equal(listDisputes(store).body.disputes.length, 1);
});

test("submitEvidence validates uploads", () => {
  const store = createSeededStore();
  const created = createDispute(store, CUSTOMER, { transactionId: 62, idempotencyKey: "k" }).body.dispute;
  const good = { name: "s.pdf", declaredType: "application/pdf", detectedType: "application/pdf", sizeBytes: 2048 };

  const ok = submitEvidence(store, CUSTOMER, created.id, { upload: good, scan: "clean" }, "srv-1");
  assert.equal(ok.status, 201);
  assert.equal(ok.body.receipt.storageName, "srv-1");

  // Stranger is refused.
  assert.equal(submitEvidence(store, STRANGER, created.id, { upload: good, scan: "clean" }, "s").status, 403);
  // Scanner unavailable -> 503.
  assert.equal(submitEvidence(store, CUSTOMER, created.id, { upload: good, scan: "unavailable" }, "s").status, 503);
  // Spoofed content type -> 415.
  const spoof = { ...good, detectedType: "application/x-dosexec" };
  assert.equal(submitEvidence(store, CUSTOMER, created.id, { upload: spoof, scan: "clean" }, "s").status, 415);
});

test("hashRequest is stable and order-sensitive", () => {
  assert.equal(hashRequest({ a: 1, b: 2 }), hashRequest({ a: 1, b: 2 }));
  assert.notEqual(hashRequest({ a: 1 }), hashRequest({ a: 2 }));
});
