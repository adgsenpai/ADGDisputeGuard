//! Unit tests for the flows: access, lifecycle, creation, investigation.

use disputeguard_engine::access::*;
use disputeguard_engine::investigation::*;
use disputeguard_engine::lifecycle::*;
use disputeguard_engine::samples::DEMO_TRANSACTIONS;
use disputeguard_engine::service::*;

// ---- Access control ---------------------------------------------------------

#[test]
fn ownership_and_roles_decide_view_and_create() {
    let tx = Transaction { id: 10, owner_id: 1 };
    let owner = User { id: 1, role: Role::Customer };
    let other = User { id: 2, role: Role::Customer };
    let analyst = User { id: 9, role: Role::Analyst };

    assert!(can_view(&owner, &tx));
    assert!(!can_view(&other, &tx)); // a stranger cannot view
    assert!(can_view(&analyst, &tx)); // role grants view

    // Only the owner may create a dispute, even an analyst may not.
    assert!(can_create_dispute(&owner, &tx));
    assert!(!can_create_dispute(&analyst, &tx));
    assert!(!can_create_dispute(&other, &tx));
}

// ---- Lifecycle state machine ------------------------------------------------

#[test]
fn authorised_transitions_follow_the_table() {
    assert_eq!(transition(State::Submitted, Event::BeginReview), Some(State::UnderReview));
    assert_eq!(transition(State::UnderReview, Event::RequestEvidence), Some(State::EvidenceRequired));
    assert_eq!(transition(State::EvidenceRequired, Event::EvidenceSubmitted), Some(State::EvidenceReceived));
    assert_eq!(transition(State::Investigating, Event::Approve), Some(State::Approved));
    assert_eq!(transition(State::Investigating, Event::Reject), Some(State::Rejected));
}

#[test]
fn unlisted_transitions_are_invalid() {
    // ISSUE_REFUND is never a valid lifecycle transition.
    assert_eq!(transition(State::Submitted, Event::IssueRefund), None);
    assert_eq!(transition(State::Approved, Event::Approve), None);
    assert_eq!(transition(State::Submitted, Event::Approve), None);
}

#[test]
fn optimistic_concurrency_rejects_stale_version() {
    let dispute = Dispute { id: 1, transaction_id: 10, state: State::Submitted, version: 3 };
    // Correct version advances and bumps version.
    let next = apply_transition(&dispute, Event::BeginReview, 3).unwrap();
    assert_eq!(next.state, State::UnderReview);
    assert_eq!(next.version, 4);
    // Stale version is rejected, not overwritten.
    assert_eq!(
        apply_transition(&dispute, Event::BeginReview, 2),
        Err(TransitionError::VersionConflict { expected: 2, actual: 3 })
    );
    // Invalid event is reported distinctly.
    assert!(matches!(
        apply_transition(&dispute, Event::Approve, 3),
        Err(TransitionError::InvalidTransition { .. })
    ));
}

// ---- Creation flow: ownership, idempotency, uniqueness ----------------------

fn store_with_tx() -> DisputeStore {
    let mut store = DisputeStore::new();
    store.add_transaction(Transaction { id: 10, owner_id: 1 });
    store
}

#[test]
fn creation_requires_ownership() {
    let mut store = store_with_tx();
    let stranger = User { id: 2, role: Role::Customer };
    assert_eq!(
        store.create_dispute(&stranger, 10, 0xABCD, "key-1"),
        Err(CreateError::NotOwner)
    );
}

#[test]
fn idempotent_retry_returns_original_not_duplicate() {
    let mut store = store_with_tx();
    let owner = User { id: 1, role: Role::Customer };
    let first = store.create_dispute(&owner, 10, 0xABCD, "key-1").unwrap();
    assert!(!first.replayed);
    // Same key + same request -> original result, no new dispute.
    let retry = store.create_dispute(&owner, 10, 0xABCD, "key-1").unwrap();
    assert!(retry.replayed);
    assert_eq!(retry.dispute.id, first.dispute.id);
    // Same key, different request body -> rejected.
    assert_eq!(
        store.create_dispute(&owner, 10, 0x9999, "key-1"),
        Err(CreateError::KeyReuseWithDifferentRequest)
    );
}

#[test]
fn at_most_one_active_dispute_per_transaction() {
    let mut store = store_with_tx();
    let owner = User { id: 1, role: Role::Customer };
    store.create_dispute(&owner, 10, 0x1, "key-a").unwrap();
    // A different key for the same transaction must be refused while active.
    assert_eq!(
        store.create_dispute(&owner, 10, 0x2, "key-b"),
        Err(CreateError::ActiveDisputeExists)
    );
    assert_eq!(store.active_dispute_count(10), 1);

    // Once the dispute resolves to a terminal state, it is no longer active
    // and a new dispute may be created.
    let d = *store.dispute(1).unwrap();
    let under_review = apply_transition(&d, Event::BeginReview, d.version).unwrap();
    let investigating = apply_transition(&under_review, Event::BeginInvestigation, under_review.version).unwrap();
    let rejected = apply_transition(&investigating, Event::Reject, investigating.version).unwrap();
    store.put_dispute(rejected);
    assert_eq!(store.active_dispute_count(10), 0);
    assert!(store.create_dispute(&owner, 10, 0x3, "key-c").is_ok());
}

// ---- Bounded investigation --------------------------------------------------

#[test]
fn complete_investigation_reaches_human_review() {
    let result = run(Scenario::Complete);
    assert_eq!(result.stage, Stage::Review);
    assert_eq!(result.tool_calls, 3);
    assert_eq!(result.observations, 3);
    assert_eq!(result.iteration, 3);
}

#[test]
fn budget_exhaustion_stops_before_third_tool_call() {
    let result = run(Scenario::Budget);
    assert_eq!(result.stage, Stage::Stopped);
    assert_eq!(result.iteration, 2);
    assert_eq!(result.tool_calls, 2);
    assert!(result.history.last().unwrap().contains("budget reached"));
}

#[test]
fn disallowed_tool_blocked_before_execution() {
    let result = run(Scenario::Blocked);
    assert_eq!(result.stage, Stage::Stopped);
    assert_eq!(result.tool_calls, 1);
    assert_eq!(result.observations, 1);
    assert!(result.history.last().unwrap().contains("issue_refund is not an allowed"));
}

#[test]
fn terminal_states_cannot_continue() {
    for scenario in [Scenario::Complete, Scenario::Budget, Scenario::Blocked] {
        let result = run(scenario);
        assert!(advance(&result, scenario).is_none());
    }
}

// ---- Sample-data sanity -----------------------------------------------------

#[test]
fn sample_transactions_have_unique_ids_and_positive_amounts() {
    let ids: std::collections::HashSet<_> = DEMO_TRANSACTIONS.iter().map(|t| t.id).collect();
    assert_eq!(ids.len(), DEMO_TRANSACTIONS.len());
    assert!(DEMO_TRANSACTIONS.iter().all(|t| t.amount_minor > 0));
}
