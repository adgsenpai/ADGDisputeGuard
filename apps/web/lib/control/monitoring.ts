import type { SeedTransaction } from "../api/store";

export type StatementRow = SeedTransaction & { bookedAt: string };
export type Finding = { transactionId: number; ownerId: number; merchant: string; amountMinor: number; reasons: string[]; severity: "review" | "attention" };

// Fixed sample booking times: refreshing never pretends a new bank feed arrived.
export function statementRows(transactions: SeedTransaction[]): StatementRow[] {
  return transactions.map((t, i) => ({ ...t, bookedAt: new Date(Date.UTC(2026, 9, 26 + (i % 5), 9 + (i % 8), 12)).toISOString() }));
}

export function scanTransactions(rows: StatementRow[], thresholdMinor = 200000): Finding[] {
  return rows.flatMap(row => {
    const reasons: string[] = [];
    if (row.amountMinor >= thresholdMinor) reasons.push(`Payment exceeds the R${(thresholdMinor / 100).toLocaleString("en-ZA")} review threshold.`);
    const peers = rows.filter(t => t.ownerId === row.ownerId && t.id !== row.id).map(t => t.amountMinor).sort((a, b) => a - b);
    const median = peers.length % 2 ? peers[Math.floor(peers.length / 2)] : (peers[peers.length / 2 - 1] + peers[peers.length / 2]) / 2;
    if (peers.length >= 4 && row.amountMinor >= 50000 && row.amountMinor > median * 3) reasons.push("More than three times the median of this customer's other sample payments.");
    if (rows.some(t => t.id !== row.id && t.ownerId === row.ownerId && t.merchant.toLowerCase() === row.merchant.toLowerCase() && t.amountMinor === row.amountMinor && Math.abs(Date.parse(t.bookedAt) - Date.parse(row.bookedAt)) <= 300000)) reasons.push("Matching merchant and amount within five minutes; check for a duplicate.");
    return reasons.length ? [{ transactionId: row.id, ownerId: row.ownerId, merchant: row.merchant, amountMinor: row.amountMinor, reasons, severity: reasons.length > 1 ? "attention" as const : "review" as const }] : [];
  });
}
