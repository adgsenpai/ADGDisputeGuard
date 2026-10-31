// Card-scheme chargeback reason codes (illustrative subset of Visa and
// Mastercard dispute rules), the evidence each one typically requires, and an
// internal resolution SLA in days. A suggested code is derived from the
// cardholder's stated reason when a dispute is opened. Demonstration data —
// real scheme rules are more detailed and change over time.

export type Scheme = "Visa" | "Mastercard";

export type ReasonCode = {
  code: string;
  scheme: Scheme;
  title: string;
  description: string;
  requiredEvidence: string[];
  slaDays: number;
  provisionalCredit: boolean;
};

export const REASON_CODES: Record<string, ReasonCode> = {
  "10.4": {
    code: "10.4",
    scheme: "Visa",
    title: "Other Fraud — Card-Absent Environment",
    description: "The cardholder does not recognise or did not authorise this card-absent transaction.",
    requiredEvidence: ["Signed cardholder statement of fraud", "Confirmation the card was not used by the holder", "Transaction and device details"],
    slaDays: 20,
    provisionalCredit: true,
  },
  "12.5": {
    code: "12.5",
    scheme: "Visa",
    title: "Incorrect Amount",
    description: "The amount charged differs from the amount the cardholder agreed to.",
    requiredEvidence: ["Receipt or order confirmation showing the agreed amount", "Cardholder statement of the correct amount"],
    slaDays: 30,
    provisionalCredit: false,
  },
  "12.6.1": {
    code: "12.6.1",
    scheme: "Visa",
    title: "Duplicate Processing",
    description: "A single transaction was processed more than once.",
    requiredEvidence: ["Both transaction records showing duplication", "Proof only one purchase was made"],
    slaDays: 20,
    provisionalCredit: true,
  },
  "13.1": {
    code: "13.1",
    scheme: "Visa",
    title: "Merchandise / Services Not Received",
    description: "The goods or services were not received by the expected date.",
    requiredEvidence: ["Order confirmation and expected delivery date", "Cardholder statement that nothing was received", "Any contact with the merchant"],
    slaDays: 30,
    provisionalCredit: false,
  },
  "13.2": {
    code: "13.2",
    scheme: "Visa",
    title: "Cancelled Recurring Transaction",
    description: "A recurring charge continued after the cardholder cancelled.",
    requiredEvidence: ["Proof of cancellation and its date", "The recurring charge after cancellation"],
    slaDays: 30,
    provisionalCredit: false,
  },
  "13.6": {
    code: "13.6",
    scheme: "Visa",
    title: "Credit Not Processed",
    description: "A refund or credit owed to the cardholder was not processed.",
    requiredEvidence: ["Proof of return or cancellation", "Merchant refund policy or promise", "Statement that no credit was received"],
    slaDays: 30,
    provisionalCredit: false,
  },
  "4837": {
    code: "4837",
    scheme: "Mastercard",
    title: "No Cardholder Authorisation",
    description: "The cardholder states they did not authorise the transaction.",
    requiredEvidence: ["Signed statement of unauthorised use", "Confirmation the card/credentials were not shared"],
    slaDays: 20,
    provisionalCredit: true,
  },
  "4853": {
    code: "4853",
    scheme: "Mastercard",
    title: "Cardholder Dispute",
    description: "A general cardholder dispute about the goods, services or billing.",
    requiredEvidence: ["Cardholder statement describing the dispute", "Any supporting documents or correspondence"],
    slaDays: 45,
    provisionalCredit: false,
  },
};

export function reasonCode(code: string): ReasonCode | undefined {
  return REASON_CODES[code];
}

// Derive a suggested reason code from the cardholder's stated reason.
export function suggestReasonCode(reason: string): string {
  const r = (reason ?? "").toLowerCase();
  if (/recognis|unrecognis|unauthoris|didn.?t make|not mine/.test(r)) return "10.4";
  if (/twice|double|duplicate/.test(r)) return "12.6.1";
  if (/cancel/.test(r)) return "13.2";
  if (/arriv|received|receive|deliver/.test(r)) return "13.1";
  if (/more than|wrong amount|charged more|too much|incorrect/.test(r)) return "12.5";
  if (/refund|returned|not refunded|credit/.test(r)) return "13.6";
  return "4853";
}

export const DAY_MS = 86_400_000;

// SLA deadline (ms epoch) for a dispute opened at openedAtMs under a code.
export function slaDeadline(openedAtMs: number, code: string): number | null {
  const rc = REASON_CODES[code];
  if (!rc) return null;
  return openedAtMs + rc.slaDays * DAY_MS;
}

// Whole days remaining until the SLA deadline (negative if overdue).
export function slaDaysRemaining(openedAtMs: number, code: string, nowMs: number): number | null {
  const deadline = slaDeadline(openedAtMs, code);
  if (deadline === null) return null;
  return Math.ceil((deadline - nowMs) / DAY_MS);
}
