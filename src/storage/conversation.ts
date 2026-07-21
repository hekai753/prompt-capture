import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { summarizeUnknown } from "../capture/object.js";

export type ConversationToolUse = { name: string; inputSummary?: string };

export type ConversationEntry = {
  role: "user" | "assistant";
  uuid?: string;
  timestamp?: string;
  text?: string;
  thinking?: string;
  toolUses?: ConversationToolUse[];
  toolResultSummary?: string;
  isCurrent?: boolean;
};

export type ConversationResult = {
  entries: ConversationEntry[];
  reason?: string;
};

const NOT_FOUND_REASON = "transcript 文件未找到:可能已清理或换机器";
const EMPTY_REASON = "transcript 解析后无可展示内容";

// 模块级缓存:按 (path, mtimeMs) 缓存解析结果。本地单用户场景,无界即可。
const cache = new Map<string, { mtimeMs: number; entries: ConversationEntry[] }>();

/**
 * 缓存版读取:服务端用。文件未变则直接返回缓存条目,highlight 每次按请求重算。
 */
export async function readConversation(
  path: string,
  opts?: { highlightPrompt?: string },
): Promise<ConversationResult> {
  const st = await safeStat(path);
  if (!st) return { entries: [], reason: NOT_FOUND_REASON };

  const cached = cache.get(path);
  const entries =
    cached && cached.mtimeMs === st.mtimeMs
      ? cached.entries
      : await loadAndCache(path, st.mtimeMs);
  return { entries: applyHighlight(entries, opts?.highlightPrompt) };
}

/**
 * 无缓存读取:测试用。直接 stat → 解析,ENOENT/空结果给 reason。
 */
export async function parseConversation(
  path: string,
  opts?: { highlightPrompt?: string },
): Promise<ConversationResult> {
  const st = await safeStat(path);
  if (!st) return { entries: [], reason: NOT_FOUND_REASON };
  const entries = await parseTranscriptFile(path);
  return {
    entries: applyHighlight(entries, opts?.highlightPrompt),
    reason: entries.length === 0 ? EMPTY_REASON : undefined,
  };
}

async function loadAndCache(path: string, mtimeMs: number): Promise<ConversationEntry[]> {
  const entries = await parseTranscriptFile(path);
  cache.set(path, { mtimeMs, entries });
  return entries;
}

async function safeStat(path: string): Promise<{ mtimeMs: number } | undefined> {
  try {
    const st = await stat(path);
    return { mtimeMs: st.mtimeMs };
  } catch (err) {
    if (isEnoent(err)) return undefined;
    throw err;
  }
}

async function parseTranscriptFile(path: string): Promise<ConversationEntry[]> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }

  const entries: ConversationEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const entry = toEntry(obj);
    if (entry) entries.push(entry);
  }
  return entries;
}

function toEntry(value: unknown): ConversationEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const type = obj.type;
  if (type !== "user" && type !== "assistant") return undefined;

  const message = obj.message;
  if (!message || typeof message !== "object") return undefined;
  const content = (message as Record<string, unknown>).content;

  const entry: ConversationEntry = {
    role: type as "user" | "assistant",
    uuid: typeof obj.uuid === "string" ? obj.uuid : undefined,
    timestamp: typeof obj.timestamp === "string" ? obj.timestamp : undefined,
  };

  if (typeof content === "string") {
    entry.text = content;
  } else if (Array.isArray(content)) {
    for (const block of content) {
      ingestBlock(entry, block);
    }
  }

  return entry;
}

function ingestBlock(entry: ConversationEntry, block: unknown): void {
  if (!block || typeof block !== "object") return;
  const b = block as Record<string, unknown>;
  const btype = b.type;
  if (btype === "text" && typeof b.text === "string") {
    entry.text = entry.text ? `${entry.text}\n${b.text}` : b.text;
  } else if (btype === "thinking" && typeof b.thinking === "string") {
    entry.thinking = entry.thinking ? `${entry.thinking}\n${b.thinking}` : b.thinking;
  } else if (btype === "tool_use" || btype === "server_tool_use") {
    const name = typeof b.name === "string" ? b.name : btype;
    const inputSummary = summarizeUnknown(b.input);
    entry.toolUses = entry.toolUses ?? [];
    entry.toolUses.push({ name, inputSummary });
  } else if (btype === "tool_result") {
    const summary = summarizeUnknown(b.content);
    if (summary) {
      entry.toolResultSummary = entry.toolResultSummary
        ? `${entry.toolResultSummary}\n${summary}`
        : summary;
    }
  }
}

