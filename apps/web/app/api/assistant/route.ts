import { readJson, userFromRequest } from "@/lib/api/request";
import { answerAssistant, assistantContext } from "@/lib/control/assistant";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const active = new Set<number>();
export async function POST(req: Request) {
  const user = userFromRequest(req);
  const body = await readJson(req);
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000) return Response.json({ error: "Ask a question of up to 2,000 characters." }, { status: 400 });
  const transactionId = body.transactionId === undefined ? undefined : Number(body.transactionId);
  try { assistantContext(user, transactionId); } catch { return Response.json({ error: "Payment unavailable to this account." }, { status: 403 }); }
  if (active.has(user.id)) return Response.json({ error: "An investigation is already running. Please wait for it to finish." }, { status: 429 });
  active.add(user.id);
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(value) + "\n")); };
      try {
        const result = await answerAssistant(user, String(body.message), transactionId, label => send({ type: "progress", label }));
        send({ type: "result", ...result });
      } catch { send({ type: "error", error: "The investigation could not finish. Please try again." }); }
      finally { active.delete(user.id); if (!cancelled) controller.close(); }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
