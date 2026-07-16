import { addHooks, parseHookEvents } from "../../hooks/manifest.js";
import { parseScope, parseTarget, resolveTargetConfig } from "../../hooks/targets.js";
import { backupFile, readJsonFile, writeJsonAtomic } from "../../hooks/config.js";
import { hasFlag, readOption } from "../args.js";
import type { HookTarget } from "../../adapters/types.js";

export async function installCommand(args: string[]): Promise<void> {
  const target = parseTarget(readOption(args, "--target"));
  const scope = parseScope(readOption(args, "--scope"));
  const dryRun = hasFlag(args, "--dry-run");
  const events = parseHookEvents(readOption(args, "--events"));
  const targets: HookTarget[] = target === "all" ? ["claude", "codex"] : [target];

  for (const item of targets) {
    const config = resolveTargetConfig(item, scope);
    const existing = await readJsonFile(config.path);
    const updated = addHooks(existing, config.source, events);
    if (dryRun) {
      process.stdout.write(`[dry-run] would update ${config.path}\n`);
      process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    } else {
      const backup = await backupFile(config.path);
      await writeJsonAtomic(config.path, updated);
      process.stdout.write(`updated ${config.path}\n`);
      if (backup) process.stdout.write(`backup ${backup}\n`);
    }
    for (const note of config.notes) {
      process.stdout.write(`note: ${note}\n`);
    }
    process.stdout.write(`events: ${events.join(",")}\n`);
  }
}
