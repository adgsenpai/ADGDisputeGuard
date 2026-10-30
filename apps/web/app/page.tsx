"use client";

import dynamic from "next/dynamic";
import TransactionShowcase from "@/components/transaction-showcase";
import RalphLoop from "@/components/ralph-loop";
import StackFlow from "@/components/stack-flow";
import {
  demoCards,
  formatRand,
  type DemoTransaction,
} from "@/lib/demo-transactions";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleCheck,
  Code2,
  Database,
  FileCheck2,
  FileText,
  Fingerprint,
  GitBranch,
  Layers3,
  LockKeyhole,
  Menu,
  Network,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

const ShieldScene = dynamic(() => import("@/components/shield-scene"), {
  ssr: false,
  loading: () => (
    <div className="shield-scene" aria-hidden="true">
      <img
        className="shield-fallback"
        src="/brand/disputeguard-logo.svg"
        alt=""
      />
    </div>
  ),
});
const repo = "https://github.com/adgsenpai/ADGDisputeGuard";
const steps = [
  {
    title: "Raise a dispute",
    label: "Submitted",
    detail:
      "Start with the transaction. Add a reason, attach supporting evidence, and receive a unique case reference.",
    icon: FileText,
    heading: "Your voice. A clear starting point.",
    body: "A card payment you need to query shouldn’t leave you wondering what comes next.",
    event: "Dispute submitted",
    note: "Your case has been received and is ready for review.",
  },
  {
    title: "Build the full picture",
    label: "Under review",
    detail:
      "Bring the transaction, customer evidence, and case history together in one focused analyst workspace.",
    icon: ScanLine,
    heading: "All the context. In one place.",
    body: "Give analysts the evidence they need to understand what happened, without losing the customer’s story.",
    event: "Analyst review started",
    note: "Transaction details and supporting evidence are being reviewed.",
  },
  {
    title: "Investigate with clarity",
    label: "Investigating",
    detail:
      "Use explainable risk signals and optional AI summaries to support a careful, human-led investigation.",
    icon: Fingerprint,
    heading: "Intelligence with accountability.",
    body: "Deterministic signals explain the risk. Optional AI helps summarise. An authorised analyst makes the decision.",
    event: "Investigation in progress",
    note: "An analyst is checking the evidence and transaction risk signals.",
  },
  {
    title: "Close the loop",
    label: "Resolved",
    detail:
      "Record the decision, preserve the audit trail, and give the customer a clear outcome and complete timeline.",
    icon: CircleCheck,
    heading: "A decision you can follow.",
    body: "Make the outcome visible, with a record of the steps, evidence, and people behind it.",
    event: "Case resolved",
    note: "The analyst’s decision and the completed case history are available.",
  },
];
const architecture = [
  {
    name: "Customer & analyst",
    tech: "Next.js · TypeScript",
    icon: Layers3,
    detail:
      "Two focused workspaces: a clear journey for customers and a structured review experience for analysts.",
  },
  {
    name: "Application & rules",
    tech: "Rust · Axum · Tokio",
    icon: GitBranch,
    detail:
      "The proposed Rust API validates access, enforces permitted state changes, and keeps domain rules independent of optional AI.",
  },
  {
    name: "Source of truth",
    tech: "PostgreSQL",
    icon: Database,
    detail:
      "Durable transactions, case events, evidence references, and audit records belong in PostgreSQL. Database constraints protect case integrity.",
  },
  {
    name: "Bounded assistance",
    tech: "Redis · Ollama",
    icon: Sparkles,
    detail:
      "The optional queue and local model assist with summaries and investigation. Core case operations remain independent of model availability.",
  },
];

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      className={`brand ${footer ? "brand-footer" : ""}`}
      href="#top"
      aria-label="DisputeGuard home"
    >
      <img src="/brand/disputeguard-logo.svg" width="38" height="38" alt="" />
      <span>
        Dispute<span className="brand-blue">Guard</span>
        <small>BY ADGSTUDIOS</small>
      </span>
    </a>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [layer, setLayer] = useState(1);
  const [demoTransaction, setDemoTransaction] = useState<DemoTransaction>(
    demoCards[0].transactions[0],
  );
  const revealRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    revealRoot.current
      ?.querySelectorAll(".reveal")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("menu-toggle")?.focus();
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [menuOpen]);
  const active = steps[step];

  return (
    <div ref={revealRoot} id="top">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav
            id="main-navigation"
            className={menuOpen ? "main-nav is-open" : "main-nav"}
            aria-label="Main navigation"
          >
            <a onClick={() => setMenuOpen(false)} href="#transactions">
              Transactions
            </a>
            <a onClick={() => setMenuOpen(false)} href="#workflow">
              How it works
            </a>
            <a onClick={() => setMenuOpen(false)} href="#architecture">
              Architecture
            </a>
            <a onClick={() => setMenuOpen(false)} href="#ralph">
              RALPH loop
            </a>
            <a onClick={() => setMenuOpen(false)} href="#documentation">
              Documentation
            </a>
          </nav>
          <a href={repo} className="repo-link" target="_blank" rel="noreferrer">
            <Code2 size={17} /> View project <ArrowUpRight size={15} />
          </a>
          <button
            id="menu-toggle"
            className="menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="container hero-content">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow">
                <span className="status-dot" /> AN ENGINEERING PROJECT WITH
                PURPOSE
              </div>
              <h1>
                Every dispute
                <br />
                deserves <span>clarity.</span>
              </h1>
              <p className="hero-description">
                Behind every transaction is a person. A considered approach to
                card disputes — built around trust, transparency, and human
                decisions.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#workflow">
                  Explore the experience <ArrowRight size={18} />
                </a>
                <a className="text-link" href="#architecture">
                  Under the hood <ArrowUpRight size={17} />
                </a>
              </div>
              <div className="hero-principles">
                <span>
                  <ShieldCheck size={15} /> Secure by design
                </span>
                <i />
                <span>
                  <Fingerprint size={15} /> Traceable by default
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="orbit-dashed orbit-one" />
              <div className="orbit-dashed orbit-two" />
              <div className="visual-axis axis-horizontal" />
              <div className="visual-axis axis-vertical" />
              <span className="visual-coordinate coordinate-top">
                DG / SYSTEM INTEGRITY
              </span>
              <ShieldScene />
              <div className="floating-note secure-note">
                <span className="mini-icon">
                  <LockKeyhole size={17} />
                </span>
                <div>
                  Trust at every layer
                  <small>Protection starts with the design.</small>
                </div>
                <span className="tiny-dot" />
              </div>
              <div className="floating-note case-note">
                <div className="case-note-top">
                  <span className="mono">CASE DG-2026-0042</span>
                  <span className="demo-tag">DEMO</span>
                </div>
                <div className="case-note-bottom">
                  <span className="success-icon">
                    <Check size={16} />
                  </span>
                  <div>
                    Clarity, from start to finish
                    <small>Every step. Every decision. Recorded.</small>
                  </div>
                </div>
                <div className="mini-timeline">
                  <i />
                  <span />
                  <i />
                  <span />
                  <i />
                  <span />
                  <i />
                </div>
              </div>
              <span className="visual-coordinate coordinate-bottom">
                <span className="blue-dot" /> DESIGNED FOR PEACE OF MIND
              </span>
            </div>
          </div>
          <div className="container hero-bottom">
            <span>A human-first approach to financial technology.</span>
            <a href="#approach">
              GET TO KNOW DISPUTEGUARD <span>↓</span>
            </a>
          </div>
        </section>

        <section className="stack-strip" aria-label="Planned technology stack">
          <div className="container stack-inner">
            <span className="stack-label">
              THOUGHTFULLY
              <br />
              ENGINEERED WITH
            </span>
            <span className="stack-name">
              <span className="next-logo">N</span> Next.js
            </span>
            <span className="stack-name">
              <Code2 /> Rust
            </span>
            <span className="stack-name">
              <Database /> PostgreSQL
            </span>
            <span className="stack-name">
              <Layers3 /> Redis
            </span>
            <span className="stack-name">
              <Sparkles /> Ollama
            </span>
            <span className="stack-name">
              <Network /> Docker
            </span>
          </div>
        </section>

        <section className="section approach-section" id="approach">
          <div className="container">
            <div className="section-heading reveal">
              <div>
                <div className="eyebrow">
                  <span className="section-index">01 /</span> THE APPROACH
                </div>
                <h2>
                  Complex behind the scenes.
                  <br />
                  <span>Clear where it matters.</span>
                </h2>
              </div>
              <p>
                Good financial software should make a difficult moment feel more
                manageable. That’s the idea behind every part of DisputeGuard.
              </p>
            </div>
            <div className="principles-grid">
              <article className="principle reveal">
                <div
                  className="principle-graphic trace-graphic"
                  aria-hidden="true"
                >
                  <span className="graphic-node">
                    <FileText />
                  </span>
                  <i />
                  <span className="graphic-node selected">
                    <ScanLine />
                  </span>
                  <i />
                  <span className="graphic-node">
                    <Check />
                  </span>
                  <div className="graphic-caption">A CLEAR PATH FORWARD</div>
                </div>
                <span className="card-number">01</span>
                <h3>Clarity at every step.</h3>
                <p>
                  From the first question to the final outcome, a visible
                  timeline keeps customers connected to their case.
                </p>
                <span className="feature-footnote">
                  <GitBranch size={14} /> A structured dispute lifecycle
                </span>
              </article>
              <article className="principle reveal">
                <div
                  className="principle-graphic security-graphic"
                  aria-hidden="true"
                >
                  <div className="security-ring">
                    <div>
                      <ShieldCheck size={33} />
                    </div>
                  </div>
                  <span className="lock-chip">
                    <LockKeyhole size={12} /> ACCESS VERIFIED
                  </span>
                </div>
                <span className="card-number">02</span>
                <h3>Trust is in the details.</h3>
                <p>
                  Explicit access controls, protected evidence, and an audit
                  trail are part of the blueprint from day one.
                </p>
                <span className="feature-footnote">
                  <LockKeyhole size={14} /> Security built into the foundation
                </span>
              </article>
              <article className="principle reveal">
                <div
                  className="principle-graphic human-graphic"
                  aria-hidden="true"
                >
                  <span className="signal-bar" />
                  <span className="signal-bar" />
                  <span className="signal-bar" />
                  <span className="signal-bar" />
                  <span className="signal-bar" />
                  <span className="human-decision">
                    <Fingerprint size={24} />
                    <small>HUMAN DECISION</small>
                  </span>
                </div>
                <span className="card-number">03</span>
                <h3>Assisted. Never automated away.</h3>
                <p>
                  Explainable risk signals and optional AI help analysts
                  understand the case. People retain the final say.
                </p>
                <span className="feature-footnote">
                  <Fingerprint size={14} /> Human accountability, always
                </span>
              </article>
            </div>
          </div>
        </section>

        <TransactionShowcase
          onExplore={(transaction) => {
            setDemoTransaction(transaction);
            setStep(0);
          }}
        />

        <section className="workflow-section" id="workflow">
          <div className="container">
            <div className="section-heading reveal">
              <div>
                <div className="eyebrow">
                  <span className="section-index">03 /</span> THE DISPUTE
                  JOURNEY
                </div>
                <h2>
                  From uncertainty
                  <br />
                  to <span>a clear outcome.</span>
                </h2>
              </div>
              <div className="workflow-intro">
                <p>
                  One connected journey.
                  <br />
                  No disappearing into a black box.
                </p>
                <span className="outline-tag">
                  <span className="status-dot" /> INTERACTIVE WALKTHROUGH
                </span>
              </div>
            </div>
            <div className="workflow-layout reveal">
              <div
                className="step-list"
                aria-label="Explore the dispute journey"
              >
                {steps.map((item, index) => (
                  <button
                    className={`step-button ${step === index ? "active" : ""}`}
                    key={item.title}
                    onClick={() => setStep(index)}
                    aria-pressed={step === index}
                    aria-controls="case-preview"
                  >
                    <span className="step-number">0{index + 1}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <span className="step-detail">{item.detail}</span>
                    </span>
                    <ArrowUpRight size={18} className="step-arrow" />
                  </button>
                ))}
              </div>
              <div
                className="case-preview"
                id="case-preview"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="preview-topbar">
                  <span>
                    <img
                      src="/brand/disputeguard-logo.svg"
                      alt=""
                      width="24"
                      height="24"
                    />{" "}
                    DisputeGuard <span className="preview-slash">/</span> Case
                    overview
                  </span>
                  <span className="demo-tag">ILLUSTRATIVE DEMO</span>
                </div>
                <div className="preview-content" key={step}>
                  <div className="case-reference">
                    DISPUTE DG-2026-0042{" "}
                    <span
                      className={`case-status ${step === 3 ? "resolved" : ""}`}
                    >
                      <span />
                      {active.label}
                    </span>
                  </div>
                  <h3>{active.heading}</h3>
                  <p className="preview-description">{active.body}</p>
                  <div className="transaction">
                    <span className="transaction-icon">
                      <ScanLine size={20} />
                    </span>
                    <div>
                      <strong>{demoTransaction.merchant}</strong>
                      <small>{demoTransaction.reason} · Mock data</small>
                    </div>
                    <strong className="transaction-amount">
                      {formatRand(demoTransaction.amountMinor)}
                    </strong>
                  </div>
                  <div className="preview-timeline">
                    {steps.map((item, index) => (
                      <div
                        className={index <= step ? "complete" : ""}
                        key={item.label}
                      >
                        <span>
                          {index < step ? (
                            <Check size={13} />
                          ) : index === step ? (
                            <span className="current-dot" />
                          ) : (
                            <span />
                          )}
                        </span>
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="event-card">
                    <active.icon size={19} />
                    <div>
                      <strong>{active.event}</strong>
                      <p>{active.note}</p>
                    </div>
                    <Check size={15} />
                  </div>
                  <div className="preview-footer">
                    <span>
                      <LockKeyhole size={12} /> Every action leaves a trace.
                    </span>
                    <button onClick={() => setStep((step + 1) % steps.length)}>
                      {step === 3 ? "Replay journey" : "Next step"}{" "}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="workflow-note">
              <span className="blue-dot" /> A preview of the planned experience,
              using sample data.
            </div>
          </div>
        </section>

        <section className="section architecture-section" id="architecture">
          <div className="container architecture-layout">
            <div className="architecture-copy reveal">
              <div className="eyebrow">
                <span className="section-index">04 /</span> BUILT WITH INTENTION
              </div>
              <h2>
                Strong foundations.
                <br />
                <span>Thoughtful boundaries.</span>
              </h2>
              <p>
                Simple experiences deserve serious engineering. A layered
                architecture keeps business rules explicit, data consistent, and
                assistance accountable.
              </p>
              <div className="architecture-values">
                <span>
                  <Check size={16} /> Deterministic rules at the core
                </span>
                <span>
                  <Check size={16} /> A durable, auditable source of truth
                </span>
                <span>
                  <Check size={16} /> Optional AI. Essential human oversight.
                </span>
              </div>
              <a
                className="text-link"
                href="/documents/engineering-specification.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Read the engineering specification <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="architecture-diagram reveal">
              <div className="diagram-header">
                <span className="mono">SYSTEM BLUEPRINT</span>
                <span className="diagram-version">
                  PLANNED ARCHITECTURE / V1.0
                </span>
              </div>
              <div className="architecture-nodes">
                {architecture.map((item, index) => (
                  <div className="architecture-node-wrap" key={item.name}>
                    <button
                      className={`architecture-node ${layer === index ? "selected" : ""}`}
                      onClick={() => setLayer(index)}
                      aria-pressed={layer === index}
                      aria-controls="layer-detail"
                    >
                      <span className="layer-icon">
                        <item.icon size={22} />
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.tech}</small>
                      </span>
                      <span className="layer-number">0{index + 1}</span>
                    </button>
                    {index < 3 && (
                      <div className="connector" aria-hidden="true">
                        <span />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p id="layer-detail" className="layer-detail" aria-live="polite">
                {architecture[layer].detail}
              </p>
              <div className="diagram-footer">
                <span className="blue-dot" /> SELECT A LAYER TO EXPLORE
              </div>
            </div>
          </div>
          <StackFlow />
        </section>

        <RalphLoop />

        <section className="quality-section">
          <div className="container quality-inner">
            <div className="quality-copy">
              <div className="eyebrow">THE QUALITY BAR</div>
              <h2>
                Built to feel better.
                <br />
                Designed to measure up.
              </h2>
              <p>
                Lighthouse targets for the landing page.
                <br />
                Goals to validate, not measured results.
              </p>
            </div>
            <div className="quality-stats">
              {[
                { label: "Performance", icon: Zap },
                { label: "Accessibility", icon: Fingerprint },
                { label: "Best practices", icon: ShieldCheck },
              ].map((item) => (
                <div className="quality-stat" key={item.label}>
                  <item.icon size={20} />
                  <strong>
                    90<span>+</span>
                  </strong>
                  <span>{item.label}</span>
                  <small>LIGHTHOUSE TARGET</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section docs-section" id="documentation">
          <div className="container">
            <div className="section-heading reveal">
              <div>
                <div className="eyebrow">
                  <span className="section-index">06 /</span> OPEN THE BLUEPRINT
                </div>
                <h2>
                  The thinking
                  <br />
                  <span>behind the experience.</span>
                </h2>
              </div>
              <p>
                Explore the requirements, architecture, and mathematics shaping
                the project. Written down. Open to review.
              </p>
            </div>
            <div className="documents-grid">
              {[
                {
                  title: "Engineering specification",
                  text: "Architecture, domain design, security, and the path to implementation.",
                  href: "engineering-specification",
                  icon: Code2,
                  number: "01",
                },
                {
                  title: "Software requirements",
                  text: "Testable behaviours, acceptance criteria, and explicit system boundaries.",
                  href: "software-requirements",
                  icon: FileCheck2,
                  number: "02",
                },
                {
                  title: "Equations & algorithms",
                  text: "The mathematical reasoning behind explainable risk and reliable workflows.",
                  href: "equations-and-algorithms",
                  icon: GitBranch,
                  number: "03",
                },
              ].map((doc) => (
                <a
                  className="document-card reveal"
                  key={doc.href}
                  href={`/documents/${doc.href}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="doc-top">
                    <doc.icon size={24} />
                    <span className="mono">DG / {doc.number}</span>
                  </div>
                  <h3>{doc.title}</h3>
                  <p>{doc.text}</p>
                  <div className="doc-bottom">
                    <span>EXPLORE THE PDF</span>
                    <ArrowUpRight size={19} />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="project-section">
          <div className="container project-inner reveal">
            <div className="project-kicker">
              <span className="status-dot" /> INDEPENDENT PROJECT · IN
              DEVELOPMENT
            </div>
            <h2>
              Considered engineering.
              <br />
              <span>Real-world purpose.</span>
            </h2>
            <p>
              A full-stack exploration of what trustworthy financial software
              can be.
              <br />
              Designed and built by adgsenpai, at ADGSTUDIOS.
            </p>
            <a
              href={repo}
              className="button button-primary"
              target="_blank"
              rel="noreferrer"
            >
              <Code2 size={18} /> Explore the source <ArrowUpRight size={17} />
            </a>
            <div className="project-watermark" aria-hidden="true">
              <ShieldCheck />
            </div>
          </div>
        </section>
      </main>
      <footer>
        <div className="container footer-top">
          <Brand footer />
          <p>Secure. Explainable. Auditable. Human.</p>
          <a href="#top">Back to top ↑</a>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} ADGSTUDIOS. Built with intention.
          </span>
          <span>
            Independent portfolio project. Not affiliated with or endorsed by
            Capitec.
          </span>
          <a href={repo} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
}
