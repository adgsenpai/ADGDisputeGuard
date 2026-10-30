import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { getDispute } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = getDispute(getStore(), Number(id));
  return NextResponse.json(result.body, { status: result.status });
}
