export type LoopScenario = "complete" | "budget" | "blocked";
export type LoopStage =
  "context" | "propose" | "validate" | "observe" | "review" | "stopped";
export type LoopState = {
  stage: LoopStage;
  iteration: number;
  toolCalls: number;
  observations: number;
  history: string[];
};
export const toolsForDemo = [
  "get_transaction",
  "get_evidence_metadata",
  "get_risk_signals",
] as const;
export const initialLoopState: LoopState = {
  stage: "context",
  iteration: 0,
  toolCalls: 0,
  observations: 0,
  history: ["Authorised sample case loaded."],
};

// These limits illustrate the specified bounded pattern; they are not production policy.
export function advanceLoop(
  state: LoopState,
  scenario: LoopScenario,
): LoopState {
  const record = (next: Partial<LoopState>, event: string): LoopState => ({
    ...state,
    ...next,
    history: [...state.history, event],
  });
  if (state.stage === "review" || state.stage === "stopped") return state;
  if (state.stage === "context")
    return record(
      { stage: "propose", iteration: 1 },
      "Iteration 1: propose get_transaction.",
    );
  if (state.stage === "propose")
    return record(
      { stage: "validate" },
      "Check the schema, case access, allowlist, and remaining budget.",
    );
  if (state.stage === "validate") {
    if (scenario === "blocked" && state.iteration === 2)
      return record(
        { stage: "stopped" },
        "Blocked: issue_refund is not an allowed read-only tool. Analysis stopped.",
      );
    return record(
      {
        stage: "observe",
        toolCalls: state.toolCalls + 1,
        observations: state.observations + 1,
      },
      `Read-only ${toolsForDemo[state.iteration - 1]} observation recorded.`,
    );
  }
  if (scenario === "budget" && state.iteration >= 2)
    return record(
      { stage: "stopped" },
      "Demo iteration budget reached. Analysis incomplete; case unchanged.",
    );
  if (state.iteration >= 3)
    return record(
      { stage: "review" },
      "Validated summary and tool history prepared for human review.",
    );
  const iteration = state.iteration + 1;
  return record(
    { stage: "propose", iteration },
    `Iteration ${iteration}: propose ${scenario === "blocked" && iteration === 2 ? "issue_refund (disallowed)" : toolsForDemo[iteration - 1]}.`,
  );
}
