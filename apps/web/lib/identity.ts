// Client-side passwordless identity. The chosen persona (and its RBAC role) is
// persisted in localStorage; the console sends it to the API via the
// x-user-id / x-user-role headers. A real deployment would issue a verified
// session instead — here the identity is simply the selected demo persona.

import type { Persona, PersonaRole } from "./personas";

export type Identity = {
  userId: number;
  role: PersonaRole;
  name: string;
  initials: string;
  title: string;
  city: string;
};

const KEY = "dg.identity";

export function identityFromPersona(p: Persona): Identity {
  return { userId: p.userId, role: p.role, name: p.name, initials: p.initials, title: p.title, city: p.city };
}

export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    if (typeof parsed?.userId === "number" && typeof parsed?.role === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* storage unavailable — identity stays in memory for this session */
  }
}

export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function authHeaders(identity: Identity): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-user-id": String(identity.userId),
    "x-user-role": identity.role,
  };
}
