import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeEvent } from "../src/capture/normalize.js";
import { upsertEvent } from "../src/storage/sqlite.js";
import { writeWebServerState, webServerStatus } from "../src/web/daemon.js";
import { createPromptCaptureServer, mergeConfig, readStaticAsset } from "../src/web/server.js";

test("static asset reader returns 404 for missing favicon", async () => {
  const response = await readStaticAsset("/favicon.ico");
  assert.equal(response.status, 404);
});

test("static asset reader serves index", async () => {
  const response = await readStaticAsset("/");
  assert.equal(response.status, 200);
  assert.match(response.content.toString("utf8"), /Prompt Capture/);
});

test("static asset reader serves web app manifest", async () => {
  const response = await readStaticAsset("/manifest.webmanifest");
  assert.equal(response.status, 200);
  assert.equal(response.contentType, "application/manifest+json; charset=utf-8");
  assert.match(response.content.toString("utf8"), /"display": "standalone"/);
});

test("web config update accepts only known config fields", () => {
  const current = { rawPayloads: false, markdownMode: "realtime" as const };
  const updated = mergeConfig(current, {
    rawPayloads: true,
    markdownMode: "manual",
    ignored: "value",
  });
  assert.deepEqual(updated, { rawPayloads: true, markdownMode: "manual" });

  assert.deepEqual(mergeConfig(updated, {
    rawPayloads: "yes",
    markdownMode: "invalid",
  }), updated);
});

test("web health endpoint reports ok", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-web-"));
  const server = createPromptCaptureServer(root);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected server to listen on a TCP port");
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

test("web daemon status reads the current process state", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-capture-web-state-"));
  const server = createPromptCaptureServer(root);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected server to listen on a TCP port");
    }
    const state = await writeWebServerState(root, address.port);
    const status = await webServerStatus(root);
    assert.equal(status.running, true);
    if (status.running) {
      assert.equal(status.state.pid, process.pid);
      assert.equal(status.state.url, state.url);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

async function withServer<T>(root: string, fn: (base: string) => Promise<T>): Promise<T> {
  const server = createPromptCaptureServer(root);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected server to listen on a TCP port");
    }
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("conversation endpoint returns parsed timeline for a claude event", async () => {
  const root = await mkdtemp(join(tmpdir(), "pc-web-conv-claude-"));
  const transcriptPath = join(root, "session.jsonl");
  await writeFile(
    transcriptPath,
    `{"type":"user","uuid":"u1","message":{"role":"user","content":"hi there"}}\n` +
      `{"type":"assistant","uuid":"a1","message":{"role":"assistant","content":[{"type":"text","text":"hello back"}]}}\n`,
    "utf8",
  );
  const { event } = normalizeEvent("claude-code", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/demo",
    session_id: "s1",
    transcript_path: transcriptPath,
    prompt: "hi there",
  }));
  await upsertEvent(root, event);

  await withServer(root, async (base) => {
    const res = await fetch(`${base}/api/events/${encodeURIComponent(event.id)}/conversation`);
    assert.equal(res.status, 200);
    const body = await res.json() as {
      entries: Array<{ role: string; text?: string; isCurrent?: boolean }>;
      reason?: string;
    };
    assert.equal(body.entries.length, 2);
    assert.equal(body.entries[0]?.text, "hi there");
    assert.equal(body.entries[1]?.text, "hello back");
    assert.equal(body.entries[0]?.isCurrent, true);
  });

  await rm(root, { recursive: true, force: true });
});

test("conversation endpoint degrades when event has no transcriptPath (codex)", async () => {
  const root = await mkdtemp(join(tmpdir(), "pc-web-conv-codex-"));
  const { event } = normalizeEvent("codex", JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: "/tmp/demo",
    session_id: "s1",
    prompt: "hi",
  }));
  await upsertEvent(root, event);

  await withServer(root, async (base) => {
    const res = await fetch(`${base}/api/events/${encodeURIComponent(event.id)}/conversation`);
    assert.equal(res.status, 200);
    const body = await res.json() as { entries: unknown[]; reason?: string };
    assert.deepEqual(body.entries, []);
    assert.ok(body.reason?.includes("transcript"));
  });

  await rm(root, { recursive: true, force: true });
});
