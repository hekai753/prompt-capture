import { readConfig, writeConfig, type AppConfig } from "../../storage/config.js";
import { storageRoot } from "../../storage/paths.js";
import { readOption } from "../args.js";

export async function configCommand(args: string[]): Promise<void> {
  const [action, key, value] = positionalArgs(args);
  const root = storageRoot(readOption(args, "--home"));
  if (action === "get") {
    process.stdout.write(`${JSON.stringify(await readConfig(root), null, 2)}\n`);
    return;
  }
  if (action === "set") {
    if (!key || value === undefined) {
      throw new Error("Usage: prompt-capture config set rawPayloads true|false OR markdownMode realtime|manual");
    }
    const config = await readConfig(root);
    const updated = setConfigValue(config, key, value);
    await writeConfig(root, updated);
    process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    return;
  }
  throw new Error("Usage: prompt-capture config get|set");
}

function positionalArgs(args: string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--home") {
      index += 1;
      continue;
    }
    if (arg?.startsWith("--home=")) continue;
    if (arg !== undefined) out.push(arg);
  }
  return out;
}

function setConfigValue(config: AppConfig, key: string, value: string): AppConfig {
  if (key === "rawPayloads") {
    return { ...config, rawPayloads: parseBoolean(value) };
  }
  if (key === "markdownMode") {
    if (value !== "realtime" && value !== "manual") {
      throw new Error("markdownMode must be realtime or manual");
    }
    return { ...config, markdownMode: value };
  }
  throw new Error(`Unsupported config key: ${key}`);
}

function parseBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Boolean config values must be true or false");
}
