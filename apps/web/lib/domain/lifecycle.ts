// Dispute lifecycle state machine with optimistic concurrency and role gating.
// TypeScript port of engine/src/lifecycle.rs.

import type { Role } from "./access";

export type State =
  | "submitted"
  | "under_review"
  | "evidence_required"
  | "evidence_received"
  | "investigating"
  | "approved"
  | "rejected";

export type Event =
  | "begin_review"
  | "request_evidence"
  | "evidence_submitted"
  | "begin_investigation"
  | "approve"
  | "reject"
  | "issue_refund";

// Authorised transition function T: returns the next state or null (bottom).
export function transition(state: State, event: Event): State | null {
  const table: Record<string, State> = {
    "submitted|begin_review": "under_review",
    "under_review|request_evidence": "evidence_required",
    "evidence_required|evidence_submitted": "evidence_received",
    "evidence_received|begin_investigation": "investigating",
    "under_review|begin_investigation": "investigating",
    "investigating|approve": "approved",
    "investigating|reject": "rejected",
  };
  return table[`${state}|${event}`] ?? null;
}

export function isActive(state: State): boolean {
  return state !== "approved" && state !== "rejected";
}

// Whether an actor's role may perform an event. Review-driving events are
// analyst/admin only; a customer may only submit evidence.
export function actorMayPerform(role: Role, event: Event): boolean {
  switch (event) {
    case "evidence_submitted":
      return role === "customer" || role === "analyst" || role === "admin";
    case "begin_review":
    case "request_evidence":
    case "begin_investigation":
    case "approve":
    case "reject":
      return role === "analyst" || role === "admin";
    case "issue_refund":
      return false;
  }
}

export type Dispute = {
  id: number;
  transactionId: number;
  state: State;
  version: number;
};

export type TransitionError =
  | { kind: "version-conflict"; expected: number; actual: number }
  | { kind: "invalid-transition"; from: State; event: Event };

export function isTransitionError(v: Dispute | TransitionError): v is TransitionError {
  return (v as TransitionError).kind !== undefined;
}

// Apply an authorised transition with an optimistic-concurrency check.
export function applyTransition(
  dispute: Dispute,
  event: Event,
  expectedVersion: number,
): Dispute | TransitionError {
  if (dispute.version !== expectedVersion) {
    return { kind: "version-conflict", expected: expectedVersion, actual: dispute.version };
  }
  const next = transition(dispute.state, event);
  if (next === null) {
    return { kind: "invalid-transition", from: dispute.state, event };
  }
  return { ...dispute, state: next, version: dispute.version + 1 };
}
