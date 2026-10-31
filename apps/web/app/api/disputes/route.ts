import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { createDispute, listDisputes } from "@/lib/api/handlers";
import { readJson, userFromRequest } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = userFromRequest(req);
  const disputes = getStore().allDisputes().filter(d => user.role !== "customer" || getStore().getTransaction(d.transactionId)?.ownerId === user.id);
  const result = { status: 200, body: { disputes } };
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: Request) {
  const user = userFromRequest(req);
  const body = await readJson(req);
  const result = createDispute(getStore(), user, body);
  return NextResponse.json(result.body, { status: result.status });
}
