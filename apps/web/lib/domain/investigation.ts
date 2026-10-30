// Bounded investigation loop — application-enforced allowlist and budget.
// TypeScript port of engine/src/investigation.rs, generalised so the proposer
// can be any function (a deterministic demo, or an Ollama-backed one).

export type Stage = "context" | "propose" | "validate" | "observe" | "review" | "stopped";

export const READONLY_TOOLS = ["get_transaction", "get_evidence_metadata", "get_risk_signals"] as const;
export type ToolName = (typeof READONLY_TOOLS)[number];

export type Budget = {
  maxIterations: number;
  maxToolCalls: number;
};

export type LoopState = {
  stage: Stage;
  iteration: number;
  toolCalls: number;
  observations: number;
  history: string[];
};

export function initialState(): LoopState {
  return { stage: "context", iteration: 0, toolCalls: 0, observations: 0, history: ["Authorised case loaded."] };
}

// A proposal for the next step: which read-only tool to call, or a stop.
export type Proposal = { tool: ToolName } | { stop: true; reason: string };

// Validate a proposal against the application allowlist. The allowlist is
// enforced here in app code, never trusted from the model's output.
export function isAllowed(proposal: Proposal): boolean {
  if ("stop" in proposal) return true;
  return (READONLY_TOOLS as readonly string[]).includes(proposal.tool);
}

export type Proposer = (state: LoopState) => Proposal;

// Run the bounded loop. The proposer suggests steps; the budget and allowlist
// are enforced regardless of what the proposer returns.
export function runBounded(budget: Budget, proposer: Proposer): LoopState {
  let state = initialState();
  const guardSteps = budget.maxIterations * 4 + 8;
  for (let i = 0; i < guardSteps; i++) {
    // Budget: stop cleanly when either bound is reached.
    if (state.iteration >= budget.maxIterations || state.toolCalls >= budget.maxToolCalls) {
      return {
        ...state,
        stage: "stopped",
        history: [...state.history, "Budget reached. Analysis incomplete; case unchanged."],
      };
    }
    const proposal = proposer(state);
    // Disallowed tool -> blocked before any execution.
    if (!isAllowed(proposal)) {
      const bad = "tool" in proposal ? proposal.tool : "unknown";
      return {
        ...state,
        stage: "stopped",
        history: [...state.history, `Blocked: ${bad} is not an allowed read-only tool.`],
      };
    }
    if ("stop" in proposal) {
      return {
        ...state,
        stage: "review",
        history: [...state.history, `Summary prepared for human review: ${proposal.reason}`],
      };
    }
    // Execute the read-only tool and record a structured observation.
    state = {
      stage: "observe",
      iteration: state.iteration + 1,
      toolCalls: state.toolCalls + 1,
      observations: state.observations + 1,
      history: [...state.history, `Read-only ${proposal.tool} observation recorded.`],
    };
  }
  return { ...state, stage: "stopped", history: [...state.history, "Guard limit reached."] };
}
