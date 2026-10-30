//! DisputeGuard engine: a reference implementation of the equations and flows
//! described in `planning/Software Spec/equations.tex`, with exact money,
//! server-side access rules, an authorised dispute lifecycle, idempotent and
//! uniqueness-guarded creation, deterministic advisory risk indicators, and a
//! bounded AI investigation loop.
//!
//! Everything here is illustrative: risk signals are advisory and never
//! decide a case, and all thresholds are inputs rather than baked-in policy.

pub mod access;
pub mod evidence;
pub mod investigation;
pub mod lifecycle;
pub mod money;
pub mod risk;
pub mod samples;
pub mod service;
