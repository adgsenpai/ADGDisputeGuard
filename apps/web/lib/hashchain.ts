// Tamper-evident hash chain for the audit log. Each entry's hash covers the
// previous entry's hash plus the entry's own content, so altering, inserting or
// removing any entry breaks the chain from that point on. Server-side only
// (uses node:crypto); the client only displays the verification result.

import { createHash } from "node:crypto";

export const GENESIS = "0".repeat(64);

export function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// The content of an audit entry that the chain commits to.
export type ChainCore = { seq: number; disputeId: number; actorId: number; detail: unknown };

export function linkHash(prevHash: string, core: ChainCore): string {
  return sha256hex(`${prevHash}|${JSON.stringify(core)}`);
}

export type ChainEntry = ChainCore & { prevHash: string; hash: string };

export type VerifyResult = {
  valid: boolean;
  length: number;
  head: string;
  brokenAt?: number;
};

// Recompute the chain and check every stored hash. Returns the head hash and,
// if tampered, the seq of the first entry that does not verify.
export function verifyChain(entries: ChainEntry[]): VerifyResult {
  let prev = GENESIS;
  for (const e of entries) {
    const expected = linkHash(prev, { seq: e.seq, disputeId: e.disputeId, actorId: e.actorId, detail: e.detail });
    if (e.prevHash !== prev || e.hash !== expected) {
      return { valid: false, length: entries.length, head: prev, brokenAt: e.seq };
    }
    prev = e.hash;
  }
  return { valid: true, length: entries.length, head: prev };
}
