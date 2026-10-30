import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { runInvestigation } from "@/lib/api/investigation";

export const dynamic = "force-dynamic";
// Allow time for a local model to respond.
export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await runInvestigation(getStore(), Number(id));
  return NextResponse.json(result.body, { status: result.status });
}
