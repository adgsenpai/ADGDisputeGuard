// Helpers shared by the Next.js route handlers.

import { authenticatedUser } from "../auth/session";
import type { User } from "../domain/access";

// The authenticated user, taken from request headers in this demo. A real
// deployment would derive this from a verified session, never from the body.
export function userFromRequest(req: Request): User {
  const user = authenticatedUser(req);
  if (!user) throw new Error("Authentication required");
  return user;
}

// A random, server-side storage name for an uploaded file (never the client
// filename).
export function randomStorageName(): string {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `ev-${rand}`;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const value = await req.json();
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
