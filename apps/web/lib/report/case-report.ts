// Renders an audit-ready per-case dispute report as a self-contained LaTeX
// document. Pure and testable; the route compiles it to PDF with pdflatex.

export type CaseReportData = {
  disputeId: number;
  state: string;
  version: number;
  openedAt: string | null;
  txn: { id: number; merchant: string; category: string; amount: string; reason: string } | null;
  reason: { scheme: string; code: string; title: string; description: string; slaDays: number } | null;
  riskPct: number | null;
  events: { seq: number; actorId: number; text: string }[];
  evidence: { storageName: string; detectedType: string; sizeBytes: number }[];
  investigations: { stage: string; model: string; toolCalls: number; observations: number; summary: string }[];
  auditHead: string;
  generatedAt: string;
};

export function texEscape(s: string): string {
  return String(s)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

function kvRow(label: string, value: string): string {
  return `\\textbf{${texEscape(label)}} & ${texEscape(value)} \\\\`;
}

export function renderCaseReportTex(d: CaseReportData): string {
  const lines: string[] = [];
  lines.push("\\documentclass[11pt]{article}");
  lines.push("\\usepackage[margin=2cm]{geometry}");
  lines.push("\\usepackage[table]{xcolor}");
  lines.push("\\usepackage{helvet}");
  lines.push("\\renewcommand{\\familydefault}{\\sfdefault}");
  lines.push("\\usepackage{array}");
  lines.push("\\usepackage{longtable}");
  lines.push("\\definecolor{brand}{HTML}{14B8A6}");
  lines.push("\\definecolor{ink}{HTML}{1F2937}");
  lines.push("\\setlength{\\parindent}{0pt}");
  lines.push("\\begin{document}");
  lines.push("\\pagestyle{empty}");

  lines.push("{\\color{brand}\\Large\\textbf{ADGSTUDIOS DisputeGuard}}\\\\[2pt]");
  lines.push(`{\\large\\textbf{Dispute Case Report — \\#${d.disputeId}}}\\\\[2pt]`);
  lines.push(`{\\small Generated ${texEscape(d.generatedAt)} \\quad Demonstration data — not a real financial record.}\\\\[10pt]`);

  // Case summary
  lines.push("{\\color{brand}\\textbf{Case summary}}\\\\[3pt]");
  lines.push("\\begin{tabular}{@{}p{4.5cm}p{11cm}@{}}");
  lines.push(kvRow("Dispute", `#${d.disputeId} (version ${d.version})`));
  lines.push(kvRow("State", d.state.replace(/_/g, " ")));
  lines.push(kvRow("Opened", d.openedAt ?? "—"));
  if (d.reason) {
    lines.push(kvRow("Reason code", `${d.reason.scheme} ${d.reason.code} — ${d.reason.title}`));
    lines.push(kvRow("Resolution SLA", `${d.reason.slaDays} days`));
  }
  if (d.riskPct !== null) lines.push(kvRow("Advisory risk", `${d.riskPct}% (advisory only)`));
  lines.push("\\end{tabular}\\\\[10pt]");

  // Transaction
  if (d.txn) {
    lines.push("{\\color{brand}\\textbf{Transaction}}\\\\[3pt]");
    lines.push("\\begin{tabular}{@{}p{4.5cm}p{11cm}@{}}");
    lines.push(kvRow("Merchant", d.txn.merchant));
    lines.push(kvRow("Category", d.txn.category));
    lines.push(kvRow("Amount", d.txn.amount));
    lines.push(kvRow("Stated reason", d.txn.reason));
    lines.push("\\end{tabular}\\\\[10pt]");
  }

  if (d.reason) {
    lines.push("{\\color{brand}\\textbf{Reason code detail}}\\\\[3pt]");
    lines.push(`${texEscape(d.reason.description)}\\\\[10pt]`);
  }

  // Lifecycle / audit trail
  lines.push("{\\color{brand}\\textbf{Audit trail}}\\\\[3pt]");
  lines.push("\\begin{longtable}{@{}p{1.2cm}p{11.8cm}p{2cm}@{}}");
  lines.push("\\textbf{Seq} & \\textbf{Event} & \\textbf{Actor} \\\\ \\hline");
  if (d.events.length === 0) lines.push("— & No events & — \\\\");
  for (const e of d.events) {
    lines.push(`${e.seq} & ${texEscape(e.text)} & ${e.actorId} \\\\`);
  }
  lines.push("\\end{longtable}");
  lines.push("\\vspace{6pt}");

  // Evidence
  lines.push("{\\color{brand}\\textbf{Evidence register}}\\\\[3pt]");
  if (d.evidence.length === 0) {
    lines.push("No evidence recorded.\\\\[10pt]");
  } else {
    lines.push("\\begin{tabular}{@{}p{7cm}p{5cm}p{2.5cm}@{}}");
    lines.push("\\textbf{Storage name} & \\textbf{Type} & \\textbf{Size} \\\\ \\hline");
    for (const ev of d.evidence) {
      lines.push(`${texEscape(ev.storageName)} & ${texEscape(ev.detectedType)} & ${Math.round(ev.sizeBytes / 1024)} KB \\\\`);
    }
    lines.push("\\end{tabular}\\\\[10pt]");
  }

  // Investigations
  lines.push("{\\color{brand}\\textbf{Investigations}}\\\\[3pt]");
  if (d.investigations.length === 0) {
    lines.push("No investigation run.\\\\[10pt]");
  } else {
    for (const inv of d.investigations) {
      lines.push(`\\textbf{${texEscape(inv.model)}} — stage ${texEscape(inv.stage)}, ${inv.observations} observation(s), ${inv.toolCalls} tool call(s).\\\\`);
      lines.push(`${texEscape(inv.summary)}\\\\[6pt]`);
    }
  }

  // Integrity
  lines.push("\\vspace{4pt}{\\color{brand}\\textbf{Integrity}}\\\\[3pt]");
  lines.push(`This case's events belong to a tamper-evident SHA-256 hash chain. Current chain head:\\\\`);
  lines.push(`\\texttt{\\small ${texEscape(d.auditHead)}}\\\\[10pt]`);

  lines.push("{\\footnotesize This report is generated from demonstration data. Risk indicators are advisory and never decide a dispute.}");
  lines.push("\\end{document}");
  return lines.join("\n");
}
