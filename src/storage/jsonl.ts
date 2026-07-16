import { mkdir, appendFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureEvent } from "../adapters/types.js";
import { localDate } from "../capture/project.js";
import { eventsDir } from "./paths.js";

export async function appendEvent(root: string, event: CaptureEvent): Promise<void> {
  const dir = eventsDir(root);
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, `${localDate(event.capturedAt)}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
}

export async function readAllEvents(root: string): Promise<CaptureEvent[]> {
  const dir = eventsDir(root);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const events: CaptureEvent[] = [];
  for (const name of names.filter((entry) => entry.endsWith(".jsonl")).sort()) {
    const content = await readFile(join(dir, name), "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      events.push(JSON.parse(line) as CaptureEvent);
    }
  }
  return events;
}
