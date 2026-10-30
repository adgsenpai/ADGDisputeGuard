// Evidence upload validation workflow.
// TypeScript port of engine/src/evidence.rs.

export type EvidencePolicy = {
  maxSizeBytes: number;
  allowedTypes: string[];
  allowedExtensions: string[];
  scanningRequired: boolean;
};

export function demoPolicy(): EvidencePolicy {
  return {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedTypes: ["application/pdf", "image/png", "image/jpeg"],
    allowedExtensions: ["pdf", "png", "jpg", "jpeg"],
    scanningRequired: true,
  };
}

export type Upload = {
  name: string;
  declaredType: string;
  detectedType: string;
  sizeBytes: number;
};

export type ScanResult = "clean" | "infected" | "unavailable";

export type EvidenceError =
  | { kind: "not-authorised" }
  | { kind: "too-large"; size: number; limit: number }
  | { kind: "declared-type-not-allowed" }
  | { kind: "extension-not-allowed" }
  | { kind: "detected-type-not-allowed" }
  | { kind: "scanner-unavailable" }
  | { kind: "scan-not-clean" };

export type EvidenceReceipt = {
  disputeId: number;
  storageName: string;
  sizeBytes: number;
  detectedType: string;
};

export function isEvidenceError(v: EvidenceReceipt | EvidenceError): v is EvidenceError {
  return (v as EvidenceError).kind !== undefined;
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? null : name.slice(dot + 1).toLowerCase();
}

// Validate and record an evidence upload. Checks run in order; the first
// failure short-circuits so nothing is recorded for a rejected upload.
export function receiveEvidence(
  maySubmit: boolean,
  disputeId: number,
  upload: Upload,
  policy: EvidencePolicy,
  storageName: string,
  scan: () => ScanResult,
): EvidenceReceipt | EvidenceError {
  if (!maySubmit) return { kind: "not-authorised" };
  if (upload.sizeBytes > policy.maxSizeBytes) {
    return { kind: "too-large", size: upload.sizeBytes, limit: policy.maxSizeBytes };
  }
  if (!policy.allowedTypes.includes(upload.declaredType)) {
    return { kind: "declared-type-not-allowed" };
  }
  const ext = extensionOf(upload.name);
  if (ext === null || !policy.allowedExtensions.includes(ext)) {
    return { kind: "extension-not-allowed" };
  }
  if (!policy.allowedTypes.includes(upload.detectedType)) {
    return { kind: "detected-type-not-allowed" };
  }
  if (policy.scanningRequired) {
    const result = scan();
    if (result === "infected") return { kind: "scan-not-clean" };
    if (result === "unavailable") return { kind: "scanner-unavailable" };
  }
  return {
    disputeId,
    storageName,
    sizeBytes: upload.sizeBytes,
    detectedType: upload.detectedType,
  };
}
