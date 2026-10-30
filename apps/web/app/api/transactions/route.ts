import { NextResponse } from "next/server";
import { getStore, SEED_TRANSACTIONS } from "@/lib/api/store";
import { listTransactions } from "@/lib/api/handlers";
import { userFromRequest } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  getStore(); // ensure seeded
  const user = userFromRequest(req);
  const result = listTransactions(
    SEED_TRANSACTIONS.map((t) => ({ id: t.id, ownerId: t.ownerId })),
    user,
  );
  // Enrich with display fields for the UI.
  const byId = new Map(SEED_TRANSACTIONS.map((t) => [t.id, t]));
  const body = result.body as { transactions: { id: number }[] };
  const enriched = body.transactions.map((t) => byId.get(t.id));
  return NextResponse.json({ transactions: enriched }, { status: result.status });
}
