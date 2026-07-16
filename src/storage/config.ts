import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { configPath } from "./paths.js";

export type AppConfig = {
  rawPayloads: boolean;
  markdownMode: "realtime" | "manual";
};

const DEFAULT_CONFIG: AppConfig = {
  rawPayloads: false,
  markdownMode: "realtime",
};

export async function readConfig(root: string): Promise<AppConfig> {
  try {
    const parsed = JSON.parse(await readFile(configPath(root), "utf8")) as Partial<AppConfig>;
    return {
      rawPayloads: parsed.rawPayloads ?? DEFAULT_CONFIG.rawPayloads,
      markdownMode: parsed.markdownMode === "manual" ? "manual" : "realtime",
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function writeConfig(root: string, config: AppConfig): Promise<void> {
  const path = configPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
