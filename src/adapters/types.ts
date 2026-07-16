export type CaptureSource = "claude-code" | "codex";

export type CaptureEventKind =
  | "user_prompt_submit"
  | "pre_tool_use"
  | "post_tool_use"
  | "stop"
  | "unknown";

export type ToolStatus = "ok" | "error" | "blocked" | "unknown";

export type CaptureEvent = {
  id: string;
  payloadHash: string;
  source: CaptureSource;
  kind: CaptureEventKind;
  capturedAt: string;
  eventTime?: string;
  projectPath: string;
  projectSlug: string;
  cwd?: string;
  sessionId?: string;
  conversationId?: string;
  threadId?: string;
  turnId?: string;
  transcriptPath?: string;
  prompt?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResultSummary?: string;
  toolStatus?: ToolStatus;
  rawPayloadPath?: string;
  rawEventName?: string;
};

export type NormalizedDraft = Omit<
  CaptureEvent,
  "id" | "payloadHash" | "capturedAt" | "projectSlug" | "rawPayloadPath"
> & {
  capturedAt?: string;
  projectSlug?: string;
  rawPayloadPath?: string;
};

export type Adapter = {
  source: CaptureSource;
  normalize(payload: unknown): NormalizedDraft;
};

export type HookEventName =
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "Stop";

export type HookTarget = "claude" | "codex";
export type HookScope = "global" | "project";
