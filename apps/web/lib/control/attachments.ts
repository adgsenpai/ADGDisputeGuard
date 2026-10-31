import { database } from "../auth/database";
export type Attachment = { id: string; dispute_id: number; filename: string; mime: string; bytes: Uint8Array };
export function caseAttachments(disputeId: number) { return database().prepare("SELECT * FROM attachments WHERE dispute_id=? ORDER BY rowid").all(disputeId) as Attachment[]; }
export function detectMime(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  return null;
}
