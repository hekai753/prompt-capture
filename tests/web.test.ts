import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeConfig, readStaticAsset } from "../src/web/server.js";

test("static asset reader returns 404 for missing favicon", async () => {
  const response = await readStaticAsset("/favicon.ico");
  assert.equal(response.status, 404);
});

test("static asset reader serves index", async () => {
  const response = await readStaticAsset("/");
  assert.equal(response.status, 200);
  assert.match(response.content.toString("utf8"), /Prompt Capture/);
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
