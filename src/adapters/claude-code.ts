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
  const raw = readString(payload, ["status", "tool_status", "toolStatus", "decision"]);
  if (raw === "ok" || raw === "success" || raw === "allow") return "ok";
  if (raw === "error" || raw === "failure") return "error";
  if (raw === "blocked" || raw === "deny") return "blocked";
  return raw ? "unknown" : undefined;
}

export const claudeCodeAdapter: Adapter = {
  source: "claude-code",
  normalize(payload: unknown): NormalizedDraft {
    if (!isRecord(payload)) {
      return {
        source: "claude-code",
        kind: "unknown",
        projectPath: process.cwd(),
      };
    }

    const rawEventName = readString(payload, ["hook_event_name", "hookEventName", "event", "name"]);
    const toolInput = readRecord(payload, ["tool_input", "toolInput"]);
    const toolResponse = payload.tool_response ?? payload.toolResponse ?? payload.response ?? payload.result;
    const cwd = readString(payload, ["cwd"]) ?? process.cwd();
    const toolName = readString(payload, ["tool_name", "toolName"]);

    return {
      source: "claude-code",
      kind: eventKind(rawEventName),
      rawEventName,
      projectPath: cwd,
      cwd,
      sessionId: readString(payload, ["session_id", "sessionId"]),
      conversationId: readString(payload, ["session_id", "sessionId"]),
      transcriptPath: readString(payload, ["transcript_path", "transcriptPath"]),
      prompt: readString(payload, ["prompt"]),
      toolName,
      toolInput,
      toolResultSummary: summarizeUnknown(toolResponse),
      toolStatus: status(payload),
    };
  },
};
