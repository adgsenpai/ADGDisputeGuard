import { NextResponse } from "next/server";
import { readJson } from "@/lib/api/request";
import { database } from "@/lib/auth/database";
import { accounts, identity, sessionAccount, createSession, revokeSession, demoEnabled, passwordMatches, acceptInvitation, passwordHash, type Account } from "@/lib/auth/session";
import { timingSafeEqual } from "node:crypto";
export const dynamic = "force-dynamic";
const attempts = new Map<string, { count: number; expires: number }>();
export async function GET(req: Request) {
  const account = sessionAccount(req);
  return NextResponse.json({ identity: account ? identity(account) : null, demoEnabled: demoEnabled(), setupAvailable: Boolean(process.env.ADMIN_SETUP_TOKEN) && !accounts().some(a => !a.demo && a.role === "admin" && a.password) });
}
export async function POST(req: Request) {
  const body = await readJson(req);
  if (body.action === "logout") {
    revokeSession(req);
    const res = NextResponse.json({ ok: true }); res.cookies.delete("dg_session"); return res;
  }
  const key = String(body.email || body.token || body.userId || "setup").toLowerCase().slice(0, 254);
  const now = Date.now();
  for (const [k, v] of attempts) if (v.expires <= now) attempts.delete(k);
  if (attempts.size > 5000 || (attempts.get(key)?.count || 0) >= 8) return NextResponse.json({ error: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
  const prior = attempts.get(key); attempts.set(key, { count: (prior?.count || 0) + 1, expires: prior?.expires || now + 900000 });
  let account: Account | undefined;
  try {
    const all = accounts();
    if (body.action === "demo" && demoEnabled()) account = all.find(a => a.id === Number(body.userId) && a.demo && a.active);
    else if (body.action === "login") {
      const candidate = all.find(a => !a.demo && a.active && a.email === String(body.email).trim().toLowerCase());
      if (candidate?.password && typeof body.password === "string" && body.password.length <= 128 && passwordMatches(body.password, candidate.password)) account = candidate;
    } else if (body.action === "accept" || body.action === "setup") {
      if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128) return NextResponse.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
      if (body.action === "accept") account = acceptInvitation(String(body.token || ""), body.password);
      else {
        const expected = Buffer.from(process.env.ADMIN_SETUP_TOKEN || ""); const supplied = Buffer.from(String(body.token || ""));
        if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied) || all.some(a => !a.demo && a.role === "admin" && a.password)) throw new Error("Setup is unavailable.");
        const email = String(body.email || "").trim().toLowerCase(); const name = String(body.name || "").trim();
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254 || !name || name.length > 80) throw new Error("Enter your name and a valid email.");
        const id = database().prepare("INSERT INTO users (name,email,role,password,created_at) VALUES (?,?,'admin',?,?)").run(name, email, passwordHash(body.password), new Date().toISOString()).lastInsertRowid;
        account = database().prepare("SELECT * FROM users WHERE id=?").get(id) as Account;
      }
    }
    if (!account) return NextResponse.json({ error: "Sign-in failed. Check your details and try again." }, { status: 401 });
    attempts.delete(key);
    const res = NextResponse.json({ identity: identity(account) });
    res.cookies.set("dg_session", createSession(account.id), { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 8 * 3600 });
    return res;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete sign-in." }, { status: 400 }); }
}
