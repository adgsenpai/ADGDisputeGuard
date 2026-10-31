import { loadState, saveState } from "../auth/database";
// Shared in-memory store for the demo API, seeded with sample transactions.
// A module-level singleton: state lives for the life of the server instance.
// This is a demonstration store, not a production database.

import { DisputeStore } from "../domain/service";
import type { User } from "../domain/access";

export type SeedTransaction = {
  id: number;
  ownerId: number;
  merchant: string;
  category: string;
  amountMinor: number;
  reason: string;
};

// Demo transactions with real South African merchants, spread across several
// customer personas (see lib/personas.ts). Amounts are in cents (ZAR).
// Note: tx 42 is kept at R1 249,00 (124900) because tests pin it.
export const SEED_TRANSACTIONS: SeedTransaction[] = [
  // Thabo Nkosi (owner 1) — Johannesburg
  { id: 42, ownerId: 1, merchant: "Takealot", category: "Shopping", amountMinor: 124900, reason: "I don't recognise this payment." },
  { id: 43, ownerId: 1, merchant: "Checkers Sixty60", category: "Groceries", amountMinor: 6800, reason: "I was charged more than expected." },
  { id: 51, ownerId: 1, merchant: "Mr Price", category: "Shopping", amountMinor: 89900, reason: "The order hasn't arrived." },
  { id: 52, ownerId: 1, merchant: "Showmax", category: "Subscription", amountMinor: 9900, reason: "I cancelled this subscription." },
  { id: 61, ownerId: 1, merchant: "Southern Sun Hotels", category: "Accommodation", amountMinor: 245000, reason: "The cancelled booking was not refunded." },
  { id: 62, ownerId: 1, merchant: "Bolt", category: "Transport", amountMinor: 18500, reason: "I was charged twice." },

  // Lerato Mokoena (owner 2) — Pretoria
  { id: 70, ownerId: 2, merchant: "Woolworths", category: "Groceries", amountMinor: 45600, reason: "The amount looks wrong." },
  { id: 71, ownerId: 2, merchant: "Vodacom", category: "Airtime & data", amountMinor: 29900, reason: "I was billed after cancelling." },
  { id: 72, ownerId: 2, merchant: "Netflix", category: "Subscription", amountMinor: 19900, reason: "I was charged twice this month." },

  // Sipho Dlamini (owner 3) — Durban
  { id: 80, ownerId: 3, merchant: "Nando's", category: "Food & drink", amountMinor: 21500, reason: "I never received this order." },
  { id: 81, ownerId: 3, merchant: "Gautrain", category: "Transport", amountMinor: 8700, reason: "Double tap on the gate." },
  { id: 82, ownerId: 3, merchant: "Takealot", category: "Shopping", amountMinor: 334900, reason: "The order hasn't arrived." },

  // Naledi Khumalo (owner 4) — Cape Town
  { id: 90, ownerId: 4, merchant: "Dis-Chem", category: "Pharmacy", amountMinor: 15600, reason: "Charged for an item I returned." },
  { id: 91, ownerId: 4, merchant: "Cape Union Mart", category: "Shopping", amountMinor: 129900, reason: "I was charged more than the price shown." },
  { id: 92, ownerId: 4, merchant: "Uber", category: "Transport", amountMinor: 12300, reason: "Trip was cancelled but still charged." },

  // Ayanda Zulu (owner 5) — Soweto
  { id: 100, ownerId: 5, merchant: "Shoprite", category: "Groceries", amountMinor: 9800, reason: "I was charged twice." },
  { id: 101, ownerId: 5, merchant: "MTN", category: "Airtime & data", amountMinor: 5500, reason: "Data bundle never loaded." },
  { id: 102, ownerId: 5, merchant: "DStv", category: "Subscription", amountMinor: 87900, reason: "I cancelled this subscription." },
];

export function createSeededStore(): DisputeStore {
  const store = new DisputeStore();
  for (const t of SEED_TRANSACTIONS) {
    store.addTransaction({ id: t.id, ownerId: t.ownerId });
  }
  return store;
}

// Demo users available to the API (a real system authenticates these).
// Ids match the personas in lib/personas.ts.
export const DEMO_USERS: Record<string, User> = {
  "1": { id: 1, role: "customer" },
  "2": { id: 2, role: "customer" },
  "3": { id: 3, role: "customer" },
  "4": { id: 4, role: "customer" },
  "5": { id: 5, role: "customer" },
  "9": { id: 9, role: "analyst" },
  "10": { id: 10, role: "analyst" },
  "99": { id: 99, role: "admin" },
};

// The server decides the acting user from the authenticated identity, never
// from a transaction id in the request body. For this demo we read a signed-in
// user from headers; absent/unknown headers fall back to the demo customer.
export function resolveUser(userId: string | null, _role: string | null): User {
  if (userId && DEMO_USERS[userId]) return DEMO_USERS[userId];
  return DEMO_USERS["1"];
}

// The process-wide singleton used by the route handlers.
const shared = globalThis as typeof globalThis & { dgStore?: DisputeStore };
export function getStore(): DisputeStore {
  if (!shared.dgStore) {
    const saved = loadState("disputes") as ReturnType<DisputeStore["snapshot"]> | undefined;
    shared.dgStore = saved ? DisputeStore.restore(saved) : createSeededStore();
    shared.dgStore.setPersistence(() => saveState("disputes", shared.dgStore!.snapshot()));
  }
  return shared.dgStore;
}
