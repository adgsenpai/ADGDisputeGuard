"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Box,
  BrainCircuit,
  Database,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import "./stack-flow.css";

type NodeId = "web" | "api" | "db" | "redis" | "worker" | "ollama";
type FlowStep = {
  from: NodeId;
  to: NodeId;
  title: string;
  description: string;
  payload: string;
};
const nodes = [
  { id: "web", name: "Next.js", detail: "Customer / analyst", icon: Layers3 },
  {
    id: "api",
    name: "Rust API",
    detail: "Access & domain rules",
    icon: Server,
  },
  {
    id: "db",
    name: "PostgreSQL",
    detail: "Durable source of truth",
    icon: Database,
  },
  { id: "redis", name: "Redis", detail: "Optional job queue", icon: Workflow },
  {
    id: "worker",
    name: "AI worker",
    detail: "Bounded investigation",
    icon: ShieldCheck,
  },
  {
    id: "ollama",
    name: "Ollama",
    detail: "Local model inference",
    icon: BrainCircuit,
  },
] as const;
const flows: Record<"core" | "assistance", FlowStep[]> = {
  core: [
    {
      from: "web",
      to: "api",
      title: "A customer raises a dispute.",
      description:
        "The interface sends the transaction reference, reason, and request key. The API checks identity, ownership, and eligibility.",
      payload: "Dispute request · HTTPS",
    },
    {
      from: "api",
      to: "db",
      title: "The rules become a durable record.",
      description:
        "The API writes the case, initial event, audit entry, and idempotency result in one database transaction.",
      payload: "Validated case + audit event",
    },
    {
      from: "db",
      to: "api",
      title: "The database confirms the write.",
      description:
        "PostgreSQL returns the committed case reference and status. A successful response follows the durable write.",
      payload: "Committed reference + status",
    },
    {
      from: "api",
      to: "web",
      title: "The customer sees where things stand.",
      description:
        "The API returns the case reference and current status so the interface can show the dispute timeline.",
      payload: "Case confirmation · HTTPS",
    },
  ],
  assistance: [
    {
      from: "api",
      to: "redis",
      title: "Queue assistance in the background.",
      description:
        "After the case exists, an optional analysis job enters the queue. The core dispute workflow remains independent of AI availability.",
      payload: "Case reference + analysis job",
    },
    {
      from: "redis",
      to: "worker",
      title: "Pick up a bounded investigation.",
      description:
        "The worker receives a case-scoped job with limits on iterations, tool calls, tokens, and elapsed time.",
      payload: "Case-scoped work item",
    },
    {
      from: "worker",
      to: "db",
      title: "Ask for authorised case context.",
      description:
        "Application-controlled, read-only tools request only the transaction, evidence metadata, and signals permitted for this case.",
      payload: "Allowlisted context read",
    },
    {
      from: "db",
      to: "worker",
      title: "Gather observations from the source.",
      description:
        "Durable case context returns to the worker. Redis is a queue, never the authoritative record of the dispute.",
      payload: "Case context + observations",
    },
    {
      from: "worker",
      to: "ollama",
      title: "Request a structured analysis.",
      description:
        "The worker sends the permitted context to the local model. Evidence is treated as data, not as instructions that grant authority.",
      payload: "Bounded prompt + output schema",
    },
    {
      from: "ollama",
      to: "worker",
      title: "Check the model’s suggestion.",
      description:
        "A proposed summary returns for application validation. Invalid output is rejected; it cannot approve a case or issue a refund.",
      payload: "Advisory structured output",
    },
    {
      from: "worker",
      to: "db",
      title: "Record the validated assistance.",
      description:
        "The worker persists the validated summary and tool history. The financial decision and dispute state remain under authorised human control.",
      payload: "Validated summary + tool history",
    },
    {
      from: "db",
      to: "api",
      title: "Retrieve the recorded analysis.",
      description:
        "When the analyst requests a case update, the API reads the stored assistance from PostgreSQL using its normal access checks.",
      payload: "Stored analysis · API read result",
    },
    {
      from: "api",
      to: "web",
      title: "Bring the context back to a person.",
      description:
        "The analyst interface presents the assistance alongside evidence and deterministic signals. An authorised analyst decides the outcome.",
      payload: "Advisory summary for human review",
    },
  ],
};

const layouts: Record<
  "desktop" | "mobile",
  Record<NodeId, [number, number]>
