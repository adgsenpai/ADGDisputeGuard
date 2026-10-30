import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { transitionDispute } from "@/lib/api/handlers";
import { readJson, userFromRequest } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = userFromRequest(req);
  const body = await readJson(req);
  const result = transitionDispute(getStore(), actor, Number(id), body);
  return NextResponse.json(result.body, { status: result.status });
}
