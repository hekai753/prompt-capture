import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { findCodexRollout, parseConversation, readCodexConversation } from "../src/storage/conversation.js";

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

const CODEX_ROLLOUT = [
  `{"timestamp":"t0","type":"session_meta","payload":{"session_id":"s1"}}`,
  `{"timestamp":"t1","type":"response_item","payload":{"role":"developer","content":[{"type":"input_text","text":"you are codex"}]}}`,
  `{"timestamp":"t2","type":"response_item","payload":{"role":"user","content":[{"type":"input_text","text":"hello codex"}]}}`,
  `{"timestamp":"t3","type":"response_item","payload":{"role":"assistant","content":[{"type":"output_text","text":"hi from codex"},{"type":"function_call","name":"shell","arguments":"{\\"cmd\\":\\"ls\\"}"}]}}`,
  `{"timestamp":"t4","type":"response_item","payload":{"role":"user","content":[{"type":"function_call_output","call_id":"c1","output":"total 0"}]}}`,
  `this line is not json`,
  `{"timestamp":"t5","type":"event_msg","payload":{}}`,
].join("\n");

async function writeCodexRollout(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pc-codex-rollout-"));
  const path = join(dir, "rollout.jsonl");
  await writeFile(path, CODEX_ROLLOUT, "utf8");
  return path;
}

test("parses codex rollout timeline and skips non-response_item rows", async () => {
  const path = await writeCodexRollout();
  const { entries, reason } = await readCodexConversation(path);
  assert.equal(reason, undefined);
  // developer 跳过;剩 user(hello) / assistant / user(tool_result)
  assert.equal(entries.length, 3);
  const [u, a, tr] = entries;
  assert.equal(u.role, "user");
  assert.equal(u.text, "hello codex");
  assert.equal(a.role, "assistant");
  assert.equal(a.text, "hi from codex");
  assert.equal(a.toolUses?.length, 1);
  assert.equal(a.toolUses?.[0]?.name, "shell");
  assert.equal(tr.role, "user");
  assert.ok(tr.toolResultSummary?.includes("total 0"));
});

test("codex highlight matches user input_text", async () => {
  const path = await writeCodexRollout();
  const matched = await readCodexConversation(path, { highlightPrompt: "hello codex" });
  assert.equal(matched.entries[0]?.isCurrent, true);
  assert.equal(matched.entries[1]?.isCurrent, undefined);
});

test("findCodexRollout locates file by sessionId in sessions and archived_sessions", async () => {
  const home = await mkdtemp(join(tmpdir(), "pc-codex-home-"));
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  try {
    const id = "0aaabbbb-cccc-4ddd-8eee-ffffffffffff";
    const live = join(home, "sessions", "2026", "07", "21", `rollout-2026-07-21T00-00-00-${id}.jsonl`);
    await mkdir(dirname(live), { recursive: true });
    await writeFile(live, `{"type":"session_meta","payload":{}}\n`, "utf8");
    assert.equal(await findCodexRollout(id), live);

    const archived = join(home, "archived_sessions", "2026", "01", "01", `rollout-2026-01-01T00-00-00-${id}.jsonl`);
    await mkdir(dirname(archived), { recursive: true });
    await writeFile(archived, `{"type":"session_meta","payload":{}}\n`, "utf8");
    await rm(live);
    assert.equal(await findCodexRollout(id), archived);

    assert.equal(await findCodexRollout("does-not-exist-id"), undefined);
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
  }
});
