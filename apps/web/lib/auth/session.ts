import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { database } from "./database";
import { PERSONAS } from "../personas";
import type { Role, User } from "../domain/access";
export type Account = { id: number; name: string; email: string | null; role: Role; password: string | null; active: number; demo: number; created_at: string };
export const demoEnabled = () => process.env.SHOWCASE_DEMO_LOGIN !== "false";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function seedAccounts() {
  const db = database();
  for (const p of PERSONAS) db.prepare("INSERT OR IGNORE INTO users (id,name,role,demo,created_at) VALUES (?,?,?,1,?)").run(p.userId, p.name, p.role, new Date().toISOString());
}
export function accounts(): Account[] {
  seedAccounts();
  return database().prepare("SELECT * FROM users ORDER BY id").all() as Account[];
}
export function identity(account: Account) { return { userId: account.id, role: account.role, name: account.name, initials: account.name.split(" ").map(s => s[0]).slice(0, 2).join(""), title: account.role, city: account.demo ? "Showcase persona" : "Registered account" }; }
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function sessionAccount(req: Request): Account | undefined {
  const token = req.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("dg_session="))?.slice(11);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  const row = database().prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1").get(hash(token), Date.now()) as Account | undefined;
  if (row?.demo && !demoEnabled()) return;
  return row;
}
export function authenticatedUser(req: Request): User | undefined {
  const account = sessionAccount(req);
  return account ? { id: account.id, role: account.role } : undefined;
}
export function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  database().prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
  database().prepare("INSERT INTO sessions VALUES (?,?,?)").run(hash(token), userId, Date.now() + 8 * 3600000);
  return token;
}
export function revokeSession(req: Request) {
  const token = req.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("dg_session="))?.slice(11);
  if (token) database().prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
}
export function inviteAccount(actor: User, name: string, email: string, role: Role) {
  if (actor.role !== "admin") throw new Error("Administrator access required.");
  const db = database();
  const raw = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare("INSERT INTO users (name,email,role,active,created_at) VALUES (?,?,?,0,?)").run(name, email, role, now);
    const id = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO invitations VALUES (?,?,?,0)").run(hash(raw), id, Date.now() + 48 * 3600000);
    db.prepare("INSERT INTO access_log (actor,action,target,created_at) VALUES (?,?,?,?)").run(actor.id, "invited", id, now);
    db.exec("COMMIT");
    return { id, token: raw };
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function acceptInvitation(token: string, password: string) {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const invite = db.prepare("SELECT user_id FROM invitations WHERE token=? AND expires>? AND accepted=0").get(hash(token), Date.now()) as { user_id: number } | undefined;
    if (!invite) throw new Error("Invitation expired or already used.");
    db.prepare("UPDATE users SET password=?,active=1 WHERE id=?").run(passwordHash(password), invite.user_id);
    db.prepare("UPDATE invitations SET accepted=1 WHERE token=?").run(hash(token));
    db.exec("COMMIT");
    return db.prepare("SELECT * FROM users WHERE id=?").get(invite.user_id) as Account;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