> = {
  desktop: {
    web: [140, 82],
    api: [460, 82],
    db: [780, 82],
    redis: [140, 270],
    worker: [460, 270],
    ollama: [780, 270],
  },
  mobile: {
    web: [88, 70],
    api: [88, 225],
    db: [88, 380],
    redis: [270, 70],
    worker: [270, 225],
    ollama: [270, 380],
  },
};
const connections: [NodeId, NodeId][] = [
  ["web", "api"],
  ["api", "db"],
  ["api", "redis"],
  ["redis", "worker"],
  ["worker", "db"],
  ["worker", "ollama"],
];

function route(from: NodeId, to: NodeId, mobile: boolean) {
  const positions = layouts[mobile ? "mobile" : "desktop"];
  const [x1, y1] = positions[from];
  const [x2, y2] = positions[to];
  const halfWidth = mobile ? 70 : 108;
  const halfHeight = mobile ? 46 : 43;
  if (y1 === y2)
    return `M ${x1 + (x2 > x1 ? halfWidth : -halfWidth)} ${y1} L ${x2 + (x2 > x1 ? -halfWidth : halfWidth)} ${y2}`;
  if (x1 === x2)
    return `M ${x1} ${y1 + (y2 > y1 ? halfHeight : -halfHeight)} L ${x2} ${y2 + (y2 > y1 ? -halfHeight : halfHeight)}`;
  if (mobile) {
    const startX = x1 + (x2 > x1 ? halfWidth : -halfWidth);
    const endX = x2 + (x2 > x1 ? -halfWidth : halfWidth);
    const middle = (startX + endX) / 2;
    return `M ${startX} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${endX} ${y2}`;
  }
  const startY = y1 + (y2 > y1 ? halfHeight : -halfHeight);
  const endY = y2 + (y2 > y1 ? -halfHeight : halfHeight);
  const middle = (startY + endY) / 2;
  return `M ${x1} ${startY} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${endY}`;
}

function FlowMap({
  step,
  mobile,
  assistance,
}: {
  step: FlowStep;
  mobile: boolean;
  assistance: boolean;
}) {
  const positions = layouts[mobile ? "mobile" : "desktop"];
  const width = mobile ? 140 : 216;
  const height = mobile ? 92 : 86;
  const activePath = route(step.from, step.to, mobile);
  return (
    <svg
      className={`stack-flow-map ${mobile ? "flow-map-mobile" : "flow-map-desktop"}`}
      viewBox={mobile ? "0 0 358 460" : "0 0 920 365"}
      role="img"
      aria-label={`Illustrative data flow: ${nodes.find((node) => node.id === step.from)?.name} to ${nodes.find((node) => node.id === step.to)?.name}. ${step.title}`}
    >
      {connections.map(([from, to]) => (
        <path
          key={`${from}-${to}`}
          d={route(from, to, mobile)}
          className={`flow-wire ${from === "web" || (from === "api" && to === "db") ? "" : "optional-wire"}`}
        />
      ))}
      <path d={activePath} className="flow-wire-active" />
      <path
        key={`${step.from}-${step.to}-${step.payload}`}
        d={activePath}
        className="flow-packets"
      />
      {nodes.map((node) => {
        const [x, y] = positions[node.id];
        const active = node.id === step.from || node.id === step.to;
        const muted =
          !assistance && ["redis", "worker", "ollama"].includes(node.id);
        return (
          <g
            key={node.id}
            transform={`translate(${x - width / 2} ${y - height / 2})`}
            className={`flow-service ${active ? "active" : ""} ${muted ? "muted" : ""}`}
          >
            <rect
              width={width}
              height={height}
              rx="10"
              className="flow-service-box"
            />
            <rect
              x={mobile ? 12 : 17}
              y={mobile ? 13 : 22}
              width={mobile ? 25 : 40}
              height={mobile ? 25 : 40}
              rx="7"
              className="flow-service-icon-bg"
            />
            <node.icon
              x={mobile ? 17 : 27}
              y={mobile ? 18 : 32}
              width={mobile ? 15 : 20}
              height={mobile ? 15 : 20}
              className="flow-service-icon"
            />
            <text
              x={mobile ? 12 : 70}
              y={mobile ? 58 : 39}
              className="flow-service-name"
            >
              {node.name}
            </text>
            <text
              x={mobile ? 12 : 70}
              y={mobile ? 76 : 58}
              className="flow-service-detail"
            >
              {node.detail}
            </text>
            {active && (
              <>
                <circle
                  cx={width - 15}
                  cy="16"
                  r="3"
                  className="flow-node-dot"
                />
                <text
                  x={mobile ? 44 : width - 15}
                  y={mobile ? 29 : 76}
                  textAnchor={mobile ? "start" : "end"}
                  className="flow-direction"
                >
                  {node.id === step.from ? "SENDING" : "RECEIVING"}
                </text>
              </>
            )}
          </g>
        );
      })}
      <text
        x={mobile ? 18 : 32}
        y={mobile ? 452 : 351}
        className="flow-map-caption"
      >
        {mobile
          ? "LEFT: CORE PATH · RIGHT: OPTIONAL ASSISTANCE"
          : "TOP: CORE DISPUTE PATH                         BOTTOM: OPTIONAL ASSISTANCE"}
      </text>
    </svg>
  );
}

