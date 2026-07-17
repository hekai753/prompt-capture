import { spawn } from "node:child_process";
import { closeSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { openSync } from "node:fs";
import { dirname } from "node:path";
import { webLogPath, webStatePath } from "../storage/paths.js";

export type WebServerState = {
  pid: number;
  port: number;
  url: string;
  home: string;
  startedAt: string;
  logPath: string;
};

export type WebServerStatus =
  | { running: true; state: WebServerState }
  | { running: false; state?: WebServerState; reason: string };

export async function writeWebServerState(root: string, port: number): Promise<WebServerState> {
  const state: WebServerState = {
    pid: process.pid,
    port,
    url: `http://127.0.0.1:${port}`,
    home: root,
    startedAt: new Date().toISOString(),
    logPath: webLogPath(root),
  };
  const path = webStatePath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export async function readWebServerState(root: string): Promise<WebServerState | undefined> {
  try {
    const value = JSON.parse(await readFile(webStatePath(root), "utf8")) as Partial<WebServerState>;
    if (
      typeof value.pid !== "number" ||
      typeof value.port !== "number" ||
      typeof value.url !== "string" ||
      typeof value.home !== "string" ||
      typeof value.startedAt !== "string" ||
      typeof value.logPath !== "string"
    ) {
      return undefined;
    }
    return value as WebServerState;
  } catch {
    return undefined;
  }
}

export async function webServerStatus(root: string): Promise<WebServerStatus> {
  const state = await readWebServerState(root);
  if (!state) return { running: false, reason: "no state file" };
  if (!isPidRunning(state.pid)) return { running: false, state, reason: "process is not running" };
  if (await isHealthCheckOk(state.url)) return { running: true, state };
  return { running: false, state, reason: "health check failed" };
}

export async function startWebServerInBackground(root: string, port: number): Promise<WebServerState> {
  const status = await webServerStatus(root);
  if (status.running) return status.state;

  const logPath = webLogPath(root);
  await mkdir(dirname(logPath), { recursive: true });
  const out = openSync(logPath, "a");
  const err = openSync(logPath, "a");
  const child = spawn(process.execPath, [
    process.argv[1] ?? "",
    "web",
    "--home",
    root,
    "--port",
    String(port),
  ], {
    detached: true,
    env: { ...process.env, PROMPT_CAPTURE_WEB_DAEMON: "1" },
    stdio: ["ignore", out, err],
  });
  closeSync(out);
  closeSync(err);
  child.unref();

  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const next = await webServerStatus(root);
    if (next.running) return next.state;
    await sleep(100);
  }
  const state = await readWebServerState(root);
  if (state) return state;
  throw new Error(`Web server did not report ready. See log: ${logPath}`);
}

export async function stopWebServer(root: string): Promise<WebServerStatus> {
  const status = await webServerStatus(root);
  if (!status.running) {
    await removeStateFile(root);
    return status;
  }

  process.kill(status.state.pid, "SIGTERM");
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    if (!isPidRunning(status.state.pid)) break;
    await sleep(100);
  }
  await removeStateFile(root);
  return { running: false, state: status.state, reason: "stopped" };
}

async function removeStateFile(root: string): Promise<void> {
  await rm(webStatePath(root), { force: true });
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthCheckOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300);
  try {
    const response = await fetch(`${url}/api/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
