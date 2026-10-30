// Exact money handling — integer minor units, currency-aware precision.
// TypeScript port of engine/src/money.rs. Uses BigInt for exact arithmetic.

export type Currency = { code: string; exponent: number };

export const ZAR: Currency = { code: "ZAR", exponent: 2 };
export const USD: Currency = { code: "USD", exponent: 2 };
export const JPY: Currency = { code: "JPY", exponent: 0 };
export const BHD: Currency = { code: "BHD", exponent: 3 };

export type Money = { minor: bigint; currency: Currency };

export type MoneyError =
  | { kind: "currency-mismatch"; left: string; right: string }
  | { kind: "bad-precision" }
  | { kind: "parse-error"; message: string };

export function minorFactor(currency: Currency): bigint {
  return 10n ** BigInt(currency.exponent);
}

export function fromMinor(minor: bigint, currency: Currency): Money {
  return { minor, currency };
}

// Parse an exact decimal string ("1234.56") into minor units. Rejects extra
// precision rather than silently rounding.
export function parseMoney(input: string, currency: Currency): Money | MoneyError {
  const s = input.trim();
  let sign = 1n;
  let body = s;
  if (body.startsWith("-")) {
    sign = -1n;
    body = body.slice(1);
  } else if (body.startsWith("+")) {
    body = body.slice(1);
  }
  if (body.length === 0) return { kind: "parse-error", message: "empty amount" };

  const dot = body.indexOf(".");
  const intPart = dot === -1 ? body : body.slice(0, dot);
  const fracPart = dot === -1 ? "" : body.slice(dot + 1);
  if (fracPart.length > currency.exponent) return { kind: "bad-precision" };
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    return { kind: "parse-error", message: `non-digit in ${JSON.stringify(input)}` };
  }
  const padded = fracPart.padEnd(currency.exponent, "0");
  const intVal = BigInt(intPart === "" ? "0" : intPart);
  const fracVal = padded === "" ? 0n : BigInt(padded);
  const minor = sign * (intVal * minorFactor(currency) + fracVal);
  return { minor, currency };
}

export function isMoneyError(v: Money | MoneyError): v is MoneyError {
  return (v as MoneyError).kind !== undefined;
}

// Add two amounts; only succeeds when currencies match.
export function addMoney(a: Money, b: Money): Money | MoneyError {
  if (a.currency.code !== b.currency.code) {
    return { kind: "currency-mismatch", left: a.currency.code, right: b.currency.code };
  }
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function toDecimalString(m: Money): string {
  const factor = minorFactor(m.currency);
  const sign = m.minor < 0n ? "-" : "";
  const abs = m.minor < 0n ? -m.minor : m.minor;
  const int = abs / factor;
  if (m.currency.exponent === 0) return `${sign}${int}`;
  const frac = (abs % factor).toString().padStart(m.currency.exponent, "0");
  return `${sign}${int}.${frac}`;
}
