import type { HookEventName } from "../adapters/types.js";

export const PROMPT_CAPTURE_MARKER = "--installed-by prompt-capture";

export const HOOK_EVENTS: HookEventName[] = [
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
];

export const DEFAULT_HOOK_EVENTS: HookEventName[] = ["UserPromptSubmit"];

export function hookCommand(source: "claude-code" | "codex"): string {
  return `prompt-capture ingest --source ${source} ${PROMPT_CAPTURE_MARKER}`;
}

export function addHooks(
  config: Record<string, unknown>,
  source: "claude-code" | "codex",
  events: readonly HookEventName[] = DEFAULT_HOOK_EVENTS,
): Record<string, unknown> {
  const withoutOwnedHooks = removeHooks(config);
  const hooks = normalizeHooks(withoutOwnedHooks.hooks);
  for (const event of events) {
    const entries = Array.isArray(hooks[event]) ? hooks[event] as unknown[] : [];
    const command = hookCommand(source);
    const alreadyInstalled = JSON.stringify(entries).includes(command);
    if (!alreadyInstalled) {
      entries.push({
        hooks: [
          {
            type: "command",
            command,
            timeout: 15,
          },
        ],
      });
    }
    hooks[event] = entries;
  }
  return { ...withoutOwnedHooks, hooks };
}

export function parseHookEvents(value: string | undefined): HookEventName[] {
  if (!value || value === "prompt") return ["UserPromptSubmit"];
  if (value === "all") return [...HOOK_EVENTS];
  const selected = new Set<HookEventName>();
  for (const part of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    if (part === "prompt") {
      selected.add("UserPromptSubmit");
    } else if (part === "tools") {
      selected.add("PreToolUse");
      selected.add("PostToolUse");
    } else if (part === "stop") {
      selected.add("Stop");
    } else {
      throw new Error(`Unsupported hook event group: ${part}`);
    }
  }
  return [...HOOK_EVENTS].filter((event) => selected.has(event));
}

export function removeHooks(config: Record<string, unknown>): Record<string, unknown> {
  const hooks = normalizeHooks(config.hooks);
  for (const [event, rawEntries] of Object.entries(hooks)) {
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const filtered = entries
      .map((entry) => removeEntryHooks(entry))
      .filter((entry) => {
        if (!isRecord(entry)) return true;
        const nested = entry.hooks;
        return !(Array.isArray(nested) && nested.length === 0);
      });
    if (filtered.length > 0) hooks[event] = filtered;
    else delete hooks[event];
  }
  return { ...config, hooks };
}

function removeEntryHooks(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const nested = entry.hooks;
  if (!Array.isArray(nested)) return entry;
  return {
    ...entry,
    hooks: nested.filter((hook) => {
      if (!isRecord(hook)) return true;
      return typeof hook.command !== "string" || !hook.command.includes(PROMPT_CAPTURE_MARKER);
    }),
  };
}

function normalizeHooks(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
