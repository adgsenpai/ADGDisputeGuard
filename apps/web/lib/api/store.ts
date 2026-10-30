// Shared in-memory store for the demo API, seeded with sample transactions.
// A module-level singleton: state lives for the life of the server instance.
// This is a demonstration store, not a production database.

import { DisputeStore } from "../domain/service";
import type { Role, User } from "../domain/access";

export type SeedTransaction = {
  id: number;
  ownerId: number;
  merchant: string;
  category: string;
  amountMinor: number;
  reason: string;
};

// Demo transactions (owner 1), mirroring the landing-page sample data.
export const SEED_TRANSACTIONS: SeedTransaction[] = [
  { id: 42, ownerId: 1, merchant: "Atlas Online", category: "Shopping", amountMinor: 124900, reason: "I don't recognise this payment." },
  { id: 43, ownerId: 1, merchant: "Corner Coffee", category: "Food & drink", amountMinor: 6800, reason: "I was charged more than expected." },
  { id: 51, ownerId: 1, merchant: "Studio Supply", category: "Shopping", amountMinor: 89900, reason: "The order hasn't arrived." },
  { id: 52, ownerId: 1, merchant: "Stream House", category: "Subscription", amountMinor: 14900, reason: "I cancelled this subscription." },
  { id: 61, ownerId: 1, merchant: "Coastline Stay", category: "Accommodation", amountMinor: 245000, reason: "The cancelled booking was not refunded." },
  { id: 62, ownerId: 1, merchant: "City Shuttle", category: "Transport", amountMinor: 18500, reason: "I was charged twice." },
];

export function createSeededStore(): DisputeStore {
  const store = new DisputeStore();
  for (const t of SEED_TRANSACTIONS) {
    store.addTransaction({ id: t.id, ownerId: t.ownerId });
  }
  return store;
}

// Demo users available to the API (a real system authenticates these).
export const DEMO_USERS: Record<string, User> = {
  "1": { id: 1, role: "customer" },
  "2": { id: 2, role: "customer" },
  "9": { id: 9, role: "analyst" },
  "99": { id: 99, role: "admin" },
};

// The server decides the acting user from the authenticated identity, never
// from a transaction id in the request body. For this demo we read a signed-in
// user from headers; absent/unknown headers fall back to the demo customer.
export function resolveUser(userId: string | null, role: string | null): User {
  if (userId && DEMO_USERS[userId]) return DEMO_USERS[userId];
  if (userId && role) {
    const r = role as Role;
    if (r === "customer" || r === "analyst" || r === "admin") {
      return { id: Number(userId), role: r };
    }
  }
  return DEMO_USERS["1"];
}

// The process-wide singleton used by the route handlers.
let singleton: DisputeStore | null = null;
export function getStore(): DisputeStore {
  if (!singleton) singleton = createSeededStore();
  return singleton;
}
