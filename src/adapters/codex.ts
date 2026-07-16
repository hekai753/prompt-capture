import type { Adapter, CaptureEventKind, NormalizedDraft, ToolStatus } from "./types.js";
import { isRecord, readRecord, readString, summarizeUnknown } from "../capture/object.js";

function eventKind(raw?: string): CaptureEventKind {
  switch (raw) {
    case "UserPromptSubmit":
      return "user_prompt_submit";
    case "PreToolUse":
      return "pre_tool_use";
    case "PostToolUse":
      return "post_tool_use";
    case "Stop":
      return "stop";
    default:
      return "unknown";
  }
}

function status(payload: Record<string, unknown>): ToolStatus | undefined {
  const toolResponse = readRecord(payload, ["tool_response", "toolResponse"]);
  const exitCode = toolResponse?.exit_code ?? toolResponse?.exitCode;
  if (exitCode === 0) return "ok";
  if (typeof exitCode === "number") return "error";
  const raw = readString(payload, ["status", "tool_status", "toolStatus"]);
  if (raw === "ok" || raw === "success") return "ok";
  if (raw === "error" || raw === "failure") return "error";
  if (raw === "blocked" || raw === "deny") return "blocked";
  return raw ? "unknown" : undefined;
}

export const codexAdapter: Adapter = {
  source: "codex",
  normalize(payload: unknown): NormalizedDraft {
    if (!isRecord(payload)) {
      return {
        source: "codex",
        kind: "unknown",
        projectPath: process.cwd(),
      };
    }

    const rawEventName = readString(payload, ["hook_event_name", "hookEventName", "event", "name"]);
    const cwd = readString(payload, ["cwd"]) ?? process.cwd();
    const toolInput = readRecord(payload, ["tool_input", "toolInput"]);
    const toolResponse = payload.tool_response ?? payload.toolResponse ?? payload.response ?? payload.result;

    return {
      source: "codex",
      kind: eventKind(rawEventName),
      rawEventName,
      projectPath: cwd,
      cwd,
      sessionId: readString(payload, ["session_id", "sessionId"]),
      conversationId: readString(payload, ["session_id", "sessionId"]),
      threadId: readString(payload, ["thread_id", "threadId"]),
      turnId: readString(payload, ["turn_id", "turnId"]),
      transcriptPath: readString(payload, ["transcript_path", "transcriptPath"]),
      prompt: readString(payload, ["prompt"]),
      toolName: readString(payload, ["tool_name", "toolName"]),
      toolInput,
      toolResultSummary: summarizeUnknown(toolResponse),
      toolStatus: status(payload),
    };
  },
};
