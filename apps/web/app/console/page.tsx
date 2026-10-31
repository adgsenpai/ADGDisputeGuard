"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./console.css";
import { Progress, useWorkspace, WorkspaceView } from "@/components/console/control-center";
import Avatar from "@/components/avatar";
import { availableEvents, type State, type Event } from "@/lib/domain/lifecycle";
import Login from "@/components/console/login";
import Shell, { NAV, type ViewKey } from "@/components/console/shell";
import { HBars, type Bar } from "@/components/console/charts";
import {
  loadIdentity,
  clearIdentity,
  authHeaders,
  type Identity,
} from "@/lib/identity";
import { ROLE_LABELS } from "@/lib/personas";
import { advisoryScore, riskBand } from "@/lib/risk-advisory";
import { reasonCode as lookupReasonCode, slaDaysRemaining } from "@/lib/chargeback";
import { makeT, loadLang, saveLang, type Lang, type T } from "@/lib/i18n";
import { loadTheme, saveTheme, applyTheme, type Theme } from "@/lib/theme";

const STATE_COLOR: Record<string, string> = {
  submitted: "var(--dg-state-submitted)",
  under_review: "var(--dg-state-under_review)",
  evidence_required: "var(--dg-state-evidence_required)",
  evidence_received: "var(--dg-state-evidence_received)",
  investigating: "var(--dg-state-investigating)",
  approved: "var(--dg-state-approved)",
  rejected: "var(--dg-state-rejected)",
};

type Txn = { id: number; ownerId?: number; merchant: string; category: string; amountMinor: number; reason: string };
type Dispute = { id: number; transactionId: number; state: State; version: number };
type AuditEvent = { seq: number; disputeId?: number; actorId: number; detail: { kind: string; from?: string; to?: string; event?: string; state?: string } };
type Investigation = { usedModel: boolean; summary: string; stage: string; observations: number; toolCalls: number; history: string[] };
type EvidenceRec = { seq: number; disputeId: number; actorId: number; storageName: string; sizeBytes: number; detectedType: string };
type InvRec = { seq: number; disputeId: number; usedModel: boolean; summary: string; stage: string; observations: number; toolCalls: number };

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
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => setIdentity(data.identity)).catch(() => setIdentity(null)).finally(() => setReady(true));
    setLang(loadLang());
    const th = loadTheme();
    setTheme(th);
    applyTheme(th);
  }, []);

  const t = useMemo(() => makeT(lang), [lang]);
  const onLang = useCallback((l: Lang) => {
    setLang(l);
    saveLang(l);
  }, []);
  const onToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      saveTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  if (!ready) return <main className="console--loading"><Progress label="Restoring your secure session…" /></main>;
  if (!identity) return <Login onSignedIn={setIdentity} t={t} lang={lang} onLang={onLang} />;

  return (
    <ConsoleApp
      key={identity.userId}
      identity={identity}
      t={t}
      lang={lang}
      onLang={onLang}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onSignOut={() => {
        fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) }).finally(() => { clearIdentity(); setIdentity(null); });
      }}
    />
  );
}

