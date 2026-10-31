import { NextResponse } from "next/server";
import { getStore, SEED_TRANSACTIONS } from "@/lib/api/store";
import { listInvestigations } from "@/lib/api/handlers";
import { userFromRequest } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const store = getStore();
  const user = userFromRequest(req);
  const result = listInvestigations(
    store,
    user,
    SEED_TRANSACTIONS.map((t) => ({ id: t.id, ownerId: t.ownerId })),
  );
  return NextResponse.json(result.body, { status: result.status });
}
