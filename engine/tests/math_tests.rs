//! Unit tests for the mathematics logic (money + risk indicators).

use disputeguard_engine::money::{Money, MoneyError, BHD, JPY, ZAR};
use disputeguard_engine::risk::*;
use disputeguard_engine::samples::{CAPE_TOWN, HISTORY_CONSTANT, HISTORY_STEADY, JOHANNESBURG};

const EPS: f64 = 1e-9;

// ---- Money: exact minor units ----------------------------------------------

#[test]
fn parses_two_decimal_amount_to_cents() {
    let m = Money::parse("1234.56", ZAR).unwrap();
    assert_eq!(m.minor, 123456); // R1234.56 -> 123456 cents
    assert_eq!(m.to_decimal_string(), "1234.56");
}

#[test]
fn respects_currency_specific_precision() {
    // JPY has no minor unit; BHD has three decimal places.
    assert_eq!(Money::parse("500", JPY).unwrap().minor, 500);
    assert_eq!(Money::parse("1.234", BHD).unwrap().minor, 1234);
    // Too much precision is rejected, not rounded.
    assert_eq!(Money::parse("1.5", JPY), Err(MoneyError::BadPrecision));
    assert_eq!(Money::parse("1.2345", BHD), Err(MoneyError::BadPrecision));
}

#[test]
fn addition_is_exact_and_currency_checked() {
    let a = Money::parse("0.10", ZAR).unwrap();
    let b = Money::parse("0.20", ZAR).unwrap();
    // The classic 0.1 + 0.2 != 0.3 float trap does not occur with minor units.
    assert_eq!(a.checked_add(&b).unwrap().minor, 30);
    let usd = Money::from_minor(30, disputeguard_engine::money::USD);
    assert!(matches!(
        a.checked_add(&usd),
        Err(MoneyError::CurrencyMismatch { .. })
    ));
}

// ---- Amount normalisation ---------------------------------------------------

#[test]
fn amount_signal_is_monotonic_and_bounded() {
    let x_max = 10_000.0;
    let a0 = amount_signal(0.0, x_max).unwrap();
    let a_small = amount_signal(100.0, x_max).unwrap();
    let a_big = amount_signal(9_000.0, x_max).unwrap();
    assert!((a0 - 0.0).abs() < EPS); // ln(1)/ln(..) = 0
    assert!(a0 < a_small && a_small < a_big);
    assert!((0.0..=1.0).contains(&a_big));
    // At the scale, the signal saturates to 1.
    assert!((amount_signal(x_max, x_max).unwrap() - 1.0).abs() < EPS);
    // Beyond the scale it is clamped to 1, never above.
    assert!((amount_signal(1_000_000.0, x_max).unwrap() - 1.0).abs() < EPS);
}

#[test]
fn amount_signal_rejects_invalid_inputs() {
    assert!(amount_signal(-1.0, 10.0).is_none());
    assert!(amount_signal(5.0, 0.0).is_none());
    assert!(amount_signal(f64::NAN, 10.0).is_none());
}

// ---- Historical anomaly: z-score -------------------------------------------

#[test]
fn z_score_flags_outlier_and_needs_history() {
    let z = z_score(HISTORY_STEADY, 900.0).unwrap();
    assert!(z > 3.0, "large amount should be an outlier, got {z}");
    let z_normal = z_score(HISTORY_STEADY, 232.0).unwrap();
    assert!(z_normal.abs() < 1.0);
    // Insufficient history -> unavailable.
    assert!(z_score(&[100.0], 900.0).is_none());
    // Zero variance -> unavailable, not an invented score.
    assert!(z_score(HISTORY_CONSTANT, 900.0).is_none());
}

#[test]
fn mean_std_matches_hand_computation() {
    let (mean, s) = mean_std(&[2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]).unwrap();
    assert!((mean - 5.0).abs() < EPS);
    // Sample (n-1) standard deviation of this classic set is sqrt(32/7).
    assert!((s - (32.0f64 / 7.0).sqrt()).abs() < EPS);
}

// ---- Robust anomaly: MAD ----------------------------------------------------

#[test]
fn robust_z_score_handles_median_and_zero_mad() {
    let z = robust_z_score(HISTORY_STEADY, 900.0).unwrap();
    assert!(z > 3.0);
    // MAD = 0 is undefined -> None (no divide by zero).
    assert!(robust_z_score(HISTORY_CONSTANT, 900.0).is_none());
}

#[test]
fn median_handles_even_and_odd_lengths() {
    assert_eq!(median(&[3.0, 1.0, 2.0]), Some(2.0));
    assert_eq!(median(&[4.0, 1.0, 3.0, 2.0]), Some(2.5));
    assert_eq!(median(&[]), None);
}

// ---- Velocity ---------------------------------------------------------------

#[test]
fn velocity_requires_positive_window() {
    assert_eq!(velocity(12, 6.0), Some(2.0));
    assert!(velocity(12, 0.0).is_none());
    assert!(velocity(12, -1.0).is_none());
}

// ---- Geography: Haversine + required velocity ------------------------------

#[test]
fn haversine_johannesburg_to_cape_town() {
    let d = haversine_km(JOHANNESBURG.0, JOHANNESBURG.1, CAPE_TOWN.0, CAPE_TOWN.1).unwrap();
    // Known great-circle distance is ~1262 km; allow a tolerance.
    assert!((d - 1262.0).abs() < 25.0, "distance was {d} km");
    // Zero distance for identical points.
    assert!(haversine_km(JOHANNESBURG.0, JOHANNESBURG.1, JOHANNESBURG.0, JOHANNESBURG.1).unwrap() < EPS);
}

