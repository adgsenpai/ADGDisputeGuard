"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleStop,
  FileSearch,
  Fingerprint,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  advanceLoop,
  initialLoopState,
  toolsForDemo,
  type LoopScenario,
} from "@/lib/investigation-demo";

const nodes = [
  {
    stage: "context",
    title: "Load context",
    subtitle: "Only the authorised case",
    icon: FileSearch,
  },
  {
    stage: "propose",
    title: "Propose a step",
    subtitle: "One structured request",
    icon: RefreshCw,
  },
  {
    stage: "validate",
    title: "Check the boundaries",
    subtitle: "Permissions, schema & budget",
    icon: ShieldCheck,
  },
  {
    stage: "observe",
    title: "Record & repeat",
    subtitle: "Add the observation to the case",
    icon: ListChecks,
  },
];
const descriptions: Record<string, { title: string; detail: string }> = {
  context: {
    title: "Start with the right context.",
    detail:
      "Load the authorised case and its execution limits. Customer evidence is treated as data, never as permission to take action.",
  },
  propose: {
    title: "Ask for one useful observation.",
    detail:
      "The assistant proposes a structured tool request. A proposal has no authority until the application checks it.",
  },
  validate: {
    title: "Every step passes a gate.",
    detail:
      "Validate the output schema, case access, read-only tool allowlist, and remaining execution budget before running anything.",
  },
  observe: {
    title: "Record what was learned.",
    detail:
      "Save the structured observation and tool history. If more context is needed and budget remains, repeat the loop.",
  },
  review: {
    title: "A summary, ready for a person.",
    detail:
      "The completed analysis supports an authorised analyst. The assistant cannot approve a dispute or issue a refund.",
  },
  stopped: {
    title: "Stop safely. Keep the case intact.",
    detail:
      "Record the incomplete or failed analysis. The core dispute workflow remains available, and a person can continue reviewing the case.",
  },
};

export default function RalphLoop() {
  const [scenario, setScenario] = useState<LoopScenario>("complete");
  const [state, setState] = useState(initialLoopState);
  const terminal = state.stage === "review" || state.stage === "stopped";
  const current = descriptions[state.stage];
  const limit = scenario === "budget" ? 2 : 3;
  const proposedTool = state.iteration
    ? scenario === "blocked" && state.iteration === 2
      ? "issue_refund"
      : toolsForDemo[state.iteration - 1]
    : "Awaiting a proposal";

  return (
    <section
      className="section ralph-section"
      id="ralph"
      aria-labelledby="ralph-title"
    >
      <div className="container">
        <div className="section-heading reveal">
          <div>
            <div className="eyebrow">
              <span className="section-index">05 /</span> THE RALPH LOOP
            </div>
            <h2 id="ralph-title">
              A little more context.
              <br />
              <span>A smarter next step.</span>
            </h2>
          </div>
          <p>
            A bounded investigation, made visible. Follow the logic from a case
            to a useful observation — and see exactly when the loop stops.
          </p>
        </div>
        <div className="loop-workspace reveal">
          <div className="loop-map">
            <div className="loop-map-heading">
              <span className="mono">CONTEXT → ACTION → OBSERVATION</span>
              <span className="demo-tag">CONCEPT DEMO</span>
            </div>
            <div className="loop-nodes">
              {nodes.map((node, i) => (
                <div
                  key={node.stage}
                  className={`loop-node ${state.stage === node.stage ? "active" : ""}`}
                  aria-current={state.stage === node.stage ? "step" : undefined}
                >
                  <span className="loop-node-icon">
                    <node.icon size={22} />
                  </span>
                  <span>
                    <small>0{i + 1}</small>
                    <strong>{node.title}</strong>
                    <span>{node.subtitle}</span>
                  </span>
                  {state.stage === node.stage && (
                    <span className="loop-live-dot" />
                  )}
                </div>
              ))}
            </div>
            <div
              className={`loop-return ${state.stage === "observe" ? "active" : ""}`}
            >
              <RotateCcw size={15} />
              <span>More to learn + budget remaining? Repeat.</span>
            </div>
            <div className={`loop-exit ${terminal ? "active" : ""}`}>
              {state.stage === "stopped" ? (
                <CircleStop size={20} />
              ) : (
                <Fingerprint size={20} />
              )}
              <div>
                <strong>
                  {state.stage === "stopped"
                    ? "Stop & record incomplete analysis"
                    : "Finish & hand off to an analyst"}
                </strong>
                <span>Financial decisions stay with people.</span>
              </div>
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="loop-console">
            <div className="loop-console-heading">
              <span className="eyebrow">FOLLOW THE LOGIC</span>
              <button
                className="loop-reset"
                onClick={() => setState(initialLoopState)}
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
            <label className="loop-scenario-label" htmlFor="loop-scenario">
              Explore a scenario
            </label>
            <select
              id="loop-scenario"
              value={scenario}
              onChange={(event) => {
                setScenario(event.target.value as LoopScenario);
                setState(initialLoopState);
              }}
            >
              <option value="complete">Enough context → human review</option>
              <option value="budget">Budget reached → safe stop</option>
              <option value="blocked">Disallowed tool → blocked</option>
            </select>
            <div className="loop-reading" aria-live="polite" aria-atomic="true">
              <div className="loop-reading-top">
                <span
                  className={`loop-state-tag ${state.stage === "stopped" ? "stopped" : ""}`}
                >
                  {state.stage === "review"
                    ? "READY FOR REVIEW"
                    : state.stage === "stopped"
                      ? "SAFELY STOPPED"
                      : "STEP-BY-STEP SIMULATION"}
                </span>
                <span className="mono">
                  {state.iteration} / {limit} ITERATIONS
                </span>
              </div>
              <h3>{current.title}</h3>
              <p>{current.detail}</p>
              <div className="loop-tool">
                <span>PROPOSED TOOL</span>
                <code>{proposedTool}</code>
              </div>
              <div className="loop-counters">
                <span>
                  <strong>{state.toolCalls}</strong> read-only calls
                </span>
                <span>
                  <strong>{state.observations}</strong> observations
                </span>
                <span>
                  <strong>0</strong> case changes
                </span>
              </div>
            </div>
            <div className="loop-history" aria-label="Simulation event history">
              <span className="mono">LATEST OBSERVATION</span>
              <p>{state.history[state.history.length - 1]}</p>
            </div>
            <button
              className="button button-primary loop-advance"
              disabled={terminal}
              onClick={() =>
                setState((previous) => advanceLoop(previous, scenario))
              }
            >
              {terminal ? (
                <>
                  {state.stage === "review"
                    ? "Ready for human review"
                    : "Analysis stopped"}{" "}
                  <Check size={16} />
                </>
              ) : (
                <>
                  {state.stage === "context"
                    ? "Start the loop"
                    : state.stage === "observe" && state.iteration < limit
                      ? "Continue the loop"
                      : "Next step"}{" "}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <p className="loop-policy">
              Illustrative limits. The specified system also bounds tool calls,
              tokens, and elapsed time.
            </p>
          </div>
        </div>
        <div className="loop-footnotes">
          <span>
            <ShieldCheck size={15} /> Allowlisted, read-only tools
          </span>
          <span>
            <ListChecks size={15} /> Recorded observations
          </span>
          <span>
            <Fingerprint size={15} /> Human decision authority
          </span>
        </div>
        <p className="section-disclaimer">
          RALPH concept visualisation based on the specification’s bounded
          investigation algorithm. No model or backend runs in this demo.
        </p>
      </div>
    </section>
  );
}
