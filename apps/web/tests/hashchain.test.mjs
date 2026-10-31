import test from "node:test";
import assert from "node:assert/strict";

import { sha256hex, linkHash, verifyChain, GENESIS } from "../lib/hashchain.ts";

test("sha256hex matches the known test vector", () => {
  assert.equal(sha256hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

function build(cores) {
  const entries = [];
  let prev = GENESIS;
  for (const c of cores) {
    const hash = linkHash(prev, c);
    entries.push({ ...c, prevHash: prev, hash });
    prev = hash;
  }
  return entries;
}

const CORES = [
  { seq: 1, disputeId: 1, actorId: 1, detail: { kind: "dispute-created", state: "submitted" } },
  { seq: 2, disputeId: 1, actorId: 9, detail: { kind: "dispute-transition", from: "submitted", to: "under_review", event: "begin_review" } },
  { seq: 3, disputeId: 1, actorId: 9, detail: { kind: "dispute-transition", from: "under_review", to: "investigating", event: "begin_investigation" } },
];

test("a well-formed chain verifies", () => {
  const res = verifyChain(build(CORES));
  assert.equal(res.valid, true);
  assert.equal(res.length, 3);
  assert.equal(res.head.length, 64);
});

test("tampering with an entry's content breaks the chain at that point", () => {
  const entries = build(CORES);
  // Alter the actor on the second event but keep its stored hash.
  entries[1] = { ...entries[1], actorId: 99 };
  const res = verifyChain(entries);
  assert.equal(res.valid, false);
  assert.equal(res.brokenAt, 2);
});

test("removing an entry breaks the chain", () => {
  const entries = build(CORES);
  const broken = [entries[0], entries[2]]; // drop seq 2
  const res = verifyChain(broken);
  assert.equal(res.valid, false);
  assert.equal(res.brokenAt, 3);
});
