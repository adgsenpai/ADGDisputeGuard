"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./console.css";

type Txn = {
  id: number;
  merchant: string;
  category: string;
  amountMinor: number;
  reason: string;
};
type Dispute = { id: number; transactionId: number; state: string; version: number };
type AuditEvent = { seq: number; actorId: number; detail: { kind: string; from?: string; to?: string; event?: string; state?: string } };
type Investigation = { usedModel: boolean; summary: string; stage: string; observations: number; toolCalls: number; history: string[] };

const USERS = [
  { id: "1", role: "customer", label: "Customer (you)" },
  { id: "9", role: "analyst", label: "Analyst" },
  { id: "99", role: "admin", label: "Admin" },
];

const ANALYST_EVENTS = ["begin_review", "request_evidence", "begin_investigation", "approve", "reject"];

function rand(amountMinor: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amountMinor / 100);
}

function stateBadgeClass(state: string) {
  if (state === "approved") return "badge badge--approved";
  if (state === "rejected") return "badge badge--rejected";
  return "badge badge--active";
}

export default function ConsolePage() {
  const [userId, setUserId] = useState("1");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const user = useMemo(() => USERS.find((u) => u.id === userId)!, [userId]);
  const headers = useMemo(
    () => ({ "content-type": "application/json", "x-user-id": user.id, "x-user-role": user.role }),
    [user],
  );

  const flash = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadTxns = useCallback(async () => {
    const res = await fetch("/api/transactions", { headers });
    const data = await res.json();
    setTxns(data.transactions ?? []);
  }, [headers]);

  const loadDisputes = useCallback(async () => {
    const res = await fetch("/api/disputes", { headers });
    const data = await res.json();
    setDisputes(data.disputes ?? []);
  }, [headers]);

  const loadDetail = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/disputes/${id}`, { headers });
      const data = await res.json();
      setEvents(data.events ?? []);
    },
    [headers],
  );

  useEffect(() => {
    loadTxns();
    loadDisputes();
  }, [loadTxns, loadDisputes]);

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
      if (!res.ok) {
        flash("err", `Could not open dispute: ${data.error}`);
      } else {
        flash("ok", data.replayed ? "Existing dispute returned (idempotent)." : `Dispute #${data.dispute.id} opened.`);
        await loadDisputes();
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
      await loadDisputes();
      await loadDetail(selectedDispute.id);
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

  const canActAsStaff = user.role === "analyst" || user.role === "admin";

  return (
    <main className="console">
      <header className="console__head">
        <div>
          <div className="console__title">DisputeGuard Console</div>
          <div className="console__sub">
            Reference flows: ownership, idempotent creation, authorised transitions, evidence, and a bounded AI investigation.
          </div>
        </div>
        <div className="roleswitch">
          <label htmlFor="role">Acting as</label>
          <select id="role" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.text}</div>}

      <div className="grid">
        <section className="panel">
          <div className="panel__title">Transactions</div>
          {txns.length === 0 && <div className="empty">No transactions visible for this role.</div>}
          {txns.map((tx) => (
            <div className="row" key={tx.id}>
              <div className="row__main">
                <div className="row__merchant">{tx.merchant}</div>
                <div className="row__meta">
                  {tx.category} · {tx.reason}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="amount">{rand(tx.amountMinor)}</div>
                <div className="btnrow" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" disabled={busy} onClick={() => openDispute(tx)}>
                    Open dispute
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="panel__title" style={{ marginTop: 24 }}>
            Disputes
          </div>
          {disputes.length === 0 && <div className="empty">No disputes yet — open one above.</div>}
          {disputes.map((d) => (
            <div className="row" key={d.id}>
              <div className="row__main">
                <div className="row__merchant">
                  Dispute #{d.id} <span className="mono">(tx {d.transactionId})</span>
                </div>
                <div className="row__meta">version {d.version}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className={stateBadgeClass(d.state)}>{d.state.replace(/_/g, " ")}</span>
                <button className="btn btn--ghost" onClick={() => setSelected(d.id)}>
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__title">Case detail</div>
          {!selectedDispute && <div className="empty">Select a dispute to inspect its lifecycle, audit trail and risk.</div>}
          {selectedDispute && (
            <>
              <div className="kv">
                <span>State</span>
                <b>
                  <span className={stateBadgeClass(selectedDispute.state)}>{selectedDispute.state.replace(/_/g, " ")}</span>
                </b>
              </div>
              <div className="kv">
                <span>Version</span>
                <b>{selectedDispute.version}</b>
              </div>

              <div className="btnrow">
                {canActAsStaff ? (
                  ANALYST_EVENTS.map((ev) => (
                    <button key={ev} className="btn btn--ghost" disabled={busy} onClick={() => doTransition(ev)}>
                      {ev.replace(/_/g, " ")}
                    </button>
                  ))
                ) : (
                  <button className="btn btn--ghost" disabled={busy} onClick={() => doTransition("evidence_submitted")}>
                    evidence submitted
                  </button>
                )}
              </div>
              <div className="note">
                Transitions are role-gated and version-checked by the server. As a customer you can only submit evidence; switch to
                Analyst to drive the review. The server rejects invalid or stale changes.
              </div>

              <div className="btnrow" style={{ marginTop: 16 }}>
                <button className="btn" disabled={busy} onClick={submitEvidence}>
                  Upload sample evidence
                </button>
                <button className="btn" disabled={busy} onClick={runInvestigation}>
                  Run bounded investigation
                </button>
              </div>

              {investigation && (
                <div className="summary">
                  <div className="summary__head">
                    <span>
                      {investigation.usedModel ? "Ollama model" : "Deterministic fallback"} · stage {investigation.stage}
                    </span>
                    <span>
                      {investigation.observations} obs · {investigation.toolCalls} tool calls
                    </span>
                  </div>
                  <div>{investigation.summary}</div>
                  <ul className="trail">
                    {investigation.history.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                  <div className="note">Advisory only — the investigation never changes the case or issues a refund.</div>
                </div>
              )}

              <div className="panel__title" style={{ marginTop: 20 }}>
                Audit trail
              </div>
              <ul className="trail">
                {events.map((e) => (
                  <li key={e.seq}>
                    <span className="seq">#{e.seq}</span>
                    {e.detail.kind === "dispute-created"
                      ? `created (state ${e.detail.state})`
                      : `${e.detail.event}: ${e.detail.from} → ${e.detail.to}`}
                    <span className="mono"> · actor {e.actorId}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <p className="note">
        Demonstration data and flows. Risk indicators are advisory and never decide a dispute. Back to the{" "}
        <a href="/">landing page</a>.
      </p>
    </main>
  );
}
