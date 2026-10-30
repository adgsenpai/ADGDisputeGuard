//! Ownership and permission (equations.tex, "Ownership and Permission").
//!
//! A transaction ID from a browser is not proof of ownership; the server
//! decides `CanView` / `CanCreateDispute` from the authenticated identity.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Customer,
    Analyst,
    Admin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct User {
    pub id: u64,
    pub role: Role,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Transaction {
    pub id: u64,
    /// The authenticated owner of the account this transaction belongs to.
    pub owner_id: u64,
}

/// `Owner(u,t)` — the user owns the account associated with the transaction.
pub fn is_owner(user: &User, tx: &Transaction) -> bool {
    user.id == tx.owner_id
}

/// `CanView(u,t) <=> Owner(u,t) or Role(u) in {ANALYST, ADMIN}`.
pub fn can_view(user: &User, tx: &Transaction) -> bool {
    is_owner(user, tx) || matches!(user.role, Role::Analyst | Role::Admin)
}

/// `CanCreateDispute(u,t) => Owner(u,t)`.
///
/// Ownership is mandatory for customer-created disputes, regardless of role:
/// an analyst viewing a transaction does not thereby own it.
pub fn can_create_dispute(user: &User, tx: &Transaction) -> bool {
    is_owner(user, tx)
}
