import test from "node:test";
import assert from "node:assert/strict";

import { renderCaseReportTex, texEscape } from "../lib/report/case-report.ts";

test("texEscape escapes LaTeX special characters", () => {
  assert.equal(texEscape("Airtime & data"), "Airtime \\& data");
  assert.ok(texEscape("a_b#c%d").includes("\\_"));
  assert.ok(texEscape("a_b#c%d").includes("\\#"));
  assert.ok(texEscape("x>y<z").includes("\\textgreater{}"));
  assert.ok(texEscape("x>y<z").includes("\\textless{}"));
});

test("renderCaseReportTex produces a compilable-looking document", () => {
  const tex = renderCaseReportTex({
    disputeId: 7,
    state: "under_review",
    version: 1,
    openedAt: "2026-10-31 10:00:00 UTC",
    txn: { id: 80, merchant: "Nando's", category: "Food & drink", amount: "R215,00", reason: "I never received this order." },
    reason: { scheme: "Visa", code: "13.1", title: "Merchandise / Services Not Received", description: "Not received by the expected date & time.", slaDays: 30 },
    riskPct: 40,
    events: [{ seq: 1, actorId: 3, text: "created (state submitted)" }],
    evidence: [{ storageName: "ev-1", detectedType: "application/pdf", sizeBytes: 20480 }],
    investigations: [{ stage: "review", model: "Deterministic fallback", toolCalls: 3, observations: 3, summary: "advisory" }],
    auditHead: "abc123",
    generatedAt: "2026-10-31 10:05:00 UTC",
  });

  assert.ok(tex.includes("\\documentclass"));
  assert.ok(tex.includes("\\begin{document}"));
  assert.ok(tex.includes("\\end{document}"));
  assert.ok(tex.includes("Dispute Case Report"));
  assert.ok(tex.includes("Visa 13.1"));
  // Category ampersand is escaped, not a raw column separator.
  assert.ok(tex.includes("Food \\& data".replace(" data", " drink")) || tex.includes("Food \\& drink"));
  assert.ok(tex.includes("abc123"));
});
