"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Bell, CheckCircle2, FileText, LoaderCircle, Mail, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, Users } from "lucide-react";
import type { ControlCenter } from "@/lib/control/service";
import type { Finding } from "@/lib/control/monitoring";
import type { Identity } from "@/lib/identity";
import type { ViewKey } from "./shell";
import "./control-center.css";
export type Workspace = ReturnType<ControlCenter["snapshot"]>;
const money = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(n / 100);
const when = (s: string | null) => s ? new Date(s).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "Not yet";
export function Progress({ label }: { label: string }) { return <div className="work-progress" role="status" aria-live="polite"><LoaderCircle className="spinner" size={19} /><span>{label}</span><span className="work-progress__track" aria-hidden="true" /></div>; }
export function useWorkspace(identity: Identity) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace"); const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Workspace unavailable.");
      if (mounted.current) { setData(json); setError(""); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Unable to refresh."); }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); const timer = setInterval(refresh, 10000); return () => { mounted.current = false; clearInterval(timer); }; }, [refresh, identity.userId]);
  async function action(body: Record<string, unknown>, label: string) {
    setBusy(label); setError("");
    try {
      const res = await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || "Could not finish this action.");
      if (json.statement) setData(json);
      return json;
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); return null; }
    finally { setBusy(""); }
  }
  return { data, error, busy, action, refresh };
}
export type WorkspaceHook = ReturnType<typeof useWorkspace>;
export function NotificationBell({ count, onClick }: { count: number; onClick: () => void }) {
  return <button className="notification-bell" onClick={onClick} aria-label={`Notifications, ${count} unread`}><Bell size={19} />{count > 0 && <span>{count > 99 ? "99+" : count}</span>}</button>;
}
export function WorkspaceView({ view, identity, workspace: w, inspect, openDispute, onNavigate }: { view: ViewKey; identity: Identity; workspace: WorkspaceHook; inspect: (id: number) => void; openDispute: (tx: Workspace["statement"][number]) => void; onNavigate: (view: ViewKey) => void }) {
  return <div className="control-center">
    {w.error && <div className="control-error" role="alert">{w.error} <button className="btn" onClick={w.refresh}>Retry refresh</button></div>}
    {w.busy && <Progress label={w.busy} />}
    {!w.data ? <Progress label="Loading your workspace…" /> : <>
      {view === "statement" && <Statement identity={identity} w={w} openDispute={openDispute} inspect={inspect} onNavigate={onNavigate} />}
      {view === "notifications" && <Notifications w={w} inspect={inspect} onNavigate={onNavigate} />}
      {view === "monitoring" && identity.role === "admin" && <Monitoring w={w} />}
      {view === "assistant" && <Assistant data={w.data} inspect={inspect} />}
      {view === "users" && identity.role === "admin" && <UsersPanel identity={identity} />}
    </>}
  </div>;
}
function Findings({ findings }: { findings: Finding[] }) {
  return <div className="finding-list">{findings.map(f => <article className="finding" key={f.transactionId}><span className="review-dot" /><div><strong>{f.merchant} <small>#{f.transactionId}</small></strong><p>{money(f.amountMinor)} · Review suggested</p>{f.reasons.map(r => <p key={r}>{r}</p>)}</div></article>)}</div>;
}
function Statement({ identity, w, openDispute, inspect, onNavigate }: { identity: Identity; w: WorkspaceHook; openDispute: (tx: Workspace["statement"][number]) => void; inspect: (id: number) => void; onNavigate: (view: ViewKey) => void }) {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [filter, setFilter] = useState("");
  const [review, setReview] = useState<Workspace["statement"][number] | null>(null);
  const [reason, setReason] = useState("");
  const data = w.data!;
  const rows = data.statement.filter(t => `${t.merchant} ${t.id} ${t.ownerId}`.toLowerCase().includes(filter.toLowerCase()));
  return <>
    <div className="control-hero"><div className="control-eyebrow"><FileText size={16} /> YOUR MONEY, CLEARER</div><h2>A clearer view of every payment.</h2><p>Check your statement, understand a payment and get help when something looks wrong.</p><div className="control-actions"><button className="btn btn--primary" disabled={!!w.busy} onClick={async () => { const result = await w.action({ action: "check" }, "Checking payment patterns and possible duplicates…"); if (result) setFindings(result.findings); }}><ShieldCheck size={17} /> Check for possible disputes</button><button className="btn" onClick={() => onNavigate("assistant")}><MessageCircle size={17} /> Ask the assistant</button></div><small>Sample bank statement · Workspace refreshes every 10 seconds · No bank connection</small></div>
    <div className="control-stats"><div><span>Payments visible</span><strong>{data.statement.length}</strong></div><div><span>Total debits</span><strong>{money(data.statement.reduce((s, t) => s + t.amountMinor, 0))}</strong></div><div><span>Last workspace refresh</span><strong className="stat-time">{when(data.refreshedAt)}</strong></div></div>
    {findings && <section className="card"><div className="control-heading"><h3>{findings.length ? `${findings.length} payments worth a closer look` : "Check complete"}</h3><CheckCircle2 size={20} /></div><p className="control-muted">These flags suggest review. They do not establish fraud or automatically open a dispute.</p>{findings.length ? <Findings findings={findings} /> : <p>No configured rule was triggered. You can still dispute a payment that looks wrong.</p>}</section>}
    {review && <section className="card review-form"><h3>Tell us about {review.merchant}</h3><p>{money(review.amountMinor)} · Payment #{review.id}</p><label>What went wrong?<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} placeholder="Describe the issue with this payment" /></label><div className="control-actions"><button className="btn btn--primary" disabled={!!w.busy || reason.trim().length < 5} onClick={() => { openDispute({ ...review, reason: reason.trim() }); setReview(null); }}>Submit dispute</button><button className="btn" onClick={() => setReview(null)}>Cancel</button></div></section>}
    <section className="card"><div className="control-heading"><h3>Statement activity</h3><button className="btn" onClick={w.refresh}><RefreshCw size={15} /> Refresh</button></div><label className="control-search">Search payments<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Merchant or payment number" /></label><div className="statement-table"><table><thead><tr><th>Booked</th><th>Payment</th>{identity.role !== "customer" && <th>Customer</th>}<th>Debit</th><th>Next step</th></tr></thead><tbody>{rows.map(tx => { const dispute = data.disputes.find(d => d.transactionId === tx.id && !["approved", "rejected"].includes(d.state)); return <tr key={tx.id}><td>{new Date(tx.bookedAt).toLocaleDateString("en-ZA")}</td><td><strong>{tx.merchant}</strong><small>{tx.category} · #{tx.id}</small></td>{identity.role !== "customer" && <td>#{tx.ownerId}</td>}<td className="amount">{money(tx.amountMinor)}</td><td>{dispute ? <button className="btn" onClick={() => inspect(dispute.id)}>View case #{dispute.id}</button> : identity.userId === tx.ownerId ? <button className="btn" onClick={() => { setReview(tx); setReason(""); }}>Review payment</button> : <span className="control-muted">No open case</span>}</td></tr>; })}</tbody></table></div>{!rows.length && <div className="empty">No payments yet. Newly onboarded accounts start with an empty statement.</div>}</section>
  </>;
}
function Notifications({ w, inspect, onNavigate }: { w: WorkspaceHook; inspect: (id: number) => void; onNavigate: (view: ViewKey) => void }) {
  const data = w.data!;
  const [email, setEmail] = useState(data.preference.email);
  const [enabled, setEnabled] = useState(data.preference.enabled);
  const [saved, setSaved] = useState("");
  return <>
    <div className="control-hero control-hero--compact"><div className="control-eyebrow"><Bell size={16} /> STAY IN THE LOOP</div><h2>Your updates, in one place.</h2><p>Case progress, evidence updates and payments that need your attention.</p></div>
    <div className="control-columns"><section className="card"><div className="control-heading"><h3>Activity inbox</h3><button className="btn" disabled={!!w.busy || !data.notifications.some(n => !n.read)} onClick={() => w.action({ action: "read" }, "Marking notifications as read…")}>Mark all read</button></div>{!data.notifications.length && <div className="empty"><Bell size={30} /><p>You're all caught up. Your next case or monitoring update will appear here.</p></div>}{data.notifications.map(n => <article className={`notice ${n.read ? "" : "notice--unread"}`} key={n.id}><div><strong>{n.title}</strong><p>{n.body}</p><small>{when(n.createdAt)}</small></div><button className="btn" onClick={async () => { await w.action({ action: "read", id: n.id }, "Opening update…"); if (n.disputeId) inspect(n.disputeId); else onNavigate("statement"); }}>View</button></article>)}</section>
    <section className="card"><div className="control-heading"><h3>Email preferences</h3><Mail size={19} /></div><p className="control-muted">{data.emailMode === "preview" ? "Preview mode: emails stay in this inbox. No email is sent externally." : "SMTP is enabled. Opted-in updates will be sent to the address you save."}</p><form className="control-form" onSubmit={async e => { e.preventDefault(); const result = await w.action({ action: "preferences", email, enabled }, "Saving email preferences…"); if (result) setSaved("Preferences saved."); }}><label>Email address<input type="email" value={email} onChange={e => { setEmail(e.target.value); setSaved(""); }} placeholder="you@example.com" required={enabled} /></label><label className="control-check"><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setSaved(""); }} /> Email me about case and review updates</label><button className="btn btn--primary" disabled={!!w.busy}>Save preferences</button>{saved && <p role="status">{saved}</p>}</form><button className="btn" disabled={!!w.busy || !data.preference.enabled} onClick={() => w.action({ action: "test-email" }, "Preparing notification email…")}>{data.emailMode === "preview" ? "Create sample email" : "Send test email"}</button></section></div>
    <section className="card"><div className="control-heading"><h3><Mail size={18} /> {data.emailMode === "preview" ? "Sample email inbox" : "Email delivery log"}</h3><span className="control-tag">{data.emailMode === "preview" ? "PREVIEW ONLY" : "SMTP ENABLED"}</span></div>{!data.mail.length && <div className="empty">Save your email preference, then create a sample email. Invitations also appear here for administrators.</div>}{data.mail.map(m => <details className="email-preview" key={m.id}><summary><span><strong>{m.subject}</strong><small>To: {m.to} · {when(m.createdAt)}</small></span><span className={`mail-status mail-status--${m.status}`}>{m.status}</span></summary><div className="email-letter"><div className="email-brand"><img src="/brand/disputeguard-logo.svg" alt="" />DisputeGuard</div><h3>{m.subject}</h3><p>{m.text}</p><footer>DisputeGuard Showcase · Case updates and investigation support</footer></div>{m.error && <p role="alert">{m.error}</p>}</details>)}</section>
  </>;
}
function Monitoring({ w }: { w: WorkspaceHook }) {
  const m = w.data!.monitoring!;
  const [interval, setIntervalValue] = useState(m.intervalSeconds);
  const [threshold, setThreshold] = useState(m.thresholdMinor / 100);
  return <>
    <div className="control-hero"><div className="control-eyebrow"><Activity size={17} /> CONTINUOUS OVERSIGHT</div><h2>Catch the unusual. Review it early.</h2><p>Explainable checks scan the sample portfolio for large payments, unusual amounts and possible duplicates.</p><span className={`monitor-status ${m.enabled ? "monitor-status--on" : ""}`}><i />{m.enabled ? "Monitoring running" : "Monitoring paused"}</span><small>Runs in the server process, including when this page is closed. Pauses while the server is offline.</small></div>
    <div className="control-stats"><div><span>Completed scans</span><strong>{m.runs}</strong></div><div><span>Payments checked</span><strong>{m.scanned}</strong></div><div><span>Review flags</span><strong>{m.findings.length}</strong></div></div>
    <section className="card"><div className="control-heading"><h3>Monitoring controls</h3><ShieldCheck size={20} /></div><form className="monitor-controls" onSubmit={async e => { e.preventDefault(); await w.action({ action: "monitor", enabled: true, intervalSeconds: interval, thresholdMinor: Math.round(threshold * 100) }, "Applying rules and scanning the portfolio…"); }}><label>Scan every<select value={interval} onChange={e => setIntervalValue(Number(e.target.value))}><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={300}>5 minutes</option></select></label><label>Large-payment threshold (ZAR)<input type="number" min={100} max={100000} required value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label><button className="btn btn--primary" disabled={!!w.busy}>{m.enabled ? "Apply & restart monitoring" : "Start monitoring"}</button><button type="button" className="btn" disabled={!!w.busy || !m.enabled} onClick={() => w.action({ action: "monitor", enabled: false, intervalSeconds: m.intervalSeconds, thresholdMinor: m.thresholdMinor }, "Pausing monitoring…")}>Pause</button><button type="button" className="btn" disabled={!!w.busy} onClick={() => w.action({ action: "scan" }, "Scanning all customer payments…")}>Scan once</button></form><div className="monitor-times"><span>Last scan: {when(m.lastRun)}</span><span>Next scan: {m.enabled ? when(m.nextRun) : "Paused"}</span></div><p className="control-muted">Each new flag notifies the customer and staff once per rule result. No case, payment or decision is changed automatically.</p></section>
    <section className="card"><h3>Latest scan findings</h3>{m.findings.length ? <Findings findings={m.findings} /> : <div className="empty">{m.lastRun ? "No payment triggered the configured rules." : "Run a scan to see the review queue."}</div>}</section>
  </>;
}
function Assistant({ data, inspect }: { data: Workspace; inspect: (id: number) => void }) {
  const [message, setMessage] = useState(""); const [transaction, setTransaction] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string; model?: boolean; cases?: { id: number; state: string }[] }[]>([]);
  const [busy, setBusy] = useState(false); const [steps, setSteps] = useState<string[]>([]); const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [chat, steps]);
  async function ask(question: string) {
    if (busy || !question.trim()) return;
    setBusy(true); setSteps([]); setError(""); setMessage(""); setChat(c => [...c, { role: "user", text: question }]);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question, ...(transaction ? { transactionId: Number(transaction) } : {}) }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let buffer = ""; let received = false;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "progress") setSteps(s => [...s, event.label]);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "result") { received = true; setChat(c => [...c, { role: "assistant", text: event.answer, model: event.usedModel, cases: event.cases }]); }
        }
      }
      if (!received) throw new Error("Connection closed before an answer arrived. Please retry.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not complete the investigation."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="control-hero control-hero--compact"><div className="control-eyebrow"><Sparkles size={16} /> YOUR INVESTIGATION COMPANION</div><h2>Let’s make sense of it.</h2><p>Ask about a payment, understand a case or check which evidence could help.</p><small>Read-only assistant · Three bounded steps · Records scoped to your account</small></div>
    <section className="card assistant-card"><label className="assistant-scope">Investigation scope<select value={transaction} onChange={e => setTransaction(e.target.value)} disabled={busy}><option value="">All payments available to me</option>{data.statement.map(t => <option key={t.id} value={t.id}>{t.merchant} · #{t.id} · {money(t.amountMinor)}</option>)}</select></label><div className="chat-history" role="log" aria-label="Investigation conversation">{!chat.length && <div className="assistant-welcome"><div className="assistant-orb"><MessageCircle size={30} /></div><h3>What would you like to understand?</h3><p>I can check statement patterns, read case progress and explain next steps. Each question checks the selected scope afresh.</p><div className="assistant-prompts">{["Check my payments for anything unusual", "What is happening with my disputes?", "What evidence should I provide?"].map(q => <button className="btn" key={q} onClick={() => ask(q)}>{q} →</button>)}</div></div>}{chat.map((m, i) => <article key={i} className={`chat-message chat-message--${m.role}`}><small>{m.role === "user" ? "You" : m.model ? "Assistant · local model" : "Assistant · rules-based response"}</small><p>{m.text}</p>{m.cases?.map(c => <button className="btn" key={c.id} onClick={() => inspect(c.id)}>Open case #{c.id}</button>)}</article>)}{steps.length > 0 && <div className="agent-steps" aria-live="polite">{steps.map((s, i) => <div key={s}>{busy && i === steps.length - 1 ? <LoaderCircle className="spinner" size={15} /> : <CheckCircle2 size={15} />}{s}</div>)}</div>}{busy && <Progress label="Preparing your explanation. The local model has a 12-second time limit…" />}<div ref={end} /></div>{error && <p className="control-error" role="alert">{error}</p>}<form className="chat-compose" onSubmit={e => { e.preventDefault(); void ask(message); }}><label className="visually-hidden" htmlFor="assistant-message">Ask the investigation assistant</label><textarea id="assistant-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask about a payment or case…" maxLength={2000} rows={2} disabled={busy} /><button className="btn btn--primary" disabled={busy || !message.trim()} aria-label="Send question">{busy ? <LoaderCircle className="spinner" size={18} /> : <Send size={18} />}</button></form><p className="control-muted">Responses are advisory. The assistant cannot approve cases, move money or access another customer's records.</p></section>
  </>;
}

type ManagedUser = { id: number; name: string; email: string | null; role: string; active: number; demo: number; onboarded: boolean };
function UsersPanel({ identity }: { identity: Identity }) {
  const [users, setUsers] = useState<ManagedUser[]>([]); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [inviteUrl, setInviteUrl] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("customer"); const [demo, setDemo] = useState(false);
  const load = useCallback(async () => { const res = await fetch("/api/users"); const data = await res.json(); if (!res.ok) throw new Error(data.error); setUsers(data.users); setDemo(data.demoEnabled); }, []);
  useEffect(() => { load().catch(e => setFeedback(e.message)); }, [load]);
  async function change(body: Record<string, unknown>) {
    setBusy(true); setFeedback(""); setInviteUrl("");
    try { const res = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setFeedback(data.message); setInviteUrl(data.inviteUrl || ""); if (body.action === "invite") { setName(""); setEmail(""); } await load(); }
    catch (e) { setFeedback(e instanceof Error ? e.message : "Unable to update accounts."); } finally { setBusy(false); }
  }
  return <><div className="control-hero control-hero--compact"><div className="control-eyebrow"><Users size={16} /> PEOPLE & ACCESS</div><h2>A workspace for every role.</h2><p>Invite customers and colleagues, onboard accounts and manage access from one place.</p><small>{demo ? "Showcase persona login is enabled. Disable SHOWCASE_DEMO_LOGIN before restricting access to registered accounts." : "Registered accounts only · Server-verified sessions"}</small></div>{busy && <Progress label="Updating account access…" />}{feedback && <p className="control-feedback" role="status">{feedback}</p>}{inviteUrl && <section className="card"><h3>Invitation ready</h3><p>Single-use link, valid for 48 hours. A copy is in your email inbox or SMTP delivery log.</p><a className="invite-link" href={inviteUrl}>{inviteUrl}</a></section>}<section className="card"><h3>Invite a customer or teammate</h3><form className="monitor-controls" onSubmit={e => { e.preventDefault(); void change({ action: "invite", name, email, role }); }}><label>Full name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></label><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label><label>Role<select value={role} onChange={e => setRole(e.target.value)}><option value="customer">Customer</option><option value="analyst">Analyst</option><option value="admin">Administrator</option></select></label><button className="btn btn--primary" disabled={busy}>Create invitation</button></form></section><section className="card"><h3>Accounts & permissions</h3><p className="control-muted">Customers access their own records. Analysts review cases and evidence. Administrators also manage people and monitoring. Role changes end existing sessions.</p><div className="statement-table"><table><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><strong>{u.name}</strong><small>{u.email || "Showcase persona"}</small></td><td><select aria-label={`Role for ${u.name}`} value={u.role} disabled={busy || !!u.demo || u.id === identity.userId} onChange={e => change({ action: "update", id: u.id, role: e.target.value, active: !!u.active })}><option value="customer">Customer</option><option value="analyst">Analyst</option><option value="admin">Administrator</option></select></td><td>{!u.onboarded ? "Invitation pending" : u.active ? "Active" : "Disabled"}</td><td>{!u.demo && u.id !== identity.userId && u.onboarded ? <button className="btn" disabled={busy} onClick={() => change({ action: "update", id: u.id, role: u.role, active: !u.active })}>{u.active ? "Disable" : "Enable"}</button> : "—"}</td></tr>)}</tbody></table></div></section></>;
}
