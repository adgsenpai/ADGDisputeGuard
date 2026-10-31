import { loadState, saveState } from "../auth/database";
import { accounts } from "../auth/session";
import { getStore, DEMO_USERS, SEED_TRANSACTIONS } from "../api/store";
import type { DisputeStore } from "../domain/service";
import { canView, type User } from "../domain/access";
import { scanTransactions, statementRows, type Finding } from "./monitoring";

export type Notice = { id: number; userId: number; title: string; body: string; createdAt: string; read: boolean; disputeId?: number; transactionId?: number };
export type Mail = { id: number; userId: number; to: string; subject: string; text: string; status: "preview" | "pending" | "sending" | "sent" | "failed"; createdAt: string; error?: string };
export type Preference = { email: string; enabled: boolean };
export class ControlCenter {
  persist() {
    saveState("control", { notifications: this.notifications, mail: this.mail, preferences: [...this.preferences], seen: [...this.seen], monitoring: this.monitoring, sequence: this.sequence });
  }
  static restore() {
    const state = loadState("control") as { notifications: Notice[]; mail: Mail[]; preferences: [number, Preference][]; seen: string[]; monitoring: ControlCenter["monitoring"]; sequence: number } | undefined;
    const control = new ControlCenter();
    if (state) { Object.assign(control, state); control.preferences = new Map(state.preferences); control.seen = new Set(state.seen); control.mail.filter(m => m.status === "sending").forEach(m => { m.status = "failed"; m.error = "Server restarted during delivery; delivery could not be confirmed."; }); }
    return control;
  }
  notifications: Notice[] = [];
  mail: Mail[] = [];
  preferences = new Map<number, Preference>();
  seen = new Set<string>();
  monitoring = { enabled: false, intervalSeconds: 60, thresholdMinor: 200000, lastRun: null as string | null, nextRun: null as string | null, runs: 0, scanned: 0, findings: [] as Finding[] };
  private sequence = 1;
  private scanning = false;

