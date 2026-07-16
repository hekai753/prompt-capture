import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("raw payloads are disabled by default", async () => {
  const home = join(tmpdir(), `prompt-capture-raw-default-${process.pid}-${Date.now()}`);
  const payload = await readFile("tests/fixtures/claude-user-prompt.json", "utf8");
  await runIngest(home, payload);
  await assert.rejects(access(join(home, "raw")));
});

test("raw payloads can be enabled through config", async () => {
  const home = join(tmpdir(), `prompt-capture-raw-enabled-${process.pid}-${Date.now()}`);
  const payload = await readFile("tests/fixtures/claude-user-prompt.json", "utf8");
  await execFileAsync("node", [
    "dist/src/cli/index.js",
    "config",
    "set",
    "rawPayloads",
    "true",
    "--home",
    home,
  ]);
  await runIngest(home, payload);
  await access(join(home, "raw"));
});

async function runIngest(home: string, payload: string): Promise<void> {
  const child = execFile("node", [
    "dist/src/cli/index.js",
    "ingest",
    "--source",
    "claude-code",
    "--home",
    home,
  ]);
  child.stdin?.end(payload);
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ingest exited with ${code}`));
    });
  });
}
