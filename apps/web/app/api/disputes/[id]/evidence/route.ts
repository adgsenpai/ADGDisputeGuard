import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { submitEvidence } from "@/lib/api/handlers";
import { randomStorageName, readJson, userFromRequest } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = userFromRequest(req);
  const body = await readJson(req);
  const result = submitEvidence(getStore(), user, Number(id), body, randomStorageName());
  return NextResponse.json(result.body, { status: result.status });
}
