import { parseSource } from "../../adapters/index.js";
import { normalizeEvent } from "../../capture/normalize.js";
import { readConfig } from "../../storage/config.js";
import { appendEvent } from "../../storage/jsonl.js";
import { refreshMarkdownForEvent } from "../../storage/markdown.js";
import { storageRoot } from "../../storage/paths.js";
import { writeRawPayload } from "../../storage/raw.js";
import { upsertEvent } from "../../storage/sqlite.js";
import { hasFlag, readOption } from "../args.js";
import { readStdin } from "../stdin.js";

export async function ingestCommand(args: string[]): Promise<void> {
  const source = parseSource(readOption(args, "--source"));
  const root = storageRoot(readOption(args, "--home"));
  const raw = await readStdin();
  if (!raw.trim()) throw new Error("No hook payload received on stdin");
  const config = await readConfig(root);
  const { event, redactedRaw } = normalizeEvent(source, raw);
  let finalEvent = event;
  if (config.rawPayloads) {
    const rawPayloadPath = await writeRawPayload(root, event, redactedRaw);
    finalEvent = { ...event, rawPayloadPath };
  }
  await appendEvent(root, finalEvent);
  await upsertEvent(root, finalEvent);
  if (config.markdownMode === "realtime") {
    await refreshMarkdownForEvent(root, finalEvent);
  }
  if (hasFlag(args, "--print-id")) {
    process.stdout.write(`${finalEvent.id}\n`);
  }
}
