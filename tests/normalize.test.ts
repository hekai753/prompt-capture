import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { normalizeEvent } from "../src/capture/normalize.js";

test("normalizes and redacts Claude Code prompt payload", async () => {
  const raw = await readFile("tests/fixtures/claude-user-prompt.json", "utf8");
  const { event, redactedRaw } = normalizeEvent("claude-code", raw);
  assert.equal(event.source, "claude-code");
  assert.equal(event.kind, "user_prompt_submit");
  assert.equal(event.sessionId, "claude-session-1");
  assert.equal(event.projectPath, "/tmp/demo-project");
  assert.match(event.prompt ?? "", /REDACTED/);
  assert.match(redactedRaw, /REDACTED/);
});

test("normalizes Codex prompt aliases", async () => {
  const raw = await readFile("tests/fixtures/codex-user-prompt.json", "utf8");
  const { event } = normalizeEvent("codex", raw);
  assert.equal(event.source, "codex");
  assert.equal(event.kind, "user_prompt_submit");
  assert.equal(event.sessionId, "codex-session-1");
  assert.equal(event.threadId, "codex-thread-1");
  assert.equal(event.turnId, "codex-turn-1");
  assert.match(event.prompt ?? "", /REDACTED/);
});

test("normalizes Codex post tool result", async () => {
  const raw = await readFile("tests/fixtures/codex-post-tool.json", "utf8");
  const { event } = normalizeEvent("codex", raw);
  assert.equal(event.kind, "post_tool_use");
  assert.equal(event.toolName, "Bash");
  assert.equal(event.toolStatus, "ok");
  assert.match(event.toolResultSummary ?? "", /ok/);
});
