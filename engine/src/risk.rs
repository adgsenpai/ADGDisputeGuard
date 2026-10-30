//! Deterministic, explainable risk indicators (equations.tex, "Deterministic
//! Risk Indicators" and its subsections).
//!
//! Every function here is advisory only: a score or anomaly is not proof and
//! cannot decide a case. A missing signal is *unknown*, never silently zero.

/// Earth radius used for the Haversine distance, in kilometres.
pub const EARTH_RADIUS_KM: f64 = 6371.0;

/// Weights for the combined risk score. All must be non-negative and sum to 1.
#[derive(Debug, Clone, Copy)]
pub struct Weights {
    pub amount: f64,
    pub velocity: f64,
    pub merchant: f64,
    pub history: f64,
    pub geography: f64,
}

impl Weights {
    pub fn sum(&self) -> f64 {
        self.amount + self.velocity + self.merchant + self.history + self.geography
    }

    /// Valid iff every weight is non-negative and the weights sum to 1
    /// (within a small tolerance for floating-point representation).
    pub fn is_valid(&self) -> bool {
        let all_nonneg = [self.amount, self.velocity, self.merchant, self.history, self.geography]
            .iter()
            .all(|w| *w >= 0.0 && w.is_finite());
        all_nonneg && (self.sum() - 1.0).abs() < 1e-9
    }
}

