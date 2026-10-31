"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./console.css";
import Avatar from "@/components/avatar";
import Login from "@/components/console/login";
import Shell, { NAV, type ViewKey } from "@/components/console/shell";
import {
  loadIdentity,
  clearIdentity,
  authHeaders,
  type Identity,
} from "@/lib/identity";
import { ROLE_LABELS } from "@/lib/personas";

type Txn = { id: number; ownerId?: number; merchant: string; category: string; amountMinor: number; reason: string };
type Dispute = { id: number; transactionId: number; state: string; version: number };
type AuditEvent = { seq: number; disputeId?: number; actorId: number; detail: { kind: string; from?: string; to?: string; event?: string; state?: string } };
type Investigation = { usedModel: boolean; summary: string; stage: string; observations: number; toolCalls: number; history: string[] };

const ANALYST_EVENTS = ["begin_review", "request_evidence", "begin_investigation", "approve", "reject"];
const ACTIVE = (s: string) => s !== "approved" && s !== "rejected";

function zar(amountMinor: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amountMinor / 100);
}
function badgeClass(state: string) {
  if (state === "approved") return "badge badge--approved";
  if (state === "rejected") return "badge badge--rejected";
  return "badge badge--active";
}
function nice(s: string) {
  return s.replace(/_/g, " ");
}

/* ---------------- identity gate ---------------- */
export default function ConsolePage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIdentity(loadIdentity());
    setReady(true);
  }, []);

  if (!ready) return <main className="console--loading" aria-busy="true" />;
  if (!identity) return <Login onSignedIn={setIdentity} />;

  return (
    <ConsoleApp
      key={identity.userId}
      identity={identity}
      onSignOut={() => {
        clearIdentity();
        setIdentity(null);
      }}
    />
  );
}

