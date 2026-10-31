import { NextResponse } from "next/server";
import { readJson, userFromRequest } from "@/lib/api/request";
import { getControl, startWorker } from "@/lib/control/service";
import { scanTransactions } from "@/lib/control/monitoring";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: Request) {
  startWorker();
  return NextResponse.json(getControl().snapshot(userFromRequest(req)));
}
export async function POST(req: Request) {
  const user = userFromRequest(req);
  const body = await readJson(req);
  const control = getControl();
  startWorker();
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  switch (body.action) {
    case "read":
      control.notifications.filter(n => n.userId === user.id && (body.id === undefined || n.id === body.id)).forEach(n => { n.read = true; });
      break;
    case "preferences": {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (typeof body.enabled !== "boolean" || email.length > 254 || (email && !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email)) || (body.enabled && !email)) return fail("Enter a valid email address before enabling notifications.");
      control.preferences.set(user.id, { email, enabled: body.enabled });
      if (!body.enabled) control.mail.filter(m => m.userId === user.id && m.status === "pending").forEach(m => { m.status = "preview"; });
      break;
    }
    case "test-email": {
      const pref = control.preferences.get(user.id);
      if (!pref?.enabled) return fail("Save and enable your email preferences first.");
      if (control.mail.some(m => m.userId === user.id && Date.now() - Date.parse(m.createdAt) < 30000)) return fail("Please wait 30 seconds before requesting another email.", 429);
      control.queueMail(user.id, pref.email, "Your DisputeGuard notification preview", "Email notifications are enabled for your demo persona.");
      break;
    }
    case "check": {
      const snapshot = control.snapshot(user);
      return NextResponse.json({ findings: scanTransactions(snapshot.statement, control.monitoring.thresholdMinor), checked: snapshot.statement.length, checkedAt: new Date().toISOString() });
    }
    case "monitor": {
      if (user.role !== "admin") return fail("Only an administrator can control monitoring.", 403);
      if (typeof body.enabled !== "boolean" || ![30, 60, 300].includes(Number(body.intervalSeconds)) || !Number.isInteger(body.thresholdMinor) || Number(body.thresholdMinor) < 10000 || Number(body.thresholdMinor) > 10000000) return fail("Choose a valid interval and a threshold between R100 and R100,000.");
      Object.assign(control.monitoring, { enabled: body.enabled, intervalSeconds: Number(body.intervalSeconds), thresholdMinor: Number(body.thresholdMinor), nextRun: null });
      if (body.enabled) control.scan();
      break;
    }
    case "scan":
      if (user.role !== "admin") return fail("Only an administrator can run a portfolio scan.", 403);
      control.scan();
      break;
    default: return fail("Unknown action.");
  }
  control.persist();
  return NextResponse.json(control.snapshot(user));
}
