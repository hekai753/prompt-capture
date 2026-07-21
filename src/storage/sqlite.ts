import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CaptureEvent, CaptureEventKind } from "../adapters/types.js";
import { localDate } from "../capture/project.js";
import { sqlitePath } from "./paths.js";

export type EventIndex = {
  events: CaptureEvent[];
};

async function readIndex(root: string): Promise<EventIndex> {
  try {
    return JSON.parse(await readFile(sqlitePath(root), "utf8")) as EventIndex;
  } catch {
    return { events: [] };
  }
}

async function writeIndex(root: string, index: EventIndex): Promise<void> {
  const path = sqlitePath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function upsertEvent(root: string, event: CaptureEvent): Promise<void> {
  const index = await readIndex(root);
  const existing = index.events.findIndex((entry) => entry.id === event.id || entry.payloadHash === event.payloadHash);
  if (existing >= 0) {
    index.events[existing] = event;
  } else {
    index.events.push(event);
  }
  index.events.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  await writeIndex(root, index);
}

export async function listEvents(root: string, filter: {
  project?: string;
  date?: string;
  source?: string;
  kind?: CaptureEventKind;
  q?: string;
} = {}): Promise<CaptureEvent[]> {
  const index = await readIndex(root);
  const query = filter.q?.toLowerCase();
  return index.events.filter((event) => {
    if (filter.project && event.projectSlug !== filter.project) return false;
    if (filter.date && localDate(event.capturedAt) !== filter.date) return false;
    if (filter.source && event.source !== filter.source) return false;
    if (filter.kind && event.kind !== filter.kind) return false;
    if (query) {
      const haystack = [
        event.prompt,
        event.toolName,
        event.projectPath,
        event.sessionId,
        event.rawEventName,
      ].filter(Boolean).join("\n").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export async function listProjects(root: string): Promise<Array<{ slug: string; path: string; count: number }>> {
  const index = await readIndex(root);
  const map = new Map<string, { slug: string; path: string; count: number }>();
  for (const event of index.events) {
    const current = map.get(event.projectSlug) ?? { slug: event.projectSlug, path: event.projectPath, count: 0 };
    current.count += 1;
    map.set(event.projectSlug, current);
  }
  return [...map.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getEvent(root: string, id: string): Promise<CaptureEvent | undefined> {
  const index = await readIndex(root);
  return index.events.find((event) => event.id === id);
}

export async function relatedEvents(root: string, id: string): Promise<CaptureEvent[]> {
  const event = await getEvent(root, id);
  if (!event) return [];
  const index = await readIndex(root);
  return index.events.filter((candidate) => {
    if (candidate.id === id) return false;
    if (event.turnId && candidate.turnId === event.turnId) return true;
    if (event.sessionId && candidate.sessionId === event.sessionId) return true;
    return false;
  });
}
