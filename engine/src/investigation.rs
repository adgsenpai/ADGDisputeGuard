//! Bounded AI investigation (equations.tex, "Bounded AI Investigation
//! Algorithm"). Mirrors the web demo in `apps/web/lib/investigation-demo.ts`.
//!
//! The loop may only gather a limited amount of approved, read-only
//! information. It cannot grant itself tools or change dispute state; budget
//! exhaustion or a disallowed tool stops the analysis with the case unchanged.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scenario {
    /// Runs to completion and hands a summary to human review.
    Complete,
    /// Hits the iteration budget before the third tool call.
    Budget,
    /// Proposes a disallowed tool and is blocked before execution.
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Context,
    Propose,
    Validate,
    Observe,
    Review,
    Stopped,
}

/// The read-only tools on the application allowlist, in proposal order.
pub const TOOLS_FOR_DEMO: [&str; 3] =
    ["get_transaction", "get_evidence_metadata", "get_risk_signals"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoopState {
    pub stage: Stage,
    pub iteration: usize,
    pub tool_calls: usize,
    pub observations: usize,
    pub history: Vec<String>,
}

impl LoopState {
    pub fn initial() -> Self {
        LoopState {
            stage: Stage::Context,
            iteration: 0,
            tool_calls: 0,
            observations: 0,
            history: vec!["Authorised sample case loaded.".to_string()],
        }
    }

    fn record(&self, stage: Stage, iteration: usize, tool_calls: usize, observations: usize, event: &str) -> LoopState {
        let mut history = self.history.clone();
        history.push(event.to_string());
        LoopState { stage, iteration, tool_calls, observations, history }
    }
}

/// Advance the bounded loop by one step. Returns `None` when the state is
/// terminal and cannot continue (mirrors `advanceLoop` returning the same
/// state unchanged).
pub fn advance(state: &LoopState, scenario: Scenario) -> Option<LoopState> {
    match state.stage {
        Stage::Review | Stage::Stopped => None,
        Stage::Context => Some(state.record(
            Stage::Propose,
            1,
            state.tool_calls,
            state.observations,
            "Iteration 1: propose get_transaction.",
        )),
        Stage::Propose => Some(state.record(
            Stage::Validate,
            state.iteration,
            state.tool_calls,
            state.observations,
            "Check the schema, case access, allowlist, and remaining budget.",
        )),
        Stage::Validate => {
            if scenario == Scenario::Blocked && state.iteration == 2 {
                return Some(state.record(
                    Stage::Stopped,
                    state.iteration,
                    state.tool_calls,
                    state.observations,
                    "Blocked: issue_refund is not an allowed read-only tool. Analysis stopped.",
                ));
            }
            let tool = TOOLS_FOR_DEMO[state.iteration - 1];
            Some(state.record(
                Stage::Observe,
                state.iteration,
                state.tool_calls + 1,
                state.observations + 1,
                &format!("Read-only {tool} observation recorded."),
            ))
        }
        Stage::Observe => {
            if scenario == Scenario::Budget && state.iteration >= 2 {
                return Some(state.record(
                    Stage::Stopped,
                    state.iteration,
                    state.tool_calls,
                    state.observations,
                    "Demo iteration budget reached. Analysis incomplete; case unchanged.",
                ));
            }
            if state.iteration >= 3 {
                return Some(state.record(
                    Stage::Review,
                    state.iteration,
                    state.tool_calls,
                    state.observations,
                    "Validated summary and tool history prepared for human review.",
                ));
            }
            let iteration = state.iteration + 1;
            let next_tool = if scenario == Scenario::Blocked && iteration == 2 {
                "issue_refund (disallowed)".to_string()
            } else {
                TOOLS_FOR_DEMO[iteration - 1].to_string()
            };
            Some(state.record(
                Stage::Propose,
                iteration,
                state.tool_calls,
                state.observations,
                &format!("Iteration {iteration}: propose {next_tool}."),
            ))
        }
    }
}

/// Run the loop to a terminal state (bounded by `max_steps` as a safety net).
pub fn run(scenario: Scenario) -> LoopState {
    let mut state = LoopState::initial();
    for _ in 0..64 {
        match advance(&state, scenario) {
            Some(next) => state = next,
            None => return state,
        }
    }
    panic!("investigation loop failed to terminate");
}