#[test]
fn required_velocity_guards_elapsed_time() {
    let d = haversine_km(JOHANNESBURG.0, JOHANNESBURG.1, CAPE_TOWN.0, CAPE_TOWN.1);
    // Two card-present uses 1 hour apart imply an impossible ~1262 km/h.
    let v = required_velocity(d, 1.0).unwrap();
    assert!(v > 1000.0);
    // Non-positive elapsed time -> unavailable.
    assert!(required_velocity(d, 0.0).is_none());
    // Missing distance -> unavailable.
    assert!(required_velocity(None, 1.0).is_none());
}

// ---- Combined score ---------------------------------------------------------

fn equal_weights() -> Weights {
    Weights { amount: 0.2, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 }
}

#[test]
fn combined_score_in_unit_interval() {
    let signals = Signals {
        amount: Some(0.5),
        velocity: Some(0.4),
        merchant: Some(0.1),
        history: Some(0.9),
        geography: Some(0.3),
    };
    let r = combined_score(&signals, &equal_weights()).unwrap();
    assert!((r - 0.44).abs() < EPS);
    assert!((0.0..=1.0).contains(&r));
}

#[test]
fn combined_score_refuses_missing_signal() {
    let mut signals = Signals {
        amount: Some(0.5),
        velocity: Some(0.4),
        merchant: Some(0.1),
        history: Some(0.9),
        geography: Some(0.3),
    };
    signals.geography = None;
    assert_eq!(
        combined_score(&signals, &equal_weights()),
        Err(RiskError::MissingSignal("geography"))
    );
}

// ---- Signal normalisation ---------------------------------------------------

#[test]
fn zscore_to_signal_is_bounded_and_monotone_in_magnitude() {
    let z_max = 3.0;
    assert_eq!(zscore_to_signal(0.0, z_max), Some(0.0));
    let a = zscore_to_signal(1.0, z_max).unwrap();
    let b = zscore_to_signal(2.0, z_max).unwrap();
    assert!(a < b);
    // Saturates at the scale and clamps beyond it; sign does not matter.
    assert_eq!(zscore_to_signal(3.0, z_max), Some(1.0));
    assert_eq!(zscore_to_signal(10.0, z_max), Some(1.0));
    assert_eq!(zscore_to_signal(-10.0, z_max), Some(1.0));
    assert!(zscore_to_signal(1.0, 0.0).is_none());
    assert!(zscore_to_signal(f64::NAN, z_max).is_none());
}

#[test]
fn history_signal_maps_outlier_to_saturated_value() {
    let s = history_signal(HISTORY_STEADY, 900.0, 3.0).unwrap();
    assert_eq!(s, 1.0); // z ~ 46 >> 3 -> clamps to 1
    let normal = history_signal(HISTORY_STEADY, 232.0, 3.0).unwrap();
    assert!((0.0..=1.0).contains(&normal) && normal < 0.5);
    // Zero variance -> unavailable, not zero.
    assert!(history_signal(HISTORY_CONSTANT, 900.0, 3.0).is_none());
    assert!(robust_history_signal(HISTORY_CONSTANT, 900.0, 3.0).is_none());
}

#[test]
fn geography_signal_from_required_velocity() {
    let dist = haversine_km(JOHANNESBURG.0, JOHANNESBURG.1, CAPE_TOWN.0, CAPE_TOWN.1);
    // ~1262 km in 1 hour against a 900 km/h feasible max -> saturates to 1.
    let impossible = geography_signal(required_velocity(dist, 1.0), 900.0).unwrap();
    assert_eq!(impossible, 1.0);
    // Same distance over a full day is easily feasible -> low signal.
    let feasible = geography_signal(required_velocity(dist, 24.0), 900.0).unwrap();
    assert!(feasible < 0.1);
    // Missing journey -> unavailable.
    assert!(geography_signal(None, 900.0).is_none());
    assert!(geography_signal(Some(10.0), 0.0).is_none());
}

#[test]
fn merchant_signal_is_chargeback_ratio() {
    assert_eq!(merchant_signal(3, 12), Some(0.25));
    assert_eq!(merchant_signal(0, 50), Some(0.0));
    assert_eq!(merchant_signal(5, 5), Some(1.0));
    // No history -> unavailable; impossible counts -> unavailable.
    assert!(merchant_signal(0, 0).is_none());
    assert!(merchant_signal(6, 5).is_none());
}

#[test]
fn combined_score_validates_weights_and_ranges() {
    let signals = Signals {
        amount: Some(0.5),
        velocity: Some(0.5),
        merchant: Some(0.5),
        history: Some(0.5),
        geography: Some(0.5),
    };
    let bad = Weights { amount: 0.5, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };
    assert_eq!(combined_score(&signals, &bad), Err(RiskError::InvalidWeights));

    let negative = Weights { amount: -0.1, velocity: 0.3, merchant: 0.2, history: 0.3, geography: 0.3 };
    assert_eq!(combined_score(&signals, &negative), Err(RiskError::InvalidWeights));

    let out_of_range = Signals { amount: Some(1.5), ..signals };
    assert_eq!(
        combined_score(&out_of_range, &equal_weights()),
        Err(RiskError::SignalOutOfRange("amount"))
    );
}
