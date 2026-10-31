// Pure request handlers for the dispute API. Each returns a {status, body}
// pair so the logic is unit-testable without a running HTTP server; the
// Next.js route files are thin wrappers that call these.

import type { DisputeStore, AuditEvent } from "../domain/service";
import type { User } from "../domain/access";
import type { Event } from "../domain/lifecycle";
import {
  receiveEvidence,
  demoPolicy,
  isEvidenceError,
  type Upload,
  type ScanResult,
} from "../domain/evidence";

export type ApiResult = { status: number; body: unknown };

// A stable hash of the request body for idempotency (demo-grade, not crypto).
export function hashRequest(value: unknown): string {
  const json = JSON.stringify(value);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

export function listTransactions(transactions: { id: number; ownerId: number }[], user: User): ApiResult {
  // A customer sees only their own transactions; staff see all.
  const visible =
    user.role === "customer" ? transactions.filter((t) => t.ownerId === user.id) : transactions;
  return { status: 200, body: { transactions: visible } };
}

// The audit events the user may see: staff see everything; a customer sees
// only events for disputes raised on their own transactions.
export function listAudit(
  store: DisputeStore,
  user: User,
  transactions: { id: number; ownerId: number }[],
): ApiResult {
  const all = store.allEvents();
  if (user.role !== "customer") return { status: 200, body: { events: all } };
  const ownedTx = new Set(transactions.filter((t) => t.ownerId === user.id).map((t) => t.id));
  const myDisputeIds = new Set(
    store.allDisputes().filter((d) => ownedTx.has(d.transactionId)).map((d) => d.id),
  );
  return { status: 200, body: { events: all.filter((e) => myDisputeIds.has(e.disputeId)) } };
}

export function createDispute(
  store: DisputeStore,
  user: User,
  body: { transactionId?: unknown; reason?: unknown; idempotencyKey?: unknown },
): ApiResult {
  const transactionId = Number(body.transactionId);
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!Number.isInteger(transactionId) || idempotencyKey === "") {
    return { status: 400, body: { error: "transactionId and idempotencyKey are required" } };
  }
  const requestHash = hashRequest({ transactionId, reason: body.reason ?? null });
  const result = store.createDispute(user, transactionId, requestHash, idempotencyKey);
  if ("kind" in result) {
    const map: Record<string, number> = {
      "not-owner": 403,
      "active-dispute-exists": 409,
      "key-reuse-with-different-request": 409,
      "unknown-transaction": 404,
    };
    return { status: map[result.kind] ?? 400, body: { error: result.kind } };
  }
  return { status: result.replayed ? 200 : 201, body: { dispute: result.dispute, replayed: result.replayed } };
}

export function getDispute(store: DisputeStore, id: number): ApiResult {
  const dispute = store.dispute(id);
  if (!dispute) return { status: 404, body: { error: "unknown-dispute" } };
  const events: AuditEvent[] = store.eventsFor(id);
  return { status: 200, body: { dispute, events } };
}

export function listDisputes(store: DisputeStore): ApiResult {
  return { status: 200, body: { disputes: store.allDisputes() } };
}

const VALID_EVENTS: Event[] = [
  "begin_review",
  "request_evidence",
  "evidence_submitted",
  "begin_investigation",
  "approve",
  "reject",
  "issue_refund",
];

export function transitionDispute(
  store: DisputeStore,
  actor: User,
  id: number,
  body: { event?: unknown; expectedVersion?: unknown },
): ApiResult {
  const event = body.event as Event;
  const expectedVersion = Number(body.expectedVersion);
  if (!VALID_EVENTS.includes(event) || !Number.isInteger(expectedVersion)) {
    return { status: 400, body: { error: "event and expectedVersion are required" } };
  }
  const result = store.transitionDispute(actor, id, event, expectedVersion);
  if ("kind" in result) {
    if (result.kind === "unknown-dispute") return { status: 404, body: { error: result.kind } };
    if (result.kind === "not-authorised") return { status: 403, body: { error: result.kind } };
    // Transition errors: version conflict is 409, invalid transition 422.
    const t = result.error;
    const status = t.kind === "version-conflict" ? 409 : 422;
    return { status, body: { error: t.kind, detail: t } };
  }
  return { status: 200, body: { dispute: result } };
}

export function submitEvidence(
  store: DisputeStore,
  user: User,
  id: number,
  body: { upload?: Partial<Upload>; scan?: ScanResult },
  storageName: string,
): ApiResult {
  const dispute = store.dispute(id);
  if (!dispute) return { status: 404, body: { error: "unknown-dispute" } };
  const tx = store.getTransaction(dispute.transactionId);
  // Access: the owner, or staff, may submit evidence for the case.
  const maySubmit = !!tx && (tx.ownerId === user.id || user.role === "analyst" || user.role === "admin");
  const u = body.upload ?? {};
  const upload: Upload = {
    name: String(u.name ?? ""),
    declaredType: String(u.declaredType ?? ""),
    detectedType: String(u.detectedType ?? ""),
    sizeBytes: Number(u.sizeBytes ?? 0),
  };
  const scan: ScanResult = body.scan ?? "clean";
  const result = receiveEvidence(maySubmit, id, upload, demoPolicy(), storageName, () => scan);
  if (isEvidenceError(result)) {
    const map: Record<string, number> = {
      "not-authorised": 403,
      "too-large": 413,
      "declared-type-not-allowed": 415,
      "extension-not-allowed": 415,
      "detected-type-not-allowed": 415,
      "scanner-unavailable": 503,
      "scan-not-clean": 422,
    };
    return { status: map[result.kind] ?? 400, body: { error: result.kind, detail: result } };
  }
  return { status: 201, body: { receipt: result } };
}
