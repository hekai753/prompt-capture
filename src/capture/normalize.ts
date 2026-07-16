import type { CaptureEvent, CaptureSource } from "../adapters/types.js";
import { adapterFor } from "../adapters/index.js";
import { eventId, stablePayloadHash } from "./event-id.js";
import { projectSlug } from "./project.js";
import { redactValue } from "./redact.js";

export function normalizeEvent(source: CaptureSource, raw: string): { event: CaptureEvent; redactedRaw: string } {
  const payload = JSON.parse(raw) as unknown;
  const redactedPayload = redactValue(payload);
  const redactedRaw = JSON.stringify(redactedPayload, null, 2);
  const draft = adapterFor(source).normalize(redactedPayload);
  const capturedAt = draft.capturedAt ?? new Date().toISOString();
  const payloadHash = stablePayloadHash(`${source}\n${redactedRaw}`);
  const kind = draft.kind;
  const projectPath = draft.projectPath || process.cwd();
  const event: CaptureEvent = {
    ...draft,
    source,
    kind,
    capturedAt,
    payloadHash,
    id: eventId(source, kind, capturedAt, payloadHash),
    projectPath,
    projectSlug: draft.projectSlug ?? projectSlug(projectPath),
  };
  return { event, redactedRaw };
}
