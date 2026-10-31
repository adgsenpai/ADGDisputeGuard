import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
const shared = globalThis as typeof globalThis & { dgDatabase?: DatabaseSync };
export function database() {
  if (shared.dgDatabase) return shared.dgDatabase;
  const folder = resolve(process.env.DATA_DIR || join(process.cwd(), ".data"));
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(folder, "showcase.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, role TEXT NOT NULL, password TEXT, active INTEGER NOT NULL DEFAULT 1, demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invitations (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL, accepted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, dispute_id INTEGER NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS access_log (id INTEGER PRIMARY KEY, actor INTEGER NOT NULL, action TEXT NOT NULL, target INTEGER NOT NULL, created_at TEXT NOT NULL);`);
  shared.dgDatabase = db;
  return db;
}
export function loadState(key: string): unknown {
  const row = database().prepare("SELECT value FROM state WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : undefined;
}
export function saveState(key: string, value: unknown) {
  database().prepare("INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value));
}
