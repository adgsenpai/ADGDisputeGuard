import { NextResponse } from "next/server";
import { getStore } from "@/lib/api/store";
import { verifyAudit } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = verifyAudit(getStore());
  return NextResponse.json(result.body, { status: result.status });
}
