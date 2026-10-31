import { getStore } from "@/lib/api/store";
import { userFromRequest } from "@/lib/api/request";
import { canView } from "@/lib/domain/access";
import { database } from "@/lib/auth/database";
import { caseAttachments, detectMime } from "@/lib/control/attachments";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id); const user = userFromRequest(req); const store = getStore();
  const dispute = store.dispute(id); const tx = dispute && store.getTransaction(dispute.transactionId);
  if (!tx) return Response.json({ error: "Case not found." }, { status: 404 });
  if (!canView(user, tx)) return Response.json({ error: "not-authorised" }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) return Response.json({ error: "Choose a PDF, PNG or JPEG file to upload." }, { status: 400 });
  const fail = (error: string, status = 400) => Response.json({ error }, { status });
  const limit = 6 * 1024 * 1024;
  if (Number(req.headers.get("content-length")) > limit) return fail("Maximum file size is 5 MB.", 413);
  try {
    const reader = req.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); return fail("Maximum file size is 5 MB.", 413); } chunks.push(value); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": req.headers.get("content-type")! } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) return fail("Choose a non-empty file up to 5 MB.");
    const prior = caseAttachments(id);
    if (prior.length >= 20 || prior.reduce((n, a) => n + a.bytes.length, 0) + file.size > 25 * 1024 * 1024) return fail("This case has reached its attachment limit (20 files / 25 MB).");
    const bytes = new Uint8Array(await file.arrayBuffer()); const mime = detectMime(bytes);
    if (!mime) return fail("Unsupported file. Upload a PDF, PNG or JPEG.");
    if (mime === "application/pdf") { const pdf = await PDFDocument.load(bytes); if (pdf.isEncrypted || pdf.getPageCount() > 100) return fail("Use an unencrypted PDF with at most 100 pages."); }
    else await sharp(bytes, { limitInputPixels: 25000000 }).metadata();
    const storageName = randomUUID(); const filename = file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 120);
    const db = database(); db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT INTO attachments VALUES (?,?,?,?,?)").run(storageName, id, filename, mime, bytes);
      store.recordEvidence({ disputeId: id, actorId: user.id, storageName, sizeBytes: bytes.length, detectedType: mime });
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    return Response.json({ receipt: { storageName, filename, sizeBytes: bytes.length, detectedType: mime }, message: "File stored. Format checked; malware scanning is not configured." }, { status: 201 });
  } catch { return fail("The file could not be read. Check its format and try again."); }
}
