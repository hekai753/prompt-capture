import type { Adapter, CaptureSource } from "./types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { codexAdapter } from "./codex.js";

export function adapterFor(source: CaptureSource): Adapter {
  if (source === "claude-code") return claudeCodeAdapter;
  if (source === "codex") return codexAdapter;
  throw new Error(`Unsupported source: ${source}`);
}

export function parseSource(value: string | undefined): CaptureSource {
  if (value === "claude-code" || value === "claude") return "claude-code";
  if (value === "codex") return "codex";
  throw new Error(`Missing or unsupported --source value: ${value ?? ""}`);
}