export default function StackFlow() {
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"core" | "assistance">("core");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const steps = flows[mode];
  const step = steps[index];
  const running = playing && visible && pageVisible && !reducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updatePreference();
    updateVisibility();
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % steps.length),
      4000,
    );
    return () => window.clearTimeout(timer);
  }, [index, running, steps.length]);

  function chooseMode(next: "core" | "assistance") {
    setMode(next);
    setIndex(0);
  }

  return (
    <div className="container stack-flow-container">
      <div
        ref={root}
        className={`stack-flow reveal ${running ? "flow-running" : ""}`}
      >
        <div className="stack-flow-heading">
          <div>
            <div className="eyebrow">
              <span className="status-dot" /> FOLLOW THE DATA
            </div>
            <h3>One request. A connected stack.</h3>
            <p>
              Watch the handoffs, from a customer action to a recorded outcome.
            </p>
          </div>
          <div className="flow-mode-switch" aria-label="Data flow scenario">
            <button
              aria-pressed={mode === "core"}
              onClick={() => chooseMode("core")}
            >
              Core dispute
            </button>
            <button
              aria-pressed={mode === "assistance"}
              onClick={() => chooseMode("assistance")}
            >
              Optional AI assistance
            </button>
          </div>
        </div>
        <div className="flow-runtime">
          <span>
            <Box size={14} /> DOCKER · PROPOSED LOCAL TOPOLOGY
          </span>
          <span className="flow-demo-label">ILLUSTRATIVE DATA FLOW</span>
        </div>
        <FlowMap
          step={step}
          mobile={false}
          assistance={mode === "assistance"}
        />
        <FlowMap step={step} mobile assistance={mode === "assistance"} />
        <div
          className="flow-story"
          aria-live={running ? "off" : "polite"}
          aria-atomic="true"
        >
          <div className="flow-story-number">
            {String(index + 1).padStart(2, "0")}
            <span> / {String(steps.length).padStart(2, "0")}</span>
          </div>
          <div className="flow-story-copy">
            <h4>{step.title}</h4>
            <p>{step.description}</p>
          </div>
          <div className="flow-payload">
            <span>IN TRANSIT</span>
            <strong>{step.payload}</strong>
          </div>
        </div>
        <div className="flow-controls">
          <div className="flow-progress" aria-label="Choose a data flow step">
            {steps.map((item, i) => (
              <button
                key={item.title}
                aria-label={`Show flow step ${i + 1}: ${item.title}`}
                aria-pressed={i === index}
                onClick={() => {
                  setIndex(i);
                  setPlaying(false);
                }}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="flow-playback">
            <button
              aria-label="Replay data flow"
              onClick={() => {
                setIndex(0);
                setPlaying(true);
              }}
            >
              <RotateCcw size={14} />
              <span>Replay</span>
            </button>
            <button
              aria-label={
                reducedMotion
                  ? "Animation disabled for reduced motion"
                  : playing
                    ? "Pause data flow"
                    : "Play data flow"
              }
              disabled={reducedMotion}
              onClick={() => setPlaying(!playing)}
            >
              {playing && !reducedMotion ? (
                <Pause size={14} />
              ) : (
                <Play size={14} />
              )}
              <span>
                {reducedMotion ? "Manual mode" : playing ? "Pause" : "Play"}
              </span>
            </button>
            <button
              aria-label="Next data flow step"
              onClick={() => {
                setPlaying(false);
                setIndex((index + 1) % steps.length);
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="flow-bottom-note">
          <ShieldCheck size={13} />
          <span>
            PostgreSQL holds the durable record. Optional AI provides
            assistance. People make the decision.
          </span>
        </div>
      </div>
    </div>
  );
}
