//! Sample transactions and fixtures used to exercise the mathematics and
//! flows. These mirror the demo cards shown on the web landing page
//! (`apps/web/lib/demo-transactions.ts`) and add math-focused fixtures.
//!
//! All amounts are exact minor units (cents) and all values are illustrative.

use crate::money::{Money, ZAR};

/// A demonstration transaction, matching the shape used by the web demo.
#[derive(Debug, Clone)]
pub struct SampleTransaction {
    pub id: &'static str,
    pub merchant: &'static str,
    pub category: &'static str,
    pub amount_minor: i128,
    pub completed: bool,
    pub reason: &'static str,
}

impl SampleTransaction {
    pub fn money(&self) -> Money {
        Money::from_minor(self.amount_minor, ZAR)
    }
}

/// The nine demo transactions from the three demo cards (Everyday / Online /
/// Travel), kept in sync with the web landing page.
pub const DEMO_TRANSACTIONS: &[SampleTransaction] = &[
    SampleTransaction { id: "TX-0042", merchant: "Atlas Online", category: "Shopping", amount_minor: 124900, completed: true, reason: "I don't recognise this payment." },
    SampleTransaction { id: "TX-0043", merchant: "Corner Coffee", category: "Food & drink", amount_minor: 6800, completed: true, reason: "I was charged more than expected." },
    SampleTransaction { id: "TX-0044", merchant: "Fresh Market", category: "Groceries", amount_minor: 43250, completed: false, reason: "This sample payment is still processing." },
    SampleTransaction { id: "TX-0051", merchant: "Studio Supply", category: "Shopping", amount_minor: 89900, completed: true, reason: "The order hasn't arrived." },
    SampleTransaction { id: "TX-0052", merchant: "Stream House", category: "Subscription", amount_minor: 14900, completed: true, reason: "I cancelled this subscription." },
    SampleTransaction { id: "TX-0053", merchant: "Cloud Desk", category: "Software", amount_minor: 22900, completed: true, reason: "I was charged twice." },
    SampleTransaction { id: "TX-0061", merchant: "Coastline Stay", category: "Accommodation", amount_minor: 245000, completed: true, reason: "The cancelled booking was not refunded." },
    SampleTransaction { id: "TX-0062", merchant: "City Shuttle", category: "Transport", amount_minor: 18500, completed: true, reason: "I was charged twice." },
    SampleTransaction { id: "TX-0063", merchant: "Platform Café", category: "Food & drink", amount_minor: 9600, completed: false, reason: "This sample payment is still processing." },
];

/// A customer's prior transaction amounts (in major units, ZAR) used as
/// history for the anomaly calculations. Steady spend with one outlier.
pub const HISTORY_STEADY: &[f64] = &[220.0, 240.0, 210.0, 255.0, 230.0, 245.0, 225.0, 235.0];

/// History where every amount is identical: standard deviation and MAD are
/// both zero, so anomaly scores must be reported as unavailable.
pub const HISTORY_CONSTANT: &[f64] = &[100.0, 100.0, 100.0, 100.0];

/// Two recorded card-present locations for the geography signal (lat, lon in
/// degrees): Johannesburg and Cape Town.
pub const JOHANNESBURG: (f64, f64) = (-26.2041, 28.0473);
pub const CAPE_TOWN: (f64, f64) = (-33.9249, 18.4241);
