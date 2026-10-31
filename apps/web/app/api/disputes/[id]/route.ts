import { userFromRequest } from "@/lib/api/request";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { getDispute } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = userFromRequest(req);
  const dispute = getStore().dispute(Number(id));
  if (dispute && user.role === "customer" && getStore().getTransaction(dispute.transactionId)?.ownerId !== user.id) return NextResponse.json({ error: "not-authorised" }, { status: 403 });
  const result = getDispute(getStore(), Number(id));
  return NextResponse.json(result.body, { status: result.status });
}
