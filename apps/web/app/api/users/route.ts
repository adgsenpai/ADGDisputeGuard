import { userFromRequest, readJson } from "@/lib/api/request";
import { accounts, inviteAccount, demoEnabled } from "@/lib/auth/session";
import { database } from "@/lib/auth/database";
import { getControl, smtpConfigured } from "@/lib/control/service";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (userFromRequest(req).role !== "admin") return Response.json({ error: "Administrator access required." }, { status: 403 });
  return Response.json({ users: accounts().map(({ password, ...user }) => ({ ...user, onboarded: Boolean(password) || Boolean(user.demo) })), demoEnabled: demoEnabled(), emailMode: smtpConfigured() ? "smtp" : "preview", audit: database().prepare("SELECT * FROM access_log ORDER BY id DESC LIMIT 30").all() });
}
export async function POST(req: Request) {
  const actor = userFromRequest(req);
  if (actor.role !== "admin") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const body = await readJson(req);
  if (!["customer", "analyst", "admin"].includes(String(body.role))) return Response.json({ error: "Choose a valid role." }, { status: 400 });
  const role = body.role as "customer" | "analyst" | "admin";
  if (body.action === "invite") {
    const name = String(body.name || "").trim(); const email = String(body.email || "").trim().toLowerCase();
    if (!name || name.length > 80 || email.length > 254 || !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email)) return Response.json({ error: "Enter a name and a valid email address." }, { status: 400 });
    try {
      const invite = inviteAccount(actor, name, email, role);
      const url = `${process.env.APP_URL || new URL(req.url).origin}/console?invite=${invite.token}`;
      getControl().queueMail(actor.id, email, "You're invited to DisputeGuard", `You have been invited as ${role}. Create your password using this single-use link within 48 hours:\n${url}`);
      getControl().persist();
      return Response.json({ message: "Invitation created. The link expires in 48 hours.", inviteUrl: url }, { status: 201 });
    } catch { return Response.json({ error: "This email may already be registered. Check the account list." }, { status: 409 }); }
  }
  if (body.action === "update") {
    const target = accounts().find(a => a.id === Number(body.id));
    if (!target || target.demo || target.id === actor.id || typeof body.active !== "boolean") return Response.json({ error: "Select another registered account. Showcase personas and your own access cannot be changed here." }, { status: 400 });
    if (!target.password && body.active) return Response.json({ error: "This user must accept their invitation before being activated." }, { status: 400 });
    const db = database();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE users SET role=?,active=? WHERE id=?").run(role, body.active ? 1 : 0, target.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
      db.prepare("INSERT INTO access_log (actor,action,target,created_at) VALUES (?,?,?,?)").run(actor.id, `${role}; ${body.active ? "enabled" : "disabled"}`, target.id, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return Response.json({ message: "Account updated. Existing sessions revoked." });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