/// The five normalised signals in [0,1]. `None` means "unavailable / unknown".
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Signals {
    pub amount: Option<f64>,
    pub velocity: Option<f64>,
    pub merchant: Option<f64>,
    pub history: Option<f64>,
    pub geography: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RiskError {
    /// At least one required signal was unavailable.
    MissingSignal(&'static str),
    /// A signal was outside [0,1].
    SignalOutOfRange(&'static str),
    /// Weights were negative or did not sum to 1.
    InvalidWeights,
}

/// Combined weighted score `R(d)` in [0,1]. Refuses to publish a score when a
/// required input is missing (no silent zero) or weights are invalid.
pub fn combined_score(signals: &Signals, weights: &Weights) -> Result<f64, RiskError> {
    if !weights.is_valid() {
        return Err(RiskError::InvalidWeights);
    }
    let pairs: [(&'static str, Option<f64>, f64); 5] = [
        ("amount", signals.amount, weights.amount),
        ("velocity", signals.velocity, weights.velocity),
        ("merchant", signals.merchant, weights.merchant),
        ("history", signals.history, weights.history),
        ("geography", signals.geography, weights.geography),
    ];
    let mut score = 0.0;
    for (name, value, weight) in pairs {
        let v = value.ok_or(RiskError::MissingSignal(name))?;
        if !(0.0..=1.0).contains(&v) {
            return Err(RiskError::SignalOutOfRange(name));
        }
        score += weight * v;
    }
    Ok(score)
}

/// Amount normalisation: `A(x) = min(1, ln(1+x) / ln(1+x_max))`.
/// `x >= 0` and `x_max > 0`. Returns `None` for invalid inputs.
pub fn amount_signal(x: f64, x_max: f64) -> Option<f64> {
    if !x.is_finite() || !x_max.is_finite() || x < 0.0 || x_max <= 0.0 {
        return None;
    }
    let denom = (1.0 + x_max).ln();
    if denom <= 0.0 {
        return None;
    }
    Some(((1.0 + x).ln() / denom).min(1.0))
}

/// Sample mean and (n-1) sample standard deviation for `n >= 2` amounts.
/// Returns `None` when there is insufficient history.
pub fn mean_std(xs: &[f64]) -> Option<(f64, f64)> {
    let n = xs.len();
    if n < 2 {
        return None;
    }
    let nf = n as f64;
    let mean = xs.iter().sum::<f64>() / nf;
    let var = xs.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (nf - 1.0);
    Some((mean, var.sqrt()))
}

/// Classic z-score anomaly: `z = (x - mean) / s`, only when `s > 0`.
/// Returns `None` when history is insufficient or `s = 0` (no invented score).
pub fn z_score(history: &[f64], x: f64) -> Option<f64> {
    let (mean, s) = mean_std(history)?;
    if s <= 0.0 {
        return None;
    }
    Some((x - mean) / s)
}

/// Median of a slice (sorted copy). `None` for empty input.
pub fn median(xs: &[f64]) -> Option<f64> {
    if xs.is_empty() {
        return None;
    }
    let mut v: Vec<f64> = xs.to_vec();
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = v.len();
    Some(if n % 2 == 1 {
        v[n / 2]
    } else {
        (v[n / 2 - 1] + v[n / 2]) / 2.0
    })
}

/// Robust (MAD-based) modified z-score: `z* = 0.6745 (x - m) / MAD`.
/// Returns `None` when `MAD = 0` (undefined; do not divide by zero).
pub fn robust_z_score(history: &[f64], x: f64) -> Option<f64> {
    let m = median(history)?;
    let deviations: Vec<f64> = history.iter().map(|xi| (xi - m).abs()).collect();
    let mad = median(&deviations)?;
    if mad <= 0.0 {
        return None;
    }
    Some(0.6745 * (x - m) / mad)
}

/// Transaction velocity `V = N / dt` for a window of length `dt > 0`.
pub fn velocity(count: u64, window: f64) -> Option<f64> {
    if !window.is_finite() || window <= 0.0 {
        return None;
    }
    Some(count as f64 / window)
}

/// Velocity z-score `z_V = (V - mu) / sigma`, comparing current transaction
/// velocity with the customer's historical velocity. Requires `sigma > 0`;
/// returns `None` when history is insufficient (no invented score).
pub fn velocity_zscore(mu: f64, sigma: f64, current: f64) -> Option<f64> {
    if ![mu, sigma, current].iter().all(|v| v.is_finite()) || sigma <= 0.0 {
        return None;
    }
    Some((current - mu) / sigma)
}

/// Velocity anomaly as a bounded `[0,1]` signal, via the velocity z-score.
pub fn velocity_signal(mu: f64, sigma: f64, current: f64, z_max: f64) -> Option<f64> {
    zscore_to_signal(velocity_zscore(mu, sigma, current)?, z_max)
}

/// Haversine great-circle distance in kilometres between two points given in
/// degrees. Returns `None` if any coordinate is non-finite.
pub fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> Option<f64> {
    for c in [lat1, lon1, lat2, lon2] {
        if !c.is_finite() {
            return None;
        }
    }
    let (phi1, phi2) = (lat1.to_radians(), lat2.to_radians());
    let dphi = (lat2 - lat1).to_radians();
    let dlambda = (lon2 - lon1).to_radians();
    let a = (dphi / 2.0).sin().powi(2)
        + phi1.cos() * phi2.cos() * (dlambda / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    Some(EARTH_RADIUS_KM * c)
}

/// Required travel velocity `v_required = d / dt` (km per unit time) for
/// `dt > 0`. Returns `None` for missing distance or non-positive elapsed time.
pub fn required_velocity(distance_km: Option<f64>, elapsed: f64) -> Option<f64> {
    let d = distance_km?;
    if !elapsed.is_finite() || elapsed <= 0.0 {
        return None;
    }
    Some(d / elapsed)
}

// ---------------------------------------------------------------------------
// Signal normalisation: map raw anomaly measures into bounded [0,1] signals.
//
// The combined score requires every signal in [0,1]. These helpers convert
// the spec's raw measures (z-scores, required velocity, merchant history)
// into that range. A missing or undefined input stays `None` — never a
// silent zero. The scales are configuration, not baked-in policy.
// ---------------------------------------------------------------------------

/// Map an anomaly z-score to a bounded `[0,1]` signal. The deviation
/// *magnitude* drives the signal; `z_max > 0` is the configured scale at
/// which it saturates (the spec flags `|z| > 3` as unusual, a sensible
/// default scale). Returns `None` for a non-finite z or invalid scale.
pub fn zscore_to_signal(z: f64, z_max: f64) -> Option<f64> {
    if !z.is_finite() || !z_max.is_finite() || z_max <= 0.0 {
        return None;
    }
    Some((z.abs() / z_max).min(1.0))
}

/// Historical amount anomaly as a `[0,1]` signal, via the classic z-score.
/// Unavailable when there is insufficient history or zero variance.
pub fn history_signal(history: &[f64], x: f64, z_max: f64) -> Option<f64> {
    zscore_to_signal(z_score(history, x)?, z_max)
}

/// Robust (MAD-based) historical anomaly as a `[0,1]` signal. Unavailable
/// when `MAD = 0`.
pub fn robust_history_signal(history: &[f64], x: f64, z_max: f64) -> Option<f64> {
    zscore_to_signal(robust_z_score(history, x)?, z_max)
}

/// Geography signal from the required travel velocity relative to a feasible
/// maximum speed `v_max > 0`: `min(1, v_required / v_max)`. An impossible
/// journey saturates to 1; a missing journey stays `None`.
pub fn geography_signal(required_velocity: Option<f64>, v_max: f64) -> Option<f64> {
    let v = required_velocity?;
    if !v_max.is_finite() || v_max <= 0.0 || !v.is_finite() || v < 0.0 {
        return None;
    }
    Some((v / v_max).min(1.0))
}

/// Deterministic merchant signal: the observed chargeback ratio
/// `chargebacks / total` in `[0,1]`. Unavailable when there is no history
/// (`total = 0`); invalid when `chargebacks > total`.
pub fn merchant_signal(chargebacks: u64, total: u64) -> Option<f64> {
    if total == 0 || chargebacks > total {
        return None;
    }
    Some(chargebacks as f64 / total as f64)
}

// ---------------------------------------------------------------------------
// Risk calculation integration (equations.tex, "Risk Calculation Algorithm").
//
// Raw inputs are turned into bounded signals through the normalisation layer
// above, then combined. If any required input is unavailable the result is an
// explicit "unavailable" with a reason, never a quietly low score.
// ---------------------------------------------------------------------------

/// Raw inputs for each signal. A `None` field means that category's input is
/// unavailable, which makes its signal unavailable too.
#[derive(Debug, Clone, Default)]
pub struct RiskInputs {
    /// The configured z-score saturation scale for anomaly signals.
    pub z_max: f64,
    /// `(x, x_max)` for the amount signal.
    pub amount: Option<(f64, f64)>,
    /// `(history, current_amount)` for the history anomaly signal.
    pub history: Option<(Vec<f64>, f64)>,
    /// `(mu, sigma, current_velocity)` for the velocity signal.
    pub velocity: Option<(f64, f64, f64)>,
    /// `(chargebacks, total)` for the merchant signal.
    pub merchant: Option<(u64, u64)>,
    /// `(required_velocity, v_max)` for the geography signal.
    pub geography: Option<(Option<f64>, f64)>,
}

/// Build the five bounded signals from raw inputs via the normalisation layer.
pub fn assemble_signals(inputs: &RiskInputs) -> Signals {
    Signals {
        amount: inputs.amount.and_then(|(x, x_max)| amount_signal(x, x_max)),
        velocity: inputs
            .velocity
            .and_then(|(mu, sigma, cur)| velocity_signal(mu, sigma, cur, inputs.z_max)),
        merchant: inputs.merchant.and_then(|(c, t)| merchant_signal(c, t)),
        history: inputs
            .history
            .as_ref()
            .and_then(|(hist, x)| history_signal(hist, *x, inputs.z_max)),
        geography: inputs.geography.and_then(|(v, v_max)| geography_signal(v, v_max)),
    }
}

/// An explainable risk result: either a score with its signals, or an
/// explicit unavailable with the reason.
#[derive(Debug, Clone, PartialEq)]
pub struct RiskResult {
    pub score: Option<f64>,
    pub signals: Signals,
    pub explanation: String,
}

/// Calculate an explainable risk indicator from raw inputs. The result is
/// advisory only and never decides a dispute.
pub fn calculate_risk(inputs: &RiskInputs, weights: &Weights) -> RiskResult {
    let signals = assemble_signals(inputs);
    match combined_score(&signals, weights) {
        Ok(score) => RiskResult {
            score: Some(score),
            signals,
            explanation: "All required signals available.".into(),
        },
        Err(RiskError::MissingSignal(name)) => RiskResult {
            score: None,
            signals,
            explanation: format!("One or more required inputs are unavailable: {name}"),
        },
        Err(RiskError::SignalOutOfRange(name)) => RiskResult {
            score: None,
            signals,
            explanation: format!("A signal was outside [0,1]: {name}"),
        },
        Err(RiskError::InvalidWeights) => RiskResult {
            score: None,
            signals,
            explanation: "Configured weights are negative or do not sum to 1.".into(),
        },
    }
}
