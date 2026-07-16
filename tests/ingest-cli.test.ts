import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("ingest is silent by default for hook compatibility", async () => {
  const home = join(tmpdir(), `prompt-capture-cli-${process.pid}-${Date.now()}`);
  const payload = await readFile("tests/fixtures/codex-user-prompt.json", "utf8");
  const result = await runWithInput("node", [
    "dist/src/cli/index.js",
    "ingest",
    "--source",
    "codex",
    "--home",
    home,
  ], payload);
  assert.equal(result.stdout, "");
});

test("ingest can print id for manual debugging", async () => {
  const home = join(tmpdir(), `prompt-capture-cli-${process.pid}-${Date.now()}-print`);
  const payload = await readFile("tests/fixtures/codex-user-prompt.json", "utf8");
  const result = await runWithInput("node", [
    "dist/src/cli/index.js",
    "ingest",
    "--source",
    "codex",
    "--home",
    home,
    "--print-id",
  ], payload);
  assert.match(result.stdout, /^evt_/);
});

async function runWithInput(command: string, args: string[], input: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed with ${code}: ${stderr}`));
    });
    child.stdin.end(input);
  });
}
