import { createHash, randomUUID } from "node:crypto";

export function stablePayloadHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function eventId(source: string, kind: string, capturedAt: string, hash: string): string {
  const compactTime = capturedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `evt_${compactTime}_${source.replace(/[^a-z0-9-]/gi, "")}_${kind}_${hash.slice(0, 12) || randomUUID().slice(0, 12)}`;
}
