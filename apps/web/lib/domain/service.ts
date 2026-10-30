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

export type AuditKind =
  | { kind: "dispute-created"; state: State }
  | { kind: "dispute-transition"; from: State; to: State; event: Event };

export type AuditEvent = {
  seq: number;
  disputeId: number;
  actorId: number;
  detail: AuditKind;
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

export class DisputeStore {
  private transactions = new Map<number, Transaction>();
  private disputes = new Map<number, Dispute>();
  private idempotency = new Map<string, { requestHash: string; disputeId: number }>();
  private auditLog: AuditEvent[] = [];
  private nextDisputeId = 1;
  private nextSeq = 1;

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

  private append(disputeId: number, actorId: number, detail: AuditKind): void {
    this.auditLog.push({ seq: this.nextSeq++, disputeId, actorId, detail });
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
