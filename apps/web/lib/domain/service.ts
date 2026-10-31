// In-memory dispute store: idempotent creation, one-active-per-transaction
// uniqueness, role-gated/version-checked transitions, and an audit log.
// TypeScript port of engine/src/service.rs.

import type { Transaction, User } from "./access";
import { canCreateDispute } from "./access";
import {
  actorMayPerform,
  applyTransition,
  isActive,
  isTransitionError,
  transition,
  type Dispute,
  type Event,
  type State,
  type TransitionError,
} from "./lifecycle";
import { linkHash, verifyChain, GENESIS, type VerifyResult } from "../hashchain";

export type AuditKind =
  | { kind: "dispute-created"; state: State }
  | { kind: "dispute-transition"; from: State; to: State; event: Event };

export type AuditEvent = {
  seq: number;
  disputeId: number;
  actorId: number;
  detail: AuditKind;
  prevHash: string;
  hash: string;
};

export type CreateError =
  | { kind: "not-owner" }
  | { kind: "active-dispute-exists" }
  | { kind: "key-reuse-with-different-request" }
  | { kind: "unknown-transaction" };

export type CreateOutcome = { dispute: Dispute; replayed: boolean };

export type ActionError =
  | { kind: "unknown-dispute" }
  | { kind: "not-authorised" }
  | { kind: "transition"; error: TransitionError };

export function isCreateError(v: CreateOutcome | CreateError): v is CreateError {
  return (v as CreateError).kind !== undefined && "replayed" in (v as object) === false;
}

export type EvidenceLogEntry = {
  seq: number;
  disputeId: number;
  actorId: number;
  storageName: string;
  sizeBytes: number;
  detectedType: string;
};
export type InvestigationLogEntry = {
  seq: number;
  disputeId: number;
  usedModel: boolean;
  summary: string;
  stage: string;
  observations: number;
  toolCalls: number;
};

export class DisputeStore {
  private transactions = new Map<number, Transaction>();
  private disputes = new Map<number, Dispute>();
  private idempotency = new Map<string, { requestHash: string; disputeId: number }>();
  private auditLog: AuditEvent[] = [];
  private evidenceLog: EvidenceLogEntry[] = [];
  private investigationLog: InvestigationLogEntry[] = [];
  private nextDisputeId = 1;
  private nextSeq = 1;
  private nextEvidenceSeq = 1;
  private nextInvestigationSeq = 1;

  private disputeMeta = new Map<number, { openedAt: number; reasonCode: string }>();
  setDisputeMeta(id: number, meta: { openedAt: number; reasonCode: string }): void {
    if (!this.disputeMeta.has(id)) this.disputeMeta.set(id, meta);
  }
  disputeMetaFor(id: number): { openedAt: number; reasonCode: string } | undefined {
    return this.disputeMeta.get(id);
  }

  recordEvidence(e: Omit<EvidenceLogEntry, "seq">): void {
    this.evidenceLog.push({ seq: this.nextEvidenceSeq++, ...e });
  }
  allEvidence(): EvidenceLogEntry[] {
    return [...this.evidenceLog];
  }
  recordInvestigation(i: Omit<InvestigationLogEntry, "seq">): void {
    this.investigationLog.push({ seq: this.nextInvestigationSeq++, ...i });
  }
  allInvestigations(): InvestigationLogEntry[] {
    return [...this.investigationLog];
  }

  addTransaction(tx: Transaction): void {
    this.transactions.set(tx.id, tx);
  }

  getTransaction(id: number): Transaction | undefined {
    return this.transactions.get(id);
  }

  dispute(id: number): Dispute | undefined {
    return this.disputes.get(id);
  }

  allDisputes(): Dispute[] {
    return [...this.disputes.values()];
  }

  activeDisputeCount(transactionId: number): number {
    return this.allDisputes().filter((d) => d.transactionId === transactionId && isActive(d.state)).length;
  }

  eventsFor(disputeId: number): AuditEvent[] {
    return this.auditLog.filter((e) => e.disputeId === disputeId);
  }

  allEvents(): AuditEvent[] {
    return [...this.auditLog];
  }

  private append(disputeId: number, actorId: number, detail: AuditKind): void {
    const seq = this.nextSeq++;
    const prevHash = this.auditLog.length ? this.auditLog[this.auditLog.length - 1].hash : GENESIS;
    const hash = linkHash(prevHash, { seq, disputeId, actorId, detail });
    this.auditLog.push({ seq, disputeId, actorId, detail, prevHash, hash });
  }

  verifyAuditChain(): VerifyResult {
    return verifyChain(this.auditLog);
  }

  createDispute(
    user: User,
    transactionId: number,
    requestHash: string,
    idempotencyKey: string,
  ): CreateOutcome | CreateError {
    const key = `${user.id}|${idempotencyKey}`;
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return { kind: "key-reuse-with-different-request" };
      }
      return { dispute: this.disputes.get(existing.disputeId)!, replayed: true };
    }

    const tx = this.transactions.get(transactionId);
    if (!tx) return { kind: "unknown-transaction" };
    if (!canCreateDispute(user, tx)) return { kind: "not-owner" };
    if (this.activeDisputeCount(transactionId) >= 1) return { kind: "active-dispute-exists" };

    const id = this.nextDisputeId++;
    const dispute: Dispute = { id, transactionId, state: "submitted", version: 0 };
    this.disputes.set(id, dispute);
    this.idempotency.set(key, { requestHash, disputeId: id });
    this.append(id, user.id, { kind: "dispute-created", state: "submitted" });
    return { dispute, replayed: false };
  }

  transitionDispute(
    actor: User,
    disputeId: number,
    event: Event,
    expectedVersion: number,
  ): Dispute | ActionError {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { kind: "unknown-dispute" };
    if (!actorMayPerform(actor.role, event)) return { kind: "not-authorised" };
    const from = dispute.state;
    if (transition(from, event) === null) {
      return { kind: "transition", error: { kind: "invalid-transition", from, event } };
    }
    const updated = applyTransition(dispute, event, expectedVersion);
    if (isTransitionError(updated)) return { kind: "transition", error: updated };
    this.disputes.set(disputeId, updated);
    this.append(disputeId, actor.id, { kind: "dispute-transition", from, to: updated.state, event });
    return updated;
  }
}
