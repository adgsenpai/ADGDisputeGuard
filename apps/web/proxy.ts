import { NextResponse, type NextRequest } from "next/server";
import { authenticatedUser } from "./lib/auth/session";
export function proxy(req: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const expected = new URL(process.env.APP_URL || req.url).origin;
    if (origin && origin !== expected) return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }
  if (req.nextUrl.pathname === "/api/auth") return NextResponse.next();
  if (!authenticatedUser(req)) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