/* ---------------- app ---------------- */
function ConsoleApp({ identity, onSignOut }: { identity: Identity; onSignOut: () => void }) {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [allEvents, setAllEvents] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = useMemo(() => authHeaders(identity), [identity]);
  const txnById = useMemo(() => new Map(txns.map((t) => [t.id, t])), [txns]);

  // hash-based deep linking (#dashboard, #disputes, ...)
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "") as ViewKey;
      if (NAV.some((n) => n.key === h)) setView(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const navigate = useCallback((v: ViewKey) => {
    setView(v);
    if (typeof window !== "undefined") window.location.hash = v;
  }, []);

  const flash = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadTxns = useCallback(async () => {
    const res = await fetch("/api/transactions", { headers });
    setTxns((await res.json()).transactions ?? []);
  }, [headers]);
  const loadDisputes = useCallback(async () => {
    const res = await fetch("/api/disputes", { headers });
    setDisputes((await res.json()).disputes ?? []);
  }, [headers]);
  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/audit", { headers });
    setAllEvents((await res.json()).events ?? []);
  }, [headers]);
  const loadDetail = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/disputes/${id}`, { headers });
      setEvents((await res.json()).events ?? []);
    },
    [headers],
  );

  useEffect(() => {
    loadTxns();
    loadDisputes();
    loadAudit();
  }, [loadTxns, loadDisputes, loadAudit]);

  useEffect(() => {
    if (selected !== null) {
      loadDetail(selected);
      setInvestigation(null);
    }
  }, [selected, loadDetail]);

  const selectedDispute = disputes.find((d) => d.id === selected) ?? null;

  async function openDispute(tx: Txn) {
    setBusy(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers,
        body: JSON.stringify({ transactionId: tx.id, reason: tx.reason, idempotencyKey: `tx-${tx.id}` }),
      });
      const data = await res.json();
      if (!res.ok) flash("err", `Could not open dispute: ${data.error}`);
      else {
        flash("ok", data.replayed ? "Existing dispute returned (idempotent)." : `Dispute #${data.dispute.id} opened.`);
        await Promise.all([loadDisputes(), loadAudit()]);
        setSelected(data.dispute.id);
      }
    } finally {
      setBusy(false);
    }
  }
  async function doTransition(event: string) {
    if (!selectedDispute) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/transition`, {
        method: "POST",
        headers,
        body: JSON.stringify({ event, expectedVersion: selectedDispute.version }),
      });
      const data = await res.json();
      if (!res.ok) flash("err", `Transition refused: ${data.error}`);
      else flash("ok", `Moved to ${data.dispute.state}.`);
      await Promise.all([loadDisputes(), loadDetail(selectedDispute.id), loadAudit()]);
    } finally {
      setBusy(false);
    }
  }
  async function submitEvidence() {
    if (!selectedDispute) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/evidence`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          upload: { name: "statement.pdf", declaredType: "application/pdf", detectedType: "application/pdf", sizeBytes: 20480 },
          scan: "clean",
        }),
      });
      const data = await res.json();
      if (!res.ok) flash("err", `Evidence refused: ${data.error}`);
      else flash("ok", `Evidence stored as ${data.receipt.storageName}.`);
    } finally {
      setBusy(false);
    }
  }
  async function runInvestigation() {
    if (!selectedDispute) return;
    setBusy(true);
    setInvestigation(null);
    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/investigate`, { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) flash("err", `Investigation failed: ${data.error}`);
      else setInvestigation(data);
    } finally {
      setBusy(false);
    }
  }

  function inspect(id: number) {
    setSelected(id);
    navigate("disputes");
  }

  const canActAsStaff = identity.role === "analyst" || identity.role === "admin";
  const badges = { disputes: disputes.filter((d) => ACTIVE(d.state)).length || undefined };

  const shared = {
    identity,
    txns,
    disputes,
    allEvents,
    events,
    txnById,
    selected,
    selectedDispute,
    investigation,
    busy,
    canActAsStaff,
    openDispute,
    doTransition,
    submitEvidence,
    runInvestigation,
    inspect,
    setSelected,
    navigate,
  };

  return (
    <Shell identity={identity} view={view} onNavigate={navigate} onSignOut={onSignOut} badges={badges}>
      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}
      {view === "dashboard" && <Dashboard {...shared} />}
      {view === "transactions" && <TransactionsView {...shared} />}
      {view === "disputes" && <DisputesView {...shared} />}
      {view === "investigations" && <InvestigationsView {...shared} />}
      {view === "evidence" && <EvidenceView {...shared} />}
      {view === "audit" && <AuditView {...shared} />}
      {view === "settings" && <SettingsView {...shared} onSignOut={onSignOut} />}
    </Shell>
  );
}

type Shared = {
  identity: Identity;
  txns: Txn[];
  disputes: Dispute[];
  allEvents: AuditEvent[];
  events: AuditEvent[];
  txnById: Map<number, Txn>;
  selected: number | null;
  selectedDispute: Dispute | null;
  investigation: Investigation | null;
  busy: boolean;
  canActAsStaff: boolean;
  openDispute: (t: Txn) => void;
  doTransition: (e: string) => void;
  submitEvidence: () => void;
  runInvestigation: () => void;
  inspect: (id: number) => void;
  setSelected: (id: number) => void;
  navigate: (v: ViewKey) => void;
};

/* ---------------- Dashboard ---------------- */
function Dashboard(s: Shared) {
  const open = s.disputes.filter((d) => ACTIVE(d.state)).length;
  const approved = s.disputes.filter((d) => d.state === "approved").length;
  const rejected = s.disputes.filter((d) => d.state === "rejected").length;
  const disputedMinor = s.disputes.reduce((sum, d) => sum + (s.txnById.get(d.transactionId)?.amountMinor ?? 0), 0);
  const recent = [...s.allEvents].sort((a, b) => b.seq - a.seq).slice(0, 7);

  const tiles = [
    { label: "Transactions", value: String(s.txns.length), tone: "info" },
    { label: "Open disputes", value: String(open), tone: "warning" },
    { label: "Approved", value: String(approved), tone: "success" },
    { label: "Rejected", value: String(rejected), tone: "danger" },
    { label: "Disputed value", value: zar(disputedMinor), tone: "accent", wide: true },
  ];

  return (
    <div className="stack">
      <div className="kpis">
        {tiles.map((t) => (
          <div className={`kpi kpi--${t.tone} ${t.wide ? "kpi--wide" : ""}`} key={t.label}>
            <div className="kpi__label">{t.label}</div>
            <div className="kpi__value">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="cols">
        <section className="card">
          <div className="card__title">Recent activity</div>
          {recent.length === 0 && <div className="empty">No activity yet — open a dispute to get started.</div>}
          <ul className="feed">
            {recent.map((e) => (
              <li key={e.seq} className="feed__item">
                <span className="feed__dot" />
                <span className="feed__text">
                  {e.detail.kind === "dispute-created"
                    ? `Dispute #${e.disputeId} created`
                    : `Dispute #${e.disputeId}: ${e.detail.event} (${nice(e.detail.from ?? "")} → ${nice(e.detail.to ?? "")})`}
                </span>
                <span className="feed__meta mono">actor {e.actorId}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card__title">Quick actions</div>
          <div className="quick">
            <button className="btn" onClick={() => s.navigate("transactions")}>Browse transactions</button>
            <button className="btn btn--ghost" onClick={() => s.navigate("disputes")}>Open the dispute queue</button>
            <button className="btn btn--ghost" onClick={() => s.navigate("audit")}>View the audit log</button>
          </div>
          <div className="note">
            Signed in as {s.identity.name} ({ROLE_LABELS[s.identity.role]}). Figures are advisory and computed from the
            demonstration store.
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Transactions ---------------- */
function TransactionsView(s: Shared) {
  return (
    <section className="card">
      <div className="card__title">Transactions</div>
      {s.txns.length === 0 && <div className="empty">No transactions visible for this role.</div>}
      <div className="table">
        {s.txns.map((tx) => (
          <div className="trow" key={tx.id}>
            <div className="trow__merch">
              <div className="trow__name">{tx.merchant}</div>
              <div className="trow__meta">{tx.category} · {tx.reason}</div>
            </div>
            <div className="trow__amount">{zar(tx.amountMinor)}</div>
            <button className="btn" disabled={s.busy} onClick={() => s.openDispute(tx)}>
              Open dispute
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Disputes queue + workspace ---------------- */
const STEPS = ["submitted", "under_review", "investigating", "decision"];
function Stepper({ state }: { state: string }) {
  const decided = state === "approved" || state === "rejected";
  const idx = decided ? 3 : Math.max(0, STEPS.indexOf(state === "evidence_required" || state === "evidence_received" ? "under_review" : state));
  return (
    <div className="stepper">
      {STEPS.map((st, i) => (
        <div key={st} className={`step ${i <= idx ? "step--done" : ""} ${i === idx ? "step--current" : ""}`}>
          <span className="step__dot">{i + 1}</span>
          <span className="step__label">{st === "decision" ? (decided ? state : "decision") : nice(st)}</span>
        </div>
      ))}
    </div>
  );
}

function DisputesView(s: Shared) {
  return (
    <div className="cols cols--queue">
      <section className="card">
        <div className="card__title">Dispute queue</div>
        {s.disputes.length === 0 && <div className="empty">No disputes yet — open one from Transactions.</div>}
        <div className="table">
          {s.disputes.map((d) => (
            <div className={`trow trow--click ${s.selected === d.id ? "trow--active" : ""}`} key={d.id}>
              <div className="trow__merch">
                <div className="trow__name">
                  Dispute #{d.id} <span className="mono">(tx {d.transactionId})</span>
                </div>
                <div className="trow__meta">{s.txnById.get(d.transactionId)?.merchant ?? "—"} · version {d.version}</div>
              </div>
              <span className={badgeClass(d.state)}>{nice(d.state)}</span>
              <button className="btn btn--ghost" onClick={() => s.setSelected(d.id)}>Inspect</button>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card__title">Case detail</div>
        {!s.selectedDispute && <div className="empty">Select a dispute to inspect its lifecycle, evidence and audit trail.</div>}
        {s.selectedDispute && <CaseWorkspace s={s} dispute={s.selectedDispute} />}
      </section>
    </div>
  );
}

function CaseWorkspace({ s, dispute }: { s: Shared; dispute: Dispute }) {
  const tx = s.txnById.get(dispute.transactionId);
  return (
    <>
      <Stepper state={dispute.state} />
      <div className="kv"><span>Merchant</span><b>{tx?.merchant ?? "—"}</b></div>
      <div className="kv"><span>Amount</span><b>{tx ? zar(tx.amountMinor) : "—"}</b></div>
      <div className="kv">
        <span>State</span>
        <b><span className={badgeClass(dispute.state)}>{nice(dispute.state)}</span></b>
      </div>
      <div className="kv"><span>Version</span><b>{dispute.version}</b></div>

      <div className="btnrow">
        {s.canActAsStaff ? (
          ANALYST_EVENTS.map((ev) => (
            <button key={ev} className="btn btn--ghost" disabled={s.busy} onClick={() => s.doTransition(ev)}>
              {nice(ev)}
            </button>
          ))
        ) : (
          <button className="btn btn--ghost" disabled={s.busy} onClick={() => s.doTransition("evidence_submitted")}>
            evidence submitted
          </button>
        )}
      </div>
      <div className="note">
        Transitions are role-gated and version-checked by the server. A customer can only submit evidence; sign in as an Analyst to
        drive the review. The server rejects invalid or stale changes.
      </div>

      <div className="btnrow" style={{ marginTop: 16 }}>
        <button className="btn" disabled={s.busy} onClick={s.submitEvidence}>Upload sample evidence</button>
        <button className="btn" disabled={s.busy} onClick={s.runInvestigation}>Run bounded investigation</button>
      </div>

      {s.investigation && (
        <div className="summary">
          <div className="summary__head">
            <span>{s.investigation.usedModel ? "Ollama model" : "Deterministic fallback"} · stage {s.investigation.stage}</span>
            <span>{s.investigation.observations} obs · {s.investigation.toolCalls} tool calls</span>
          </div>
          <div>{s.investigation.summary}</div>
          <ul className="trail">
            {s.investigation.history.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
          <div className="note">Advisory only — the investigation never changes the case or issues a refund.</div>
        </div>
      )}

      <div className="card__title" style={{ marginTop: 20 }}>Audit trail</div>
      <ul className="trail">
        {s.events.map((e) => (
          <li key={e.seq}>
            <span className="seq">#{e.seq}</span>
            {e.detail.kind === "dispute-created" ? `created (state ${e.detail.state})` : `${e.detail.event}: ${e.detail.from} → ${e.detail.to}`}
            <span className="mono"> · actor {e.actorId}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------- Investigations ---------------- */
function InvestigationsView(s: Shared) {
  return (
    <section className="card">
      <div className="card__title">Investigations</div>
      <div className="note" style={{ marginTop: 0 }}>
        The bounded investigation runs inside a case: an allowlisted, read-only loop with an iteration and tool-call budget enforced
        in application code, backed by a local Ollama model with a deterministic fallback. Open a case to run one.
      </div>
      {s.disputes.length === 0 && <div className="empty">No cases to investigate yet.</div>}
      <div className="table">
        {s.disputes.map((d) => (
          <div className="trow" key={d.id}>
            <div className="trow__merch">
              <div className="trow__name">Dispute #{d.id} <span className="mono">(tx {d.transactionId})</span></div>
              <div className="trow__meta">{s.txnById.get(d.transactionId)?.merchant ?? "—"}</div>
            </div>
            <span className={badgeClass(d.state)}>{nice(d.state)}</span>
            <button className="btn btn--ghost" onClick={() => s.inspect(d.id)}>Open in workspace</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Evidence ---------------- */
function EvidenceView(s: Shared) {
  return (
    <section className="card">
      <div className="card__title">Evidence</div>
      <div className="note" style={{ marginTop: 0 }}>
        Evidence is validated server-side (size, declared vs detected type, and a required clean scan) and attached to a case with a
        randomised storage name. Open a case to upload and review supporting documents.
      </div>
      {s.disputes.length === 0 && <div className="empty">No cases yet.</div>}
      <div className="table">
        {s.disputes.map((d) => (
          <div className="trow" key={d.id}>
            <div className="trow__merch">
              <div className="trow__name">Dispute #{d.id} <span className="mono">(tx {d.transactionId})</span></div>
              <div className="trow__meta">{s.txnById.get(d.transactionId)?.merchant ?? "—"}</div>
            </div>
            <button className="btn btn--ghost" onClick={() => s.inspect(d.id)}>Open case</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Audit ---------------- */
function AuditView(s: Shared) {
  const rows = [...s.allEvents].sort((a, b) => b.seq - a.seq);
  return (
    <section className="card">
      <div className="card__title">Audit log</div>
      {rows.length === 0 && <div className="empty">No audit events yet.</div>}
      <ul className="trail trail--full">
        {rows.map((e) => (
          <li key={e.seq}>
            <span className="seq">#{e.seq}</span>
            <span className="mono">D{e.disputeId}</span>{" "}
            {e.detail.kind === "dispute-created"
              ? `created (state ${e.detail.state})`
              : `${e.detail.event}: ${nice(e.detail.from ?? "")} → ${nice(e.detail.to ?? "")}`}
            <span className="mono"> · actor {e.actorId}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Settings ---------------- */
function SettingsView(s: Shared & { onSignOut: () => void }) {
  return (
    <section className="card card--narrow">
      <div className="card__title">Your profile</div>
      <div className="profile">
        <Avatar seed={s.identity.name} initials={s.identity.initials} size={64} />
        <div>
          <div className="profile__name">{s.identity.name}</div>
          <div className="profile__meta">
            <span className={`rolepill rolepill--${s.identity.role}`}>{ROLE_LABELS[s.identity.role]}</span>
            <span className="whoami__city">{s.identity.title} · {s.identity.city}</span>
          </div>
        </div>
      </div>
      <div className="kv"><span>User id</span><b className="mono">{s.identity.userId}</b></div>
      <div className="kv"><span>Role (RBAC)</span><b>{ROLE_LABELS[s.identity.role]}</b></div>
      <div className="kv"><span>Session</span><b>Passwordless demo persona</b></div>
      <div className="btnrow" style={{ marginTop: 16 }}>
        <button className="btn" onClick={s.onSignOut}>Sign out</button>
      </div>
      <div className="note">
        This is a demonstration identity. A real deployment would issue a verified session; the RBAC role here comes from the persona
        you signed in as. Back to the <a href="/">landing page</a>.
      </div>
    </section>
  );
}
