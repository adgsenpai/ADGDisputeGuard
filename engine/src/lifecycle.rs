//! Dispute lifecycle state machine (equations.tex, "Dispute Lifecycle").
//!
//! `T : S x E -> S u {bottom}`. An action absent from the authorised
//! transition table is invalid and returns `None`.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum State {
    Submitted,
    UnderReview,
    EvidenceRequired,
    EvidenceReceived,
    Investigating,
    Approved,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Event {
    BeginReview,
    RequestEvidence,
    EvidenceSubmitted,
    BeginInvestigation,
    Approve,
    Reject,
    /// A financial action that is never a valid lifecycle transition.
    IssueRefund,
}

/// The authorised transition function `T`. Returns `None` for `bottom`.
pub fn transition(state: State, event: Event) -> Option<State> {
    use Event::*;
    use State::*;
    match (state, event) {
        (Submitted, BeginReview) => Some(UnderReview),
        (UnderReview, RequestEvidence) => Some(EvidenceRequired),
        (EvidenceRequired, EvidenceSubmitted) => Some(EvidenceReceived),
        // Evidence received / under review may advance into investigation.
        (EvidenceReceived, BeginInvestigation) => Some(Investigating),
        (UnderReview, BeginInvestigation) => Some(Investigating),
        (Investigating, Approve) => Some(Approved),
        (Investigating, Reject) => Some(Rejected),
        // Everything else, including ISSUE_REFUND from any state, is invalid.
        _ => None,
    }
}

/// States the application treats as "active" (S_A). Terminal outcomes are
/// not active.
pub fn is_active(state: State) -> bool {
    !matches!(state, State::Approved | State::Rejected)
}

/// A dispute carries an optimistic-concurrency version `v`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Dispute {
    pub id: u64,
    pub transaction_id: u64,
    pub state: State,
    pub version: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransitionError {
    /// The caller's expected version did not match the stored version.
    VersionConflict { expected: u64, actual: u64 },
    /// `T(state, event) = bottom`.
    InvalidTransition { from: State, event: Event },
}

/// Apply an authorised transition with an optimistic-concurrency check
/// (equations.tex, "Concurrent Updates"): a change succeeds only when
/// `v_request == v_database`, and then `v_new = v_old + 1`.
pub fn apply_transition(
    dispute: &Dispute,
    event: Event,
    expected_version: u64,
) -> Result<Dispute, TransitionError> {
    if dispute.version != expected_version {
        return Err(TransitionError::VersionConflict {
            expected: expected_version,
            actual: dispute.version,
        });
    }
    match transition(dispute.state, event) {
        Some(next) => Ok(Dispute {
            state: next,
            version: dispute.version + 1,
            ..*dispute
        }),
        None => Err(TransitionError::InvalidTransition {
            from: dispute.state,
            event,
        }),
    }
}