/* ---------------- app ---------------- */
function ConsoleApp({
  identity,
  onSignOut,
  t,
  lang,
  onLang,
  theme,
  onToggleTheme,
}: {
  identity: Identity;
  onSignOut: () => void;
  t: T;
  lang: Lang;
  onLang: (l: Lang) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [allEvents, setAllEvents] = useState<AuditEvent[]>([]);
  const [auditVerify, setAuditVerify] = useState<{ valid: boolean; length: number; head: string; brokenAt?: number } | null>(null);
  const [evidenceLog, setEvidenceLog] = useState<EvidenceRec[]>([]);
  const [investigationsLog, setInvestigationsLog] = useState<InvRec[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [meta, setMeta] = useState<{ openedAt: number; reasonCode: string } | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const workspace = useWorkspace(identity);

  const headers = useMemo(() => authHeaders(identity), [identity]);
  const txnById = useMemo(() => new Map(txns.map((t) => [t.id, t])), [txns]);

  // hash-based deep linking (#dashboard, #disputes, ...)
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "") as ViewKey;
      if (NAV.some((n) => n.key === h && (!n.roles || n.roles.includes(identity.role)))) setView(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [identity.role]);
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
    try {
      const v = await (await fetch("/api/audit/verify", { headers })).json();
      setAuditVerify(v);
    } catch {
      setAuditVerify(null);
    }
  }, [headers]);
  const loadEvidence = useCallback(async () => {
    const res = await fetch("/api/evidence", { headers });
    setEvidenceLog((await res.json()).evidence ?? []);
  }, [headers]);
  const loadInvestigations = useCallback(async () => {
    const res = await fetch("/api/investigations", { headers });
    setInvestigationsLog((await res.json()).investigations ?? []);
  }, [headers]);
  const loadDetail = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/disputes/${id}`, { headers });
      const data = await res.json();
      setEvents(data.events ?? []);
      setMeta(data.meta ?? null);
      if (data.dispute) setDisputes(current => current.map(dispute => dispute.id === id ? data.dispute : dispute));
    },
    [headers],
  );

  useEffect(() => {
    Promise.all([loadTxns(), loadDisputes(), loadAudit(), loadEvidence(), loadInvestigations()]).catch(() => flash("err", "Some workspace data could not load. Refresh to retry.")).finally(() => setInitialLoading(false));
  }, [loadTxns, loadDisputes, loadAudit, loadEvidence, loadInvestigations, flash]);

  useEffect(() => {
    if (selected !== null) {
      loadDetail(selected);
      setInvestigation(null);
    }
  }, [selected, loadDetail]);

  const selectedDispute = disputes.find((d) => d.id === selected) ?? null;

  async function openDispute(tx: Txn) {
    if (busy) return;
    setBusy(true);
    setBusyLabel("Submitting your dispute and updating the case timeline…");
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
        navigate("disputes");
        void workspace.refresh();
      }
    } catch {
      flash("err", "The request could not complete. Please check your connection and try again.");
    } finally {
      setBusy(false);
      void workspace.refresh();
    }
  }
  async function doTransition(event: Event) {
    if (!selectedDispute || busy) return;
    if (!availableEvents(selectedDispute.state, identity.role).includes(event)) {
      flash("err", `This action is unavailable while the case is ${nice(selectedDispute.state)}.`);
      return;
    }
    setBusy(true);
    setBusyLabel("Saving the case update…");
    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/transition`, {
        method: "POST",
        headers,
        body: JSON.stringify({ event, expectedVersion: selectedDispute.version }),
      });
      const data = await res.json();
      if (!res.ok) flash("err", data.message ?? `Transition refused: ${data.error}`);
      else flash("ok", `Moved to ${data.dispute.state}.`);
      await Promise.all([loadDisputes(), loadDetail(selectedDispute.id), loadAudit()]);
    } catch {
      flash("err", "The request could not complete. Please check your connection and try again.");
    } finally {
      setBusy(false);
      void workspace.refresh();
    }
  }
  async function submitEvidence(file: File) {
    if (!selectedDispute || busy) return;
    setBusy(true); setBusyLabel("Uploading evidence and updating the attachment register…");
    try {
      const form = new FormData(); form.set("file", file);
      const res = await fetch(`/api/disputes/${selectedDispute.id}/evidence`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) flash("err", data.error);
      else { flash("ok", data.message); await loadEvidence(); }
    } catch { flash("err", "Evidence upload failed. Please try again."); }
    finally { setBusy(false); void workspace.refresh(); }
  }
  async function runInvestigation() {
    if (!selectedDispute) return;
    setBusy(true);
    setBusyLabel("Investigating the case: reviewing payment, evidence and risk signals…");
    setInvestigation(null);
    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/investigate`, { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) flash("err", `Investigation failed: ${data.error}`);
      else {
        setInvestigation(data);
        await loadInvestigations();
      }
    } catch {
      flash("err", "The request could not complete. Please check your connection and try again.");
    } finally {
      setBusy(false);
      void workspace.refresh();
    }
  }

  function inspect(id: number) {
    setSelected(id);
    navigate("disputes");
  }

  const canActAsStaff = identity.role === "analyst" || identity.role === "admin";
  const badges = { notifications: workspace.data?.notifications.filter(n => !n.read).length, disputes: disputes.filter((d) => ACTIVE(d.state)).length || undefined };

  const shared = {
    identity,
    t,
    txns,
    disputes,
    allEvents,
    auditVerify,
    evidenceLog,
    investigationsLog,
    events,
    meta,
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
    <Shell identity={identity} view={view} onNavigate={navigate} onSignOut={onSignOut} badges={badges} t={t} lang={lang} onLang={onLang} theme={theme} onToggleTheme={onToggleTheme}>
      {toast && <div role="status" className={`toast toast--${toast.kind}`}>{toast.text}</div>}
      {(busy || initialLoading) && <Progress label={busy ? busyLabel : "Loading your payments, cases and activity…"} />}
      {["statement", "notifications", "assistant", "monitoring", "users"].includes(view) && <WorkspaceView view={view} identity={identity} workspace={workspace} inspect={inspect} openDispute={openDispute} onNavigate={navigate} />}
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
  t: T;
  txns: Txn[];
  disputes: Dispute[];
  allEvents: AuditEvent[];
  auditVerify: { valid: boolean; length: number; head: string; brokenAt?: number } | null;
  evidenceLog: EvidenceRec[];
  investigationsLog: InvRec[];
  events: AuditEvent[];
  meta: { openedAt: number; reasonCode: string } | null;
  txnById: Map<number, Txn>;
  selected: number | null;
  selectedDispute: Dispute | null;
  investigation: Investigation | null;
  busy: boolean;
  canActAsStaff: boolean;
  openDispute: (t: Txn) => void;
  doTransition: (e: Event) => void;
  submitEvidence: (file: File) => void;
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

  // Charts are computed over disputes whose transaction is visible to the user.
  const known = s.disputes.filter((d) => s.txnById.has(d.transactionId));

  const stateCounts = new Map<string, number>();
  for (const d of s.disputes) stateCounts.set(d.state, (stateCounts.get(d.state) ?? 0) + 1);
  const stateBars: Bar[] = [...stateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => ({ label: nice(state), value: count, color: STATE_COLOR[state] }));

  const catTotals = new Map<string, number>();
  for (const d of known) {
    const tx = s.txnById.get(d.transactionId)!;
    catTotals.set(tx.category, (catTotals.get(tx.category) ?? 0) + tx.amountMinor);
  }
  const categoryBars: Bar[] = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, minor]) => ({ label: cat, value: minor, display: zar(minor), color: "var(--dg-accent)" }));

  const bands = { low: 0, medium: 0, high: 0 };
  const scores: number[] = [];
  for (const d of known) {
    const score = advisoryScore(s.txnById.get(d.transactionId)!.amountMinor);
    if (score === null) continue;
    scores.push(score);
    bands[riskBand(score)] += 1;
  }
  const riskBars: Bar[] = [
    { label: "Low", value: bands.low, color: "var(--dg-success)" },
    { label: "Medium", value: bands.medium, color: "var(--dg-warning)" },
    { label: "High", value: bands.high, color: "var(--dg-danger)" },
  ];
  const avgRisk = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;

  const tiles = [
    { k: "kpi.transactions", value: String(s.txns.length), tone: "info" },
    { k: "kpi.open", value: String(open), tone: "warning" },
    { k: "kpi.approved", value: String(approved), tone: "success" },
    { k: "kpi.rejected", value: String(rejected), tone: "danger" },
    { k: "kpi.avgrisk", value: avgRisk === null ? "—" : `${avgRisk}%`, tone: "violet" },
    { k: "kpi.disputed", value: zar(disputedMinor), tone: "accent", wide: true },
  ];

  return (
    <div className="stack">
      <div className="kpis">
        {tiles.map((tile) => (
          <div className={`kpi kpi--${tile.tone} ${tile.wide ? "kpi--wide" : ""}`} key={tile.k}>
            <div className="kpi__label">{s.t(tile.k)}</div>
            <div className="kpi__value">{tile.value}</div>
          </div>
        ))}
      </div>

      <div className="cols cols--charts">
        <section className="card">
          <div className="card__title">Disputes by state</div>
          <HBars bars={stateBars} ariaLabel="Disputes by state" />
        </section>
        <section className="card">
          <div className="card__title">Disputed value by category</div>
          <HBars bars={categoryBars} ariaLabel="Disputed value by category" formatValue={(n) => zar(n)} />
        </section>
        <section className="card">
          <div className="card__title">Risk distribution</div>
          <HBars bars={riskBars} ariaLabel="Advisory risk distribution" />
        </section>
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
function RiskChip({ amountMinor }: { amountMinor: number }) {
  const score = advisoryScore(amountMinor);
  if (score === null) return null;
  const band = riskBand(score);
  return <span className={`riskchip riskchip--${band}`}>{band} risk · {Math.round(score * 100)}%</span>;
}

function TransactionsView(s: Shared) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(s.txns.map((t) => t.category))].sort(),
    [s.txns],
  );
  const q = query.trim().toLowerCase();
  const rows = s.txns.filter((t) => {
    if (category && t.category !== category) return false;
    if (!q) return true;
    return `${t.merchant} ${t.category} ${t.reason}`.toLowerCase().includes(q);
  });

  return (
    <section className="card">
      <div className="toolbar">
        <div className="searchfield">
          <input
            type="text"
            placeholder="Search transactions…"
            aria-label="Search transactions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chips">
          <button className={`chip ${category === null ? "chip--on" : ""}`} onClick={() => setCategory(null)}>All</button>
          {categories.map((c) => (
            <button key={c} className={`chip ${category === c ? "chip--on" : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 && <div className="empty">No matching transactions.</div>}
      <div className="table">
        {rows.map((tx) => (
          <div className="trow trow--tx" key={tx.id}>
            <div className="trow__merch">
              <div className="trow__name">{tx.merchant}</div>
              <div className="trow__meta">{tx.category} · {tx.reason}</div>
            </div>
            <RiskChip amountMinor={tx.amountMinor} />
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

const QUEUE_FILTERS: { key: string; label: string; match: (state: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Open", match: (st) => ACTIVE(st) },
  { key: "approved", label: "Approved", match: (st) => st === "approved" },
  { key: "rejected", label: "Rejected", match: (st) => st === "rejected" },
];

function DisputesView(s: Shared) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const active = QUEUE_FILTERS.find((f) => f.key === filter) ?? QUEUE_FILTERS[0];
  const q = query.trim().toLowerCase();

  const rows = s.disputes.filter((d) => {
    if (!active.match(d.state)) return false;
    if (!q) return true;
    const merchant = s.txnById.get(d.transactionId)?.merchant ?? "";
    return `#${d.id} tx ${d.transactionId} ${merchant} ${d.state}`.toLowerCase().includes(q);
  });

  return (
    <div className="cols cols--queue">
      <section className="card">
        <div className="card__title">Dispute queue</div>
        <div className="toolbar">
          <div className="searchfield">
            <input
              type="text"
              placeholder="Search disputes…"
              aria-label="Search disputes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {QUEUE_FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? "chip--on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {s.disputes.length === 0 && <div className="empty">No disputes yet — open one from Transactions.</div>}
        {s.disputes.length > 0 && rows.length === 0 && <div className="empty">No disputes match this filter.</div>}
        <div className="table">
          {rows.map((d) => (
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

function ReasonCodePanel({ meta, state, amountMinor }: { meta: { openedAt: number; reasonCode: string }; state: string; amountMinor: number }) {
  const rc = lookupReasonCode(meta.reasonCode);
  if (!rc) return null;
  const active = ACTIVE(state);
  const left = slaDaysRemaining(meta.openedAt, meta.reasonCode, Date.now());
  const slaTone = left === null ? "" : left < 0 ? "sla--over" : left <= 5 ? "sla--warn" : "sla--ok";
  const slaText = left === null ? "—" : left < 0 ? `SLA overdue by ${Math.abs(left)} day(s)` : `SLA: ${left} day(s) left`;

  return (
    <div className="reasonbox">
      <div className="reasonbox__head">
        <span className="codepill">{rc.scheme} · {rc.code}</span>
        <span className={`sla ${slaTone}`}>{active ? slaText : "Resolved"}</span>
      </div>
      <div className="reasonbox__title">{rc.title}</div>
      <div className="reasonbox__desc">{rc.description}</div>

      {rc.provisionalCredit && active && (
        <div className="provcredit">
          Provisional credit issued: <b>{zar(amountMinor)}</b> <span className="mono">· pending investigation</span>
        </div>
      )}

      <div className="reasonbox__evlabel">Evidence required</div>
      <ul className="evlist">
        {rc.requiredEvidence.map((e) => (
          <li key={e}><span className="evlist__tick">✓</span>{e}</li>
        ))}
      </ul>
    </div>
  );
}

async function downloadReport(id: number, identity: Identity) {
  const res = await fetch(`/api/disputes/${id}/report`, {
    headers: { "x-user-id": String(identity.userId), "x-user-role": identity.role },
  });
  if (!res.ok) throw new Error("The report could not be generated. Please try again.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `disputeguard-case-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ReportDownload({ id, identity }: { id: number; identity: Identity }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div><button className="btn btn--ghost" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try { await downloadReport(id, identity); } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); }
    finally { setBusy(false); }
  }}>{busy ? "Preparing report…" : "Download case report"}</button>{busy && <Progress label="Building the branded report and attaching evidence…" />}{error && <p role="alert">{error}</p>}</div>;
}

function CaseWorkspace({ s, dispute }: { s: Shared; dispute: Dispute }) {
  const actions = availableEvents(dispute.state, s.identity.role);
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
      {tx && (
        <div className="kv">
          <span>Advisory risk</span>
          <b><RiskChip amountMinor={tx.amountMinor} /></b>
        </div>
      )}
      <div className="kv"><span>Version</span><b>{dispute.version}</b></div>

      {s.meta && <ReasonCodePanel meta={s.meta} state={dispute.state} amountMinor={tx?.amountMinor ?? 0} />}

      <div className="btnrow" aria-label="Available case actions">
        {actions.map(event => (
          <button key={event} className="btn btn--ghost" disabled={s.busy} onClick={() => s.doTransition(event)}>
            {nice(event)}
          </button>
        ))}
      </div>
      <div className="note">
        {actions.length > 0
          ? "These actions are available for your role and the current case state. Each update is checked by the server."
          : !ACTIVE(dispute.state)
            ? "This case is closed. No further state changes are available."
            : "This case is awaiting an analyst’s next action. You can still attach supporting evidence."}
      </div>

      <div className="btnrow" style={{ marginTop: 16 }}>
        <label className="btn" style={{ cursor: s.busy ? "wait" : "pointer" }}>Attach evidence<input aria-label="Upload evidence file" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={s.busy} style={{ maxWidth: 200 }} onChange={e => { const file = e.target.files?.[0]; if (file) s.submitEvidence(file); e.target.value = ""; }} /></label>
        <button className="btn" disabled={s.busy} onClick={s.runInvestigation}>Run bounded investigation</button>
        <ReportDownload id={dispute.id} identity={s.identity} />
      </div>

      <div className="note">PDF, PNG or JPEG, up to 5 MB each. Files are format-checked; malware scanning is not configured.</div>
      {s.evidenceLog.filter(e => e.disputeId === dispute.id).map(e => <div className="kv" key={e.seq}><span>Evidence #{e.seq} · {e.detectedType} · {Math.ceil(e.sizeBytes / 1024)} KB</span><a className="btn" href={`/api/attachments/${e.storageName}`}>Download file</a></div>)}
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
  const runs = [...s.investigationsLog].sort((a, b) => b.seq - a.seq);
  return (
    <div className="stack">
      <section className="card">
        <div className="card__title">Recent investigations</div>
        <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
          Each run is an allowlisted, read-only loop with an iteration and tool-call budget enforced in application code, backed by a
          local Ollama model with a deterministic fallback.
        </div>
        {runs.length === 0 && <div className="empty">No investigations run yet — open a case and run one.</div>}
        <div className="table">
          {runs.map((r) => (
            <div className="trow trow--tx" key={r.seq}>
              <div className="trow__merch">
                <div className="trow__name">
                  Dispute #{r.disputeId} <span className="mono">· stage {r.stage}</span>
                </div>
                <div className="trow__meta">{r.summary}</div>
              </div>
              <span className={`riskchip ${r.usedModel ? "riskchip--medium" : "riskchip--low"}`}>
                {r.usedModel ? "model" : "fallback"}
              </span>
              <span className="mono">{r.observations} obs · {r.toolCalls} calls</span>
              <button className="btn btn--ghost" onClick={() => s.inspect(r.disputeId)}>Open case</button>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card__title">Launch an investigation</div>
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
    </div>
  );
}

/* ---------------- Evidence ---------------- */
function kb(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}
function EvidenceView(s: Shared) {
  const rows = [...s.evidenceLog].sort((a, b) => b.seq - a.seq);
  return (
    <section className="card">
      <div className="card__title">Evidence register</div>
      <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
        Evidence is validated server-side (size, declared vs detected type, and a required clean scan) and stored under a randomised
        name. Open a case to upload supporting documents.
      </div>
      {rows.length === 0 && <div className="empty">No evidence uploaded yet.</div>}
      <div className="table">
        {rows.map((e) => (
          <div className="trow trow--tx" key={e.seq}>
            <div className="trow__merch">
              <div className="trow__name">
                Dispute #{e.disputeId} <span className="mono">· {e.storageName}</span>
              </div>
              <div className="trow__meta">{s.txnById.get(s.disputes.find((d) => d.id === e.disputeId)?.transactionId ?? -1)?.merchant ?? "—"}</div>
            </div>
            <span className="riskchip riskchip--low">{e.detectedType}</span>
            <span className="mono">{kb(e.sizeBytes)}</span>
            <button className="btn btn--ghost" onClick={() => s.inspect(e.disputeId)}>Open case</button>
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
      {s.auditVerify && (
        <div className={`integrity ${s.auditVerify.valid ? "integrity--ok" : "integrity--bad"}`}>
          <span className="integrity__mark">{s.auditVerify.valid ? "✓" : "⚠"}</span>
          {s.auditVerify.valid
            ? `Integrity verified — hash chain intact`
            : `Tamper detected at event #${s.auditVerify.brokenAt}`}
          <span className="integrity__meta mono">
            {s.auditVerify.length} events · SHA-256 head {s.auditVerify.head.slice(0, 12)}…
          </span>
        </div>
      )}
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
