import { homedir } from "node:os";
import { join } from "node:path";

export function storageRoot(explicit?: string): string {
  return explicit || process.env.PROMPT_CAPTURE_HOME || join(homedir(), ".prompt-capture");
}

export function configPath(root: string): string {
  return join(root, "config.json");
}

export function installedHooksPath(root: string): string {
  return join(root, "installed-hooks.json");
}

export function sqlitePath(root: string): string {
  return join(root, "index.json");
}

export function eventsDir(root: string): string {
  return join(root, "events");
}

export function rawDir(root: string): string {
  return join(root, "raw");
}

export function markdownDir(root: string): string {
  return join(root, "md");
}

export function webStatePath(root: string): string {
  return join(root, "web-server.json");
}

export function webLogPath(root: string): string {
  return join(root, "web-server.log");
}