function applyHighlight(entries: ConversationEntry[], prompt?: string): ConversationEntry[] {
  if (!prompt) return entries;
  const head = prompt.slice(0, 40);
  for (const entry of entries) {
    if (entry.role !== "user" || !entry.text) continue;
    const entryHead = entry.text.slice(0, 40);
    if (entry.text === prompt || entry.text.startsWith(head) || prompt.startsWith(entryHead)) {
      entry.isCurrent = true;
      return entries;
    }
  }
  return entries;
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

// ---- Codex:按 sessionId 定位 rollout 文件并解析 ----

function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), ".codex");
}

export async function findCodexRollout(sessionId: string): Promise<string | undefined> {
  if (!sessionId) return undefined;
  const suffix = `${sessionId}.jsonl`;
  for (const dir of ["sessions", "archived_sessions"]) {
    const base = join(codexHome(), dir);
    let entries: string[] = [];
    try {
      const result = await readdir(base, { recursive: true });
      entries = result.map((entry) => (typeof entry === "string" ? entry : String(entry)));
    } catch {
      continue;
    }
    const hit = entries.find((entry) => entry.endsWith(suffix));
    if (hit) return join(base, hit);
  }
  return undefined;
}

export async function readCodexConversation(
  path: string,
  opts?: { highlightPrompt?: string },
): Promise<ConversationResult> {
  const st = await safeStat(path);
  if (!st) return { entries: [], reason: "Codex session 文件未找到" };
  const cached = cache.get(path);
  const entries =
    cached && cached.mtimeMs === st.mtimeMs
      ? cached.entries
      : await loadCodexAndCache(path, st.mtimeMs);
  return { entries: applyHighlight(entries, opts?.highlightPrompt) };
}

async function loadCodexAndCache(path: string, mtimeMs: number): Promise<ConversationEntry[]> {
  const entries = await parseCodexRollout(path);
  cache.set(path, { mtimeMs, entries });
  return entries;
}

async function parseCodexRollout(path: string): Promise<ConversationEntry[]> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  const entries: ConversationEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const entry = codexToEntry(obj);
    if (entry) entries.push(entry);
  }
  return entries;
}

function codexToEntry(value: unknown): ConversationEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  if (obj.type !== "response_item") return undefined;
  const payload = obj.payload;
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const role = p.role;
  if (role !== "user" && role !== "assistant") return undefined;
  const content = p.content;
  if (!Array.isArray(content)) return undefined;
  const entry: ConversationEntry = {
    role: role as "user" | "assistant",
    timestamp: typeof obj.timestamp === "string" ? obj.timestamp : undefined,
  };
  for (const block of content) {
    ingestCodexBlock(entry, block);
  }
  return entry;
}

function ingestCodexBlock(entry: ConversationEntry, block: unknown): void {
  if (!block || typeof block !== "object") return;
  const b = block as Record<string, unknown>;
  const btype = b.type;
  if ((btype === "input_text" || btype === "output_text") && typeof b.text === "string") {
    entry.text = entry.text ? `${entry.text}\n${b.text}` : b.text;
  } else if (btype === "function_call") {
    const name = typeof b.name === "string" ? b.name : "function_call";
    entry.toolUses = entry.toolUses ?? [];
    entry.toolUses.push({ name, inputSummary: summarizeUnknown(b.arguments) });
  } else if (btype === "function_call_output") {
    const summary = summarizeUnknown(b.output);
    if (summary) {
      entry.toolResultSummary = entry.toolResultSummary
        ? `${entry.toolResultSummary}\n${summary}`
        : summary;
    }
  }
}
