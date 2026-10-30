//! Exact money handling (equations.tex, "Money and Exact Amounts").
//!
//! Amounts are stored as whole minor units (e.g. cents) to avoid binary
//! floating-point rounding. Currencies carry their own minor-unit exponent;
//! we never assume two decimal places. Amounts of different currencies are
//! never added.

use std::fmt;

/// A currency with its ISO code and number of minor-unit decimal places `q`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Currency {
    pub code: &'static str,
    /// Decimal places `q`; the minor-unit factor is `10^q`.
    pub exponent: u32,
}

impl Currency {
    pub const fn new(code: &'static str, exponent: u32) -> Self {
        Currency { code, exponent }
    }

    /// `e_c = 10^q`.
    pub fn minor_factor(&self) -> i128 {
        10i128.pow(self.exponent)
    }
}

/// Common currencies used by the samples.
pub const ZAR: Currency = Currency::new("ZAR", 2);
pub const USD: Currency = Currency::new("USD", 2);
pub const JPY: Currency = Currency::new("JPY", 0); // no minor unit
pub const BHD: Currency = Currency::new("BHD", 3); // three decimal places

/// An exact money amount expressed in integer minor units.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Money {
    pub minor: i128,
    pub currency: Currency,
}

/// Error cases for exact money operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MoneyError {
    CurrencyMismatch { left: &'static str, right: &'static str },
    Overflow,
    /// A decimal string did not match the currency's declared precision.
    BadPrecision,
    ParseError(String),
}

impl fmt::Display for MoneyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MoneyError::CurrencyMismatch { left, right } => {
                write!(f, "currency mismatch: {left} vs {right}")
            }
            MoneyError::Overflow => write!(f, "money arithmetic overflow"),
            MoneyError::BadPrecision => write!(f, "amount has more precision than the currency allows"),
            MoneyError::ParseError(s) => write!(f, "parse error: {s}"),
        }
    }
}

impl Money {
    pub fn from_minor(minor: i128, currency: Currency) -> Self {
        Money { minor, currency }
    }

    /// Parse an exact decimal string (e.g. "1234.56") into minor units using
    /// the currency's exponent: `a_minor = a * 10^q`. Rejects extra precision
    /// rather than silently rounding.
    pub fn parse(input: &str, currency: Currency) -> Result<Self, MoneyError> {
        let s = input.trim();
        let (sign, body) = match s.strip_prefix('-') {
            Some(rest) => (-1i128, rest),
            None => (1i128, s.strip_prefix('+').unwrap_or(s)),
        };
        if body.is_empty() {
            return Err(MoneyError::ParseError("empty amount".into()));
        }
        let (int_part, frac_part) = match body.split_once('.') {
            Some((i, f)) => (i, f),
            None => (body, ""),
        };
        if frac_part.len() > currency.exponent as usize {
            return Err(MoneyError::BadPrecision);
        }
        if !int_part.chars().all(|c| c.is_ascii_digit())
            || !frac_part.chars().all(|c| c.is_ascii_digit())
        {
            return Err(MoneyError::ParseError(format!("non-digit in {input:?}")));
        }
        let int_part = if int_part.is_empty() { "0" } else { int_part };
        let int_val: i128 = int_part
            .parse()
            .map_err(|_| MoneyError::ParseError(format!("integer part {int_part:?}")))?;
        // Pad fractional digits out to the full exponent.
        let mut frac = String::from(frac_part);
        while frac.len() < currency.exponent as usize {
            frac.push('0');
        }
        let frac_val: i128 = if frac.is_empty() {
            0
        } else {
            frac.parse()
                .map_err(|_| MoneyError::ParseError(format!("fraction {frac:?}")))?
        };
        let factor = currency.minor_factor();
        let minor = sign
            .checked_mul(
                int_val
                    .checked_mul(factor)
                    .and_then(|v| v.checked_add(frac_val))
                    .ok_or(MoneyError::Overflow)?,
            )
            .ok_or(MoneyError::Overflow)?;
        Ok(Money { minor, currency })
    }

    /// Add two amounts; only succeeds when currencies match (spec: "Only add
    /// amounts after confirming they use the same currency").
    pub fn checked_add(&self, other: &Money) -> Result<Money, MoneyError> {
        if self.currency != other.currency {
            return Err(MoneyError::CurrencyMismatch {
                left: self.currency.code,
                right: other.currency.code,
            });
        }
        let minor = self
            .minor
            .checked_add(other.minor)
            .ok_or(MoneyError::Overflow)?;
        Ok(Money { minor, currency: self.currency })
    }

    /// Render back to a decimal string at the currency's precision.
    pub fn to_decimal_string(&self) -> String {
        let factor = self.currency.minor_factor();
        let sign = if self.minor < 0 { "-" } else { "" };
        let abs = self.minor.unsigned_abs();
        let factor_u = factor as u128;
        let int = abs / factor_u;
        if self.currency.exponent == 0 {
            return format!("{sign}{int}");
        }
        let frac = abs % factor_u;
        format!(
            "{sign}{int}.{frac:0width$}",
            width = self.currency.exponent as usize
        )
    }
}
