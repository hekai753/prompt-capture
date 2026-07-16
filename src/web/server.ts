import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaptureEventKind } from "../adapters/types.js";
import { readConfig, writeConfig, type AppConfig } from "../storage/config.js";
import { exportMarkdown } from "../storage/markdown.js";
import { configPath, markdownDir } from "../storage/paths.js";
import { getEvent, listEvents, listProjects, relatedEvents } from "../storage/sqlite.js";

const UI_DIR = fileURLToPath(new URL("../ui", import.meta.url));

export async function startServer(root: string, port: number): Promise<void> {
  const server = createPromptCaptureServer(root);
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  process.stdout.write(`prompt-capture web: http://127.0.0.1:${port}\n`);
}

export function createPromptCaptureServer(root: string): Server {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (url.pathname === "/api/projects") {
        return json(res, await listProjects(root));
      }
      if (url.pathname === "/api/config") {
        if (req.method === "GET") {
          return json(res, await configResponse(root));
        }
        if (req.method === "POST") {
          const current = await readConfig(root);
          const update = await readJsonBody(req);
          const next = mergeConfig(current, update);
          await writeConfig(root, next);
          return json(res, await configResponse(root));
        }
      }
      if (url.pathname === "/api/events") {
        return json(res, await listEvents(root, {
          project: url.searchParams.get("project") || undefined,
          date: url.searchParams.get("date") || undefined,
          source: url.searchParams.get("source") || undefined,
          kind: parseEventKind(url.searchParams.get("kind")),
          q: url.searchParams.get("q") || undefined,
        }));
      }
      const eventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
      if (eventMatch) {
        const event = await getEvent(root, decodeURIComponent(eventMatch[1] ?? ""));
        if (!event) return notFound(res);
        return json(res, event);
      }
      const relatedMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/related$/);
      if (relatedMatch) {
        return json(res, await relatedEvents(root, decodeURIComponent(relatedMatch[1] ?? "")));
      }
      if (url.pathname === "/api/export-md" && req.method === "POST") {
        return json(res, { written: await exportMarkdown(root) });
      }
      return serveStatic(res, url.pathname);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

function parseEventKind(value: string | null): CaptureEventKind | undefined {
  if (
    value === "user_prompt_submit" ||
    value === "pre_tool_use" ||
    value === "post_tool_use" ||
    value === "stop" ||
    value === "unknown"
  ) {
    return value;
  }
  return undefined;
}

async function configResponse(root: string): Promise<AppConfig & {
  storageRoot: string;
  configPath: string;
  markdownDir: string;
}> {
  return {
    ...await readConfig(root),
    storageRoot: root,
    configPath: configPath(root),
    markdownDir: markdownDir(root),
  };
}

export function mergeConfig(current: AppConfig, value: unknown): AppConfig {
  if (!value || typeof value !== "object") return current;
  const update = value as Partial<AppConfig>;
  return {
    rawPayloads: typeof update.rawPayloads === "boolean" ? update.rawPayloads : current.rawPayloads,
    markdownMode: update.markdownMode === "manual" || update.markdownMode === "realtime"
      ? update.markdownMode
      : current.markdownMode,
  };
}

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res: import("node:http").ServerResponse, value: unknown): void {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function notFound(res: import("node:http").ServerResponse): void {
  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "not found" }));
}

async function serveStatic(res: import("node:http").ServerResponse, pathname: string): Promise<void> {
  const asset = await readStaticAsset(pathname);
  if (asset.status === 404) return notFound(res);
  res.writeHead(200, { "content-type": asset.contentType });
  res.end(asset.content);
}

export async function readStaticAsset(pathname: string): Promise<
  | { status: 200; contentType: string; content: Buffer }
  | { status: 404 }
> {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const file = join(UI_DIR, safePath.replace(/^\/+/, ""));
  try {
    const content = await readFile(file);
    return { status: 200, contentType: contentType(file), content };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: 404 };
    throw error;
  }
}

function contentType(file: string): string {
  switch (extname(file)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
