import assert from "node:assert/strict";
import { test } from "node:test";
import { addHooks, removeHooks } from "../src/hooks/manifest.js";

test("adds only UserPromptSubmit by default without removing existing hooks", () => {
  const existing = {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: "echo existing" }],
        },
      ],
    },
  };
  const updated = addHooks(existing, "codex");
  const entries = (updated.hooks as Record<string, unknown>).UserPromptSubmit as unknown[];
  assert.equal(entries.length, 2);
  assert.match(JSON.stringify(updated), /echo existing/);
  assert.match(JSON.stringify(updated), /prompt-capture ingest --source codex/);
  assert.equal((updated.hooks as Record<string, unknown>).PreToolUse, undefined);
  assert.equal((updated.hooks as Record<string, unknown>).PostToolUse, undefined);
  assert.equal((updated.hooks as Record<string, unknown>).Stop, undefined);
});

test("adds optional tool and stop hooks", () => {
  const updated = addHooks({}, "codex", ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"]);
  const hooks = updated.hooks as Record<string, unknown>;
  assert.ok(hooks.UserPromptSubmit);
  assert.ok(hooks.PreToolUse);
  assert.ok(hooks.PostToolUse);
  assert.ok(hooks.Stop);
});

test("default install removes previously owned optional hooks", () => {
  const withOptional = addHooks({}, "codex", ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"]);
  const updated = addHooks(withOptional, "codex");
  const hooks = updated.hooks as Record<string, unknown>;
  assert.ok(hooks.UserPromptSubmit);
  assert.equal(hooks.PreToolUse, undefined);
  assert.equal(hooks.PostToolUse, undefined);
  assert.equal(hooks.Stop, undefined);
});

test("removes only prompt capture hooks", () => {
  const installed = addHooks({
    hooks: {
      Stop: [{ hooks: [{ type: "command", command: "echo keep" }] }],
    },
  }, "claude-code");
  const removed = removeHooks(installed);
  assert.match(JSON.stringify(removed), /echo keep/);
  assert.doesNotMatch(JSON.stringify(removed), /prompt-capture ingest/);
});
