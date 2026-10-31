import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaseReportData } from "./case-report";
import type { Attachment } from "../control/attachments";

const clean = (text: string) => text.replace(/[—–]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\u00a0/g, " ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e\n]/g, "?");
export async function renderCasePdf(data: CaseReportData, attachments: Attachment[]) {
  const doc = await PDFDocument.create();
  doc.setTitle(`DisputeGuard - Case ${data.disputeId}`); doc.setAuthor("adgsenpai"); doc.setSubject("Case report, evidence register and attachments"); doc.setCreator("DisputeGuard Showcase");
  const regular = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await sharp(await readFile(join(process.cwd(), "public/brand/disputeguard-logo.svg"))).resize(180, 180).png().toBuffer();
  const logo = await doc.embedPng(logoBytes);
  const blue = rgb(.12,.34,.74), ink = rgb(.12,.17,.27), muted = rgb(.4,.46,.55), pale = rgb(.94,.96,.99);
  let page!: PDFPage; let y = 0;
  function newPage() { page = doc.addPage([595.28, 841.89]); y = 728; }
  function ensure(height: number) { if (y - height < 78) newPage(); }
  function text(value: string, size = 10, strong = false, color = ink) {
    const font = strong ? bold : regular;
    const paragraphs = clean(value).split("\n");
    for (const paragraph of paragraphs) {
      let line = "";
      const words = paragraph.split(/\s+/).flatMap(w => w.length > 65 ? w.match(/.{1,65}/g)! : [w]);
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > 495 && line) { ensure(size + 6); page.drawText(line, { x: 50, y, size, font, color }); y -= size + 6; line = word; } else line = next;
      }
      ensure(size + 6); if (line) page.drawText(line, { x: 50, y, size, font, color }); y -= size + 6;
    }
  }
  function section(title: string) { ensure(65); y -= 14; page.drawRectangle({ x: 42, y: y - 7, width: 511, height: 27, color: pale }); text(title.toUpperCase(), 10, true, blue); y -= 14; }
  function row(label: string, value: string) { text(`${label}: ${value}`); }
  newPage();
  text(`Case report #${data.disputeId}`, 26, true); y -= 6;
  text(`Generated ${data.generatedAt}`, 9, false, muted);
  text("SHOWCASE RECORD - no bank integration or movement of money", 9, true, blue);
  section("Case summary");
  row("Status", data.state.replaceAll("_", " ")); row("Version", String(data.version)); row("Opened", data.openedAt || "Not recorded");
  if (data.reason) row("Reason code", `${data.reason.scheme} ${data.reason.code} - ${data.reason.title}`);
  if (data.riskPct !== null) row("Advisory indicator", `${data.riskPct}% - does not decide the case`);
  if (data.txn) { section("Payment details"); row("Transaction", `#${data.txn.id}`); row("Merchant", data.txn.merchant); row("Category", data.txn.category); row("Amount", data.txn.amount); row("Reported concern", data.txn.reason); }
  section("Case timeline");
  for (const event of data.events) { text(`#${event.seq}  ${event.text}`, 10, true); text(`Actor #${event.actorId}`, 9, false, muted); y -= 5; }
  if (!data.events.length) text("No events recorded.");
  section("Evidence & attachment register");
  text("Uploaded files are format-checked. Malware scanning is not configured. Originals are embedded in this PDF; use a PDF reader's Attachments panel to save them.", 9, false, muted);
  if (!data.evidence.length) text("No supporting evidence has been submitted.");
  for (const [index, evidence] of data.evidence.entries()) {
    const attachment = attachments.find(a => a.id === evidence.storageName);
    ensure(75); text(`${index + 1}. ${attachment?.filename || evidence.storageName}`, 10, true);
    text(`${evidence.detectedType} | ${(evidence.sizeBytes / 1024).toFixed(1)} KB | ${attachment ? "Original attached; preview follows where supported" : "Metadata only - original file unavailable"}`, 9, false, muted);
    text(`Reference: ${evidence.storageName}`, 8, false, muted); y -= 5;
  }
  section("Investigation findings");
  if (!data.investigations.length) text("No investigation has been completed.");
  for (const inv of data.investigations) { text(`${inv.model} - ${inv.stage}`, 10, true); text(`${inv.observations} observations | ${inv.toolCalls} tool calls`, 9, false, muted); text(inv.summary); y -= 8; }
  section("Integrity & review notes");
  text("Case events are included in the workspace's SHA-256 audit chain. Chain head at export:", 9);
  text(data.auditHead, 8, false, muted);
  text("Review the original evidence and case history before making a decision. This report records the application's state at export; it does not certify a payment or establish fraud.", 9);
  let previewPages = 0;
  for (const [index, attachment] of attachments.entries()) {
    const embedName = `${index + 1}-${attachment.filename}`;
    await doc.attach(attachment.bytes, embedName, { mimeType: attachment.mime, description: `Evidence for case #${data.disputeId}; reference ${attachment.id}` });
    if (previewPages >= 12) continue;
    try {
      if (attachment.mime === "application/pdf") {
        const source = await PDFDocument.load(attachment.bytes);
        const count = Math.min(source.getPageCount(), 12 - previewPages);
        const pages = await doc.embedPdf(attachment.bytes, Array.from({ length: count }, (_, i) => i));
        for (let i = 0; i < pages.length; i++) {
          newPage(); text(`Attachment ${index + 1} - ${attachment.filename}`, 12, true); text(`Original page ${i + 1} of ${source.getPageCount()}. Full original is embedded.`, 9, false, muted);
          const embedded = pages[i]; const scale = Math.min(495 / embedded.width, 595 / embedded.height);
          page.drawPage(embedded, { x: 50 + (495 - embedded.width * scale) / 2, y: 85 + (595 - embedded.height * scale) / 2, width: embedded.width * scale, height: embedded.height * scale }); previewPages++;
        }
      } else {
        const png = await sharp(attachment.bytes, { limitInputPixels: 25000000 }).rotate().resize({ width: 1500, height: 1800, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        const img = await doc.embedPng(png); newPage(); text(`Attachment ${index + 1} - ${attachment.filename}`, 12, true); text("Preview of the submitted image. Full original is embedded.", 9, false, muted);
        const scale = Math.min(495 / img.width, 595 / img.height);
        page.drawImage(img, { x: 50 + (495 - img.width * scale) / 2, y: 85 + (595 - img.height * scale) / 2, width: img.width * scale, height: img.height * scale }); previewPages++;
      }
    } catch { newPage(); text(`Attachment ${index + 1}`, 15, true); text("A preview could not be rendered. The original file is embedded in this report."); }
  }
  const pages = doc.getPages();
  for (const [index, p] of pages.entries()) {
    p.drawRectangle({ x: 0, y: 835, width: 595.28, height: 7, color: blue });
    p.drawImage(logo, { x: 43, y: 765, width: 44, height: 44 });
    p.drawText("DisputeGuard", { x: 98, y: 790, size: 18, font: bold, color: blue });
    p.drawText("ADGSTUDIOS  /  SHOWCASE", { x: 99, y: 774, size: 8, font: regular, color: muted });
    p.drawText(`CASE #${data.disputeId}`, { x: 460, y: 790, size: 10, font: bold, color: blue });
    p.drawLine({ start: { x: 43, y: 752 }, end: { x: 552, y: 752 }, thickness: .8, color: rgb(.82,.87,.94) });
    p.drawLine({ start: { x: 43, y: 58 }, end: { x: 552, y: 58 }, thickness: .8, color: rgb(.82,.87,.94) });
    p.drawText("PRIVATE CASE RECORD  |  Review flags are advisory", { x: 43, y: 41, size: 7.5, font: regular, color: muted });
    p.drawText(`${index + 1} / ${pages.length}`, { x: 516, y: 41, size: 8, font: bold, color: blue });
  }
  return doc.save();
}
