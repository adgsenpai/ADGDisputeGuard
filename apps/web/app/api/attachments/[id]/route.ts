import { database } from "@/lib/auth/database";
import { userFromRequest } from "@/lib/api/request";
import { getStore } from "@/lib/api/store";
import { canView } from "@/lib/domain/access";
import type { Attachment } from "@/lib/control/attachments";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = userFromRequest(req);
  const attachment = database().prepare("SELECT * FROM attachments WHERE id=?").get((await ctx.params).id) as Attachment | undefined;
  const dispute = attachment && getStore().dispute(attachment.dispute_id); const tx = dispute && getStore().getTransaction(dispute.transactionId);
  if (!attachment || !tx || !canView(user, tx)) return Response.json({ error: "Attachment unavailable." }, { status: 404 });
  return new Response(new Uint8Array(attachment.bytes), { headers: { "content-type": attachment.mime, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}
