import test from "node:test";
import assert from "node:assert/strict";

import { suggestReasonCode, reasonCode, REASON_CODES, slaDaysRemaining, DAY_MS } from "../lib/chargeback.ts";

test("suggestReasonCode maps stated reasons to scheme codes", () => {
  assert.equal(suggestReasonCode("I don't recognise this payment."), "10.4");
  assert.equal(suggestReasonCode("I was charged twice."), "12.6.1");
  assert.equal(suggestReasonCode("I cancelled this subscription."), "13.2");
  assert.equal(suggestReasonCode("The order hasn't arrived."), "13.1");
  assert.equal(suggestReasonCode("I was charged more than expected."), "12.5");
  assert.equal(suggestReasonCode("Please process my refund."), "13.6");
  assert.equal(suggestReasonCode("something unusual happened"), "4853");
});

test("every reason code has an SLA, evidence and a known scheme", () => {
  for (const rc of Object.values(REASON_CODES)) {
    assert.ok(rc.slaDays > 0, `${rc.code} slaDays`);
    assert.ok(Array.isArray(rc.requiredEvidence) && rc.requiredEvidence.length > 0, `${rc.code} evidence`);
    assert.ok(rc.scheme === "Visa" || rc.scheme === "Mastercard", `${rc.code} scheme`);
  }
  assert.equal(reasonCode("10.4").provisionalCredit, true);
  assert.equal(reasonCode("13.1").provisionalCredit, false);
  assert.equal(reasonCode("nope"), undefined);
});

test("slaDaysRemaining counts down and goes negative when overdue", () => {
  const opened = 1_000_000_000_000;
  assert.equal(slaDaysRemaining(opened, "10.4", opened), 20);
  assert.equal(slaDaysRemaining(opened, "10.4", opened + 20 * DAY_MS), 0);
  assert.ok(slaDaysRemaining(opened, "10.4", opened + 25 * DAY_MS) < 0);
  assert.equal(slaDaysRemaining(opened, "unknown", opened), null);
});
