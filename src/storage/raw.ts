import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureEvent } from "../adapters/types.js";
import { localDate } from "../capture/project.js";
import { rawDir } from "./paths.js";

export async function writeRawPayload(
  root: string,
  event: CaptureEvent,
  raw: string,
): Promise<string> {
  const date = localDate(event.capturedAt);
  const dir = join(rawDir(root), event.source, date);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${event.id}.json`);
  await writeFile(path, raw.endsWith("\n") ? raw : `${raw}\n`, "utf8");
  return path;
}
