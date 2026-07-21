import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { normalizeEvent } from "../src/capture/normalize.js";
import { appendEvent, readAllEvents } from "../src/storage/jsonl.js";
import { exportMarkdown, refreshMarkdownForEvent } from "../src/storage/markdown.js";
import { localDate } from "../src/capture/project.js";
import { upsertEvent, listEvents, listProjects } from "../src/storage/sqlite.js";

test("persists event, indexes it, and exports markdown", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-test-"));
  const raw = JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/demo-project",
    session_id: "s1",
    prompt: "hello",
  });
  const { event } = normalizeEvent("codex", raw);
  await appendEvent(root, event);
  await upsertEvent(root, event);

  const events = await readAllEvents(root);
  assert.equal(events.length, 1);
  assert.equal((await listEvents(root, { q: "hello" })).length, 1);
  assert.equal((await listProjects(root))[0]?.slug, event.projectSlug);

  const written = await exportMarkdown(root);
  assert.equal(written.length, 1);
  const md = await readFile(written[0]!, "utf8");
  assert.match(md, /hello/);
  assert.match(md, /^---\n/);
  assert.match(md, /## Summary/);
  assert.match(md, /## Prompts/);
  assert.match(md, /### 1\./);
});

test("filters indexed events by kind", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-kind-filter-"));
  const prompt = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/demo-project",
    session_id: "s1",
    prompt: "hello",
  })).event;
  const postTool = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "PostToolUse",
    cwd: "/tmp/demo-project",
    session_id: "s1",
    tool_name: "Bash",
    tool_response: "done",
  })).event;

  await upsertEvent(root, prompt);
  await upsertEvent(root, postTool);

  const prompts = await listEvents(root, { kind: "user_prompt_submit" });
  const postTools = await listEvents(root, { kind: "post_tool_use" });

  assert.deepEqual(prompts.map((event) => event.id), [prompt.id]);
  assert.deepEqual(postTools.map((event) => event.id), [postTool.id]);
});

test("realtime markdown refresh rewrites only current project date", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-md-refresh-"));
  const first = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/project-a",
    session_id: "a1",
    prompt: "project a",
  })).event;
  const second = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/project-b",
    session_id: "b1",
    prompt: "project b",
  })).event;
  await appendEvent(root, first);
  await appendEvent(root, second);
  const firstPath = await refreshMarkdownForEvent(root, first);
  await writeSentinel(firstPath);
  const secondPath = await refreshMarkdownForEvent(root, second);

  assert.match(await readFile(firstPath, "utf8"), /sentinel/);
  assert.match(await readFile(secondPath, "utf8"), /project b/);
});

test("full markdown export ignores non-markdown files in output directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-md-dsstore-"));
  const event = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/project-a",
    session_id: "a1",
    prompt: "project a",
  })).event;
  await appendEvent(root, event);
  const projectDir = join(root, "md", "projects", event.projectSlug);
  await mkdir(projectDir, { recursive: true });
  const dsStore = join(projectDir, ".DS_Store");
  await writeFile(dsStore, "keep\n", "utf8");
  const written = await exportMarkdown(root);

  assert.equal(written.length, 1);
  assert.equal(await readFile(dsStore, "utf8"), "keep\n");
});

test("filters events by local-timezone date (not UTC slice)", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-date-local-"));
  const event = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/demo-project",
    session_id: "s1",
    prompt: "tz check",
  })).event;
  // 固定到 UTC 17:30 —— 在 UTC+8 等东时区下本地日期会跨到次日,从而区分本地口径与 UTC 切片
  event.capturedAt = "2026-07-21T17:30:00.000Z";
  await upsertEvent(root, event);

  const localKey = localDate(event.capturedAt);
  const utcKey = event.capturedAt.slice(0, 10);

  const hits = await listEvents(root, { date: localKey });
  assert.deepEqual(hits.map((e) => e.id), [event.id]);

  // 本地键与 UTC 切片不同时,用 UTC 切片过滤应匹配不到(证明已改为本地口径)
  if (utcKey !== localKey) {
    const misses = await listEvents(root, { date: utcKey });
    assert.equal(misses.length, 0);
  }
});

async function writeSentinel(path: string): Promise<void> {
  await writeFile(path, "sentinel\n", "utf8");
}
