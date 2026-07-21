import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseConversation } from "../src/storage/conversation.js";

const TRANSCRIPT = [
  `{"type":"mode","sessionId":"s1"}`,
  `{"type":"user","uuid":"u1","timestamp":"2026-07-21T01:00:00Z","message":{"role":"user","content":"hello world"}}`,
  `{"type":"assistant","uuid":"a1","timestamp":"2026-07-21T01:00:05Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"let me think"},{"type":"text","text":"first answer"},{"type":"tool_use","id":"tu1","name":"Bash","input":{"command":"ls -la"}}]}}`,
  `{"type":"user","uuid":"u2","timestamp":"2026-07-21T01:00:10Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu1","content":"total 0"}]}}`,
  `this line is not valid json`,
  `{"type":"system","subtype":"init","isMeta":true}`,
  `{"type":"assistant","uuid":"a2","timestamp":"2026-07-21T01:00:15Z","message":{"role":"assistant","content":[{"type":"text","text":"second answer"}]}}`,
].join("\n");

async function writeTranscript(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pc-conversation-"));
  const path = join(dir, "session.jsonl");
  await writeFile(path, TRANSCRIPT, "utf8");
  return path;
}

test("parses user/assistant/tool timeline and skips non-message rows", async () => {
  const path = await writeTranscript();
  const { entries, reason } = await parseConversation(path);

  assert.equal(reason, undefined);
  assert.equal(entries.length, 4);

  const [u1, a1, u2, a2] = entries;

  assert.equal(u1.role, "user");
  assert.equal(u1.text, "hello world");

  assert.equal(a1.role, "assistant");
  assert.equal(a1.text, "first answer");
  assert.equal(a1.thinking, "let me think");
  assert.equal(a1.toolUses?.length, 1);
  assert.equal(a1.toolUses?.[0]?.name, "Bash");
  assert.ok(a1.toolUses?.[0]?.inputSummary?.includes("ls"));

  assert.equal(u2.role, "user");
  assert.equal(u2.text, undefined);
  assert.ok(u2.toolResultSummary?.includes("total 0"));

  assert.equal(a2.role, "assistant");
  assert.equal(a2.text, "second answer");
});

test("marks the current turn when highlightPrompt matches a user entry", async () => {
  const path = await writeTranscript();
  const matched = await parseConversation(path, { highlightPrompt: "hello world" });
  assert.equal(matched.entries[0]?.isCurrent, true);
  assert.equal(matched.entries[1]?.isCurrent, undefined);

  const unmatched = await parseConversation(path, { highlightPrompt: "does-not-appear" });
  assert.ok(unmatched.entries.every((entry) => !entry.isCurrent));
});

test("returns not-found reason when transcript file is missing", async () => {
  const { entries, reason } = await parseConversation(join(tmpdir(), "definitely-missing.jsonl"));
  assert.deepEqual(entries, []);
  assert.ok(reason?.includes("未找到"));
});

test("returns empty reason when transcript has no displayable content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pc-conversation-empty-"));
  const path = join(dir, "session.jsonl");
  await writeFile(path, `{"type":"mode","sessionId":"s1"}\n{"type":"system","isMeta":true}\n`, "utf8");
  const { entries, reason } = await parseConversation(path);
  assert.deepEqual(entries, []);
  assert.ok(reason?.includes("无可展示"));
});
