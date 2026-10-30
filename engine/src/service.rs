//! Dispute creation flow (equations.tex, "One Active Dispute per
//! Transaction", "Safe, Repeatable Requests", "Dispute Creation Algorithm").
//!
//! An in-memory stand-in for the database that enforces the two guards the
//! spec requires together: an idempotency record and a uniqueness constraint
//! on active disputes per transaction.

use std::collections::HashMap;

use crate::access::{can_create_dispute, Transaction, User};
use crate::lifecycle::{
    actor_may_perform, apply_transition, is_active, transition, Dispute, Event, State,
    TransitionError,
};

/// A durable audit/event-log entry. In a real system the event rows and the
/// dispute write commit in one transaction; here the in-memory append plays
/// that role.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuditKind {
    DisputeCreated { state: State },
    DisputeTransition { from: State, to: State, event: Event },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEvent {
    pub seq: u64,
    pub dispute_id: u64,
    pub actor_id: u64,
    pub kind: AuditKind,
}

/// A completed idempotent request: `(u, K, h) -> r`.
#[derive(Debug, Clone)]
struct IdempotentRecord {
    request_hash: u64,
    dispute_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CreateError {
    /// Caller is not the owner of the transaction.
    NotOwner,
    /// An active dispute already exists for this transaction (uniqueness).
    ActiveDisputeExists,
    /// The idempotency key was reused with a different request body.
    KeyReuseWithDifferentRequest,
    /// The transaction does not exist.
    UnknownTransaction,
}

/// Outcome of a creation attempt. A replay is flagged so callers (and the
/// report) can distinguish a fresh insert from a returned original result.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateOutcome {
    pub dispute: Dispute,
    pub replayed: bool,
}

/// A dispute action was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActionError {
    /// The dispute does not exist.
    UnknownDispute,
    /// The actor's role may not perform this event.
    NotAuthorised,
    /// The transition was invalid or the version was stale.
    Transition(TransitionError),
}

#[derive(Default)]
pub struct DisputeStore {
    transactions: HashMap<u64, Transaction>,
    disputes: HashMap<u64, Dispute>,
    /// (user_id, key) -> record.
    idempotency: HashMap<(u64, String), IdempotentRecord>,
    /// Append-only audit/event log, in commit order.
    audit_log: Vec<AuditEvent>,
    next_dispute_id: u64,
    next_seq: u64,
}

impl DisputeStore {
    pub fn new() -> Self {
        DisputeStore { next_dispute_id: 1, next_seq: 1, ..Default::default() }
    }

    pub fn add_transaction(&mut self, tx: Transaction) {
        self.transactions.insert(tx.id, tx);
    }

    pub fn dispute(&self, id: u64) -> Option<&Dispute> {
        self.disputes.get(&id)
    }

    fn append_audit(&mut self, dispute_id: u64, actor_id: u64, kind: AuditKind) {
        let seq = self.next_seq;
        self.next_seq += 1;
        self.audit_log.push(AuditEvent { seq, dispute_id, actor_id, kind });
    }

    /// The ordered audit/event history for a dispute.
    pub fn events_for(&self, dispute_id: u64) -> Vec<&AuditEvent> {
        self.audit_log.iter().filter(|e| e.dispute_id == dispute_id).collect()
    }

    /// The whole audit log, in commit order.
    pub fn audit_log(&self) -> &[AuditEvent] {
        &self.audit_log
    }

    /// Apply an authorised, role-gated, version-checked transition and record
    /// the state change together with its audit event (atomic append).
    pub fn transition_dispute(
        &mut self,
        actor: &User,
        dispute_id: u64,
        event: Event,
        expected_version: u64,
    ) -> Result<Dispute, ActionError> {
        let dispute = *self.disputes.get(&dispute_id).ok_or(ActionError::UnknownDispute)?;
        if !actor_may_perform(actor.role, event) {
            return Err(ActionError::NotAuthorised);
        }
        // Pre-check the transition is defined before touching state.
        let from = dispute.state;
        let to = transition(from, event).ok_or(ActionError::Transition(
            TransitionError::InvalidTransition { from, event },
        ))?;
        let updated = apply_transition(&dispute, event, expected_version)
            .map_err(ActionError::Transition)?;
        self.disputes.insert(dispute_id, updated);
        self.append_audit(
            dispute_id,
            actor.id,
            AuditKind::DisputeTransition { from, to, event },
        );
        Ok(updated)
    }

    /// Count active disputes for a transaction (used to enforce the
    /// `<= 1 active per transaction` invariant).
    pub fn active_dispute_count(&self, transaction_id: u64) -> usize {
        self.disputes
            .values()
            .filter(|d| d.transaction_id == transaction_id && is_active(d.state))
            .count()
    }

    /// Create a dispute "atomically": ownership, eligibility, idempotency
    /// replay, and the one-active-dispute uniqueness guard are all checked
    /// before any write, and nothing is written on failure.
    pub fn create_dispute(
        &mut self,
        user: &User,
        transaction_id: u64,
        request_hash: u64,
        idempotency_key: &str,
    ) -> Result<CreateOutcome, CreateError> {
        // Idempotency replay (same user + key).
        let key = (user.id, idempotency_key.to_string());
        if let Some(record) = self.idempotency.get(&key) {
            if record.request_hash != request_hash {
                return Err(CreateError::KeyReuseWithDifferentRequest);
            }
            let dispute = self.disputes[&record.dispute_id];
            return Ok(CreateOutcome { dispute, replayed: true });
        }

        let tx = *self
            .transactions
            .get(&transaction_id)
            .ok_or(CreateError::UnknownTransaction)?;

        if !can_create_dispute(user, &tx) {
            return Err(CreateError::NotOwner);
        }

        // Uniqueness: at most one active dispute per transaction.
        if self.active_dispute_count(transaction_id) >= 1 {
            return Err(CreateError::ActiveDisputeExists);
        }

        // Commit: insert dispute + idempotency record together.
        let id = self.next_dispute_id;
        self.next_dispute_id += 1;
        let dispute = Dispute {
            id,
            transaction_id,
            state: State::Submitted,
            version: 0,
        };
        self.disputes.insert(id, dispute);
        self.idempotency
            .insert(key, IdempotentRecord { request_hash, dispute_id: id });
        self.append_audit(id, user.id, AuditKind::DisputeCreated { state: dispute.state });

        Ok(CreateOutcome { dispute, replayed: false })
    }

    /// Replace a stored dispute (e.g. after an authorised transition) so the
    /// active-count invariant reflects the new state.
    pub fn put_dispute(&mut self, dispute: Dispute) {
        self.disputes.insert(dispute.id, dispute);
    }
}
