// Ownership and permission — server-side access rules.
// TypeScript port of engine/src/access.rs.

export type Role = "customer" | "analyst" | "admin";

export type User = { id: number; role: Role };
export type Transaction = { id: number; ownerId: number };

export function isOwner(user: User, tx: Transaction): boolean {
  return user.id === tx.ownerId;
}

// CanView <=> Owner or role in {analyst, admin}.
export function canView(user: User, tx: Transaction): boolean {
  return isOwner(user, tx) || user.role === "analyst" || user.role === "admin";
}

// CanCreateDispute => Owner (ownership is mandatory, even for an analyst).
export function canCreateDispute(user: User, tx: Transaction): boolean {
  return isOwner(user, tx);
}
