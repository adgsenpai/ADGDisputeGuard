import { getStore, SEED_TRANSACTIONS } from "@/lib/api/store";
import { userFromRequest } from "@/lib/api/request";
import { type CaseReportData } from "@/lib/report/case-report";
import { reasonCode as lookupReasonCode } from "@/lib/chargeback";
import { advisoryScore } from "@/lib/risk-advisory";
import { renderCasePdf } from "@/lib/report/pdf";
import { caseAttachments } from "@/lib/control/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function zar(amountMinor: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amountMinor / 100);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  const store = getStore();
  const user = userFromRequest(req);

  const dispute = store.dispute(id);
  if (!dispute) return Response.json({ error: "unknown-dispute" }, { status: 404 });

  const txn = SEED_TRANSACTIONS.find((t) => t.id === dispute.transactionId) ?? null;
  // Access: the owner, or staff, may download the report.
  if (user.role === "customer" && (!txn || txn.ownerId !== user.id)) {
    return Response.json({ error: "not-authorised" }, { status: 403 });
  }

  const meta = store.disputeMetaFor(id) ?? null;
  const rc = meta ? lookupReasonCode(meta.reasonCode) : undefined;
  const risk = txn ? advisoryScore(txn.amountMinor) : null;

  const events = store.eventsFor(id).map((e) => ({
    seq: e.seq,
    actorId: e.actorId,
    text:
      e.detail.kind === "dispute-created"
        ? `created (state ${e.detail.state})`
        : `${e.detail.event}: ${e.detail.from} -> ${e.detail.to}`,
  }));
  const evidence = store.allEvidence().filter((x) => x.disputeId === id).map((x) => ({
    storageName: x.storageName,
    detectedType: x.detectedType,
    sizeBytes: x.sizeBytes,
  }));
  const investigations = store.allInvestigations().filter((x) => x.disputeId === id).map((x) => ({
    stage: x.stage,
    model: x.usedModel ? "Ollama model" : "Deterministic fallback",
    toolCalls: x.toolCalls,
    observations: x.observations,
    summary: x.summary,
  }));

  const data: CaseReportData = {
    disputeId: id,
    state: dispute.state,
    version: dispute.version,
    openedAt: meta ? new Date(meta.openedAt).toISOString().replace("T", " ").slice(0, 19) + " UTC" : null,
    txn: txn
      ? { id: txn.id, merchant: txn.merchant, category: txn.category, amount: zar(txn.amountMinor), reason: txn.reason }
      : null,
    reason: rc ? { scheme: rc.scheme, code: rc.code, title: rc.title, description: rc.description, slaDays: rc.slaDays } : null,
    riskPct: risk === null ? null : Math.round(risk * 100),
    events,
    evidence,
    investigations,
    auditHead: store.verifyAuditChain().head,
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
  };

  try {
    const pdf = await renderCasePdf(data, caseAttachments(id));
    return new Response(new Uint8Array(pdf), { headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="disputeguard-case-${id}.pdf"`,
      "cache-control": "private, no-store",
    } });
  } catch {
    return Response.json({ error: "Report generation failed. Please try again." }, { status: 500 });
  }
}
