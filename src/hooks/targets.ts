import { homedir } from "node:os";
import { join } from "node:path";
import type { HookScope, HookTarget } from "../adapters/types.js";

export type TargetConfig = {
  target: HookTarget;
  source: "claude-code" | "codex";
  path: string;
  kind: "json";
  notes: string[];
};

export function resolveTargetConfig(target: HookTarget, scope: HookScope, cwd = process.cwd()): TargetConfig {
  if (target === "claude") {
    return {
      target,
      source: "claude-code",
      path: scope === "global" ? join(homedir(), ".claude", "settings.json") : join(cwd, ".claude", "settings.json"),
      kind: "json",
      notes: [],
    };
  }
  return {
    target,
    source: "codex",
    path: scope === "global" ? join(homedir(), ".codex", "hooks.json") : join(cwd, ".codex", "hooks.json"),
    kind: "json",
    notes: [
      "Codex requires user-level ~/.codex/config.toml [features].hooks = true.",
      "Project hooks also require the project to be trusted by Codex.",
    ],
  };
}

export function parseTarget(value: string | undefined): HookTarget | "all" {
  if (value === "claude" || value === "codex" || value === "all") return value;
  throw new Error(`Missing or unsupported --target value: ${value ?? ""}`);
}

export function parseScope(value: string | undefined): HookScope {
  if (value === undefined) return "global";
  if (value === "global" || value === "project") return value;
  throw new Error(`Unsupported --scope value: ${value}`);
}
