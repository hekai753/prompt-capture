import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