  notify(key: string, ownerId: number, title: string, body: string, target: { disputeId?: number; transactionId?: number } = {}) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const users = accounts().filter(u => u.active && (u.id === ownerId || u.role !== "customer"));
    for (const user of users) {
      const notice: Notice = { id: this.sequence++, userId: user.id, title, body, createdAt: new Date().toISOString(), read: false, ...target };
      this.notifications.push(notice);
      const pref = this.preferences.get(user.id);
      if (pref?.enabled) this.queueMail(user.id, pref.email, title, "There is an update in your DisputeGuard workspace. Sign in to review it.");
    }
    // Keep the demo's memory bounded, while retaining event deduplication.
    this.notifications = this.notifications.slice(-1000);
  }
  queueMail(userId: number, to: string, subject: string, text: string) {
    const url = process.env.APP_URL || "http://localhost:3100";
    const entry: Mail = { id: this.sequence++, userId, to, subject, text: `${text}\n\n${url}/console#notifications`, status: smtpConfigured() ? "pending" : "preview", createdAt: new Date().toISOString() };
    this.mail.push(entry);
    this.mail = this.mail.slice(-1000);
    return entry;
  }
  sync(store: DisputeStore) {
    for (const event of store.allEvents()) {
      const dispute = store.dispute(event.disputeId);
      const tx = dispute && store.getTransaction(dispute.transactionId);
      if (!tx) continue;
      const state = event.detail.kind === "dispute-created" ? event.detail.state : event.detail.to;
      this.notify(`audit:${event.seq}`, tx.ownerId, `Case #${event.disputeId}: ${state.replaceAll("_", " ")}`, state === "evidence_required" ? "The analyst needs supporting evidence. Open your case to see the next step." : "Your case timeline has been updated. Open the workspace for details.", { disputeId: event.disputeId });
    }
    for (const [kind, entries] of [["Evidence received", store.allEvidence()], ["Investigation complete", store.allInvestigations()]] as const) {
      for (const entry of entries) {
        const dispute = store.dispute(entry.disputeId);
        const tx = dispute && store.getTransaction(dispute.transactionId);
        if (tx) this.notify(`${kind}:${entry.seq}`, tx.ownerId, `${kind} · case #${entry.disputeId}`, "Your case has a new update ready to review.", { disputeId: entry.disputeId });
      }
    }
  }
  scan(now = Date.now()) {
    if (this.scanning) return this.monitoring;
    this.scanning = true;
    try {
      const rows = statementRows(SEED_TRANSACTIONS);
      const findings = scanTransactions(rows, this.monitoring.thresholdMinor);
      for (const finding of findings) this.notify(`outlier:${finding.transactionId}:${finding.reasons.join("|")}`, finding.ownerId, "Payment worth reviewing", `${finding.merchant}: ${finding.reasons.join(" ")} This is a review flag, not a dispute decision.`, { transactionId: finding.transactionId });
      Object.assign(this.monitoring, { findings, scanned: rows.length, runs: this.monitoring.runs + 1, lastRun: new Date(now).toISOString(), nextRun: this.monitoring.enabled ? new Date(now + this.monitoring.intervalSeconds * 1000).toISOString() : null });
      return this.monitoring;
    } finally { this.scanning = false; }
  }
  tick(now = Date.now()) {
    if (this.monitoring.enabled && (!this.monitoring.nextRun || Date.parse(this.monitoring.nextRun) <= now)) this.scan(now);
  }
  snapshot(user: User) {
    this.sync(getStore());
    const rows = statementRows(SEED_TRANSACTIONS).filter(t => canView(user, t));
    const ids = new Set(rows.map(t => t.id));
    return {
      statement: rows,
      disputes: getStore().allDisputes().filter(d => ids.has(d.transactionId)),
      notifications: this.notifications.filter(n => n.userId === user.id).slice().reverse(),
      mail: this.mail.filter(m => m.userId === user.id).slice().reverse(),
      preference: this.preferences.get(user.id) || { email: "", enabled: false },
      emailMode: smtpConfigured() ? "smtp" : "preview",
      monitoring: user.role === "admin" ? this.monitoring : null,
      refreshedAt: new Date().toISOString(),
    };
  }
}
export function smtpConfigured() { return Boolean(process.env.EMAIL_DELIVERY_ENABLED === "true" && process.env.SMTP_HOST && process.env.SMTP_FROM); }
const shared = globalThis as typeof globalThis & { dgControl?: ControlCenter; dgWorker?: ReturnType<typeof setInterval>; dgMailBusy?: boolean };
export function getControl() { return shared.dgControl ??= ControlCenter.restore(); }

export async function deliverMail() {
  if (shared.dgMailBusy || !smtpConfigured()) return;
  shared.dgMailBusy = true;
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", requireTLS: process.env.SMTP_SECURE !== "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined, connectionTimeout: 10000, socketTimeout: 15000 });
    try {
      for (const entry of getControl().mail.filter(m => m.status === "pending").slice(0, 10)) {
        // Claim before awaiting: another tick cannot deliver it twice.
        entry.status = "sending";
        getControl().persist();
        try {
          await transport.sendMail({ from: process.env.SMTP_FROM, to: entry.to, subject: entry.subject, text: entry.text });
          entry.status = "sent";
        } catch { entry.status = "failed"; entry.error = "Delivery could not be confirmed. Check SMTP settings; no automatic retry was made."; }
      }
    } finally { transport.close(); getControl().persist(); }
  } finally { shared.dgMailBusy = false; }
}
export function startWorker() {
  if (shared.dgWorker) return;
  shared.dgWorker = setInterval(() => {
    const control = getControl();
    control.sync(getStore());
    control.tick();
    control.persist();
    void deliverMail().catch(() => {});
  }, 5000);
  shared.dgWorker.unref();
}
