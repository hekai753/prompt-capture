import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureEvent } from "../adapters/types.js";
import { localDate, localTime } from "../capture/project.js";
import { markdownDir } from "./paths.js";
import { readAllEvents } from "./jsonl.js";

export async function exportMarkdown(root: string): Promise<string[]> {
  const events = await readAllEvents(root);
  const outRoot = join(markdownDir(root), "projects");
  const groups = new Map<string, CaptureEvent[]>();
  for (const event of events) {
    const key = `${event.projectSlug}/${localDate(event.capturedAt)}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  const written: string[] = [];
  await removeOldMarkdownFiles(outRoot, [...groups.keys()].map((key) => key.split("/")[0]!).filter(Boolean));
  for (const [key, group] of groups) {
    const [projectSlug, date] = key.split("/");
    const dir = join(outRoot, projectSlug);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${date}.md`);
    await writeFile(path, renderDay(date, group), "utf8");
    written.push(path);
  }
  return written.sort();
}

async function removeOldMarkdownFiles(outRoot: string, projectSlugs: string[]): Promise<void> {
  for (const projectSlug of new Set(projectSlugs)) {
    const dir = join(outRoot, projectSlug);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    await Promise.all(
      names
        .filter((name) => name.endsWith(".md"))
        .map((name) => rm(join(dir, name), { force: true })),
    );
  }
}

export async function refreshMarkdownForEvent(root: string, event: CaptureEvent): Promise<string> {
  const date = localDate(event.capturedAt);
  const events = await readEventsForDate(root, date);
  const group = events.filter((candidate) => {
    return candidate.projectSlug === event.projectSlug && localDate(candidate.capturedAt) === date;
  });
  const dir = join(markdownDir(root), "projects", event.projectSlug);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${date}.md`);
  await writeFile(path, renderDay(date, group), "utf8");
  return path;
}

async function readEventsForDate(root: string, date: string): Promise<CaptureEvent[]> {
  try {
    const content = await readFile(join(root, "events", `${date}.jsonl`), "utf8");
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as CaptureEvent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function renderDay(date: string, events: CaptureEvent[]): string {
  const sorted = [...events].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const prompts = sorted.filter((event) => event.kind === "user_prompt_submit" && event.prompt);
  const otherEvents = sorted.filter((event) => !prompts.some((prompt) => prompt.id === event.id));
  const first = sorted[0];
  const sources = [...new Set(sorted.map((event) => event.source))].sort();
  const lines = [
    "---",
    `date: ${date}`,
    first ? `project: ${JSON.stringify(first.projectPath)}` : "project: null",
    first ? `project_slug: ${JSON.stringify(first.projectSlug)}` : "project_slug: null",
    `event_count: ${sorted.length}`,
    `prompt_count: ${prompts.length}`,
    `sources: [${sources.map((source) => JSON.stringify(source)).join(", ")}]`,
    "---",
    "",
    `# Prompt Capture - ${date}`,
    "",
    "## Summary",
    "",
    `- Prompts: ${prompts.length}`,
    `- Events: ${sorted.length}`,
    `- Sources: ${sources.length > 0 ? sources.map((source) => `\`${source}\``).join(", ") : "none"}`,
  ];

  if (first) {
    lines.push(`- Project: \`${first.projectPath}\``);
  }
  lines.push("");

  if (prompts.length > 0) {
    lines.push("## Prompts", "");
    for (const [index, event] of prompts.entries()) {
      lines.push(`### ${index + 1}. ${localTime(event.capturedAt)} - ${event.source}`);
      lines.push("");
      lines.push(metadataLine(event));
      lines.push("");
      lines.push("```text");
      lines.push(event.prompt ?? "");
      lines.push("```");
      lines.push("");
    }
  }

  if (otherEvents.length > 0) {
    lines.push("## Other Events", "");
    lines.push("| Time | Source | Event | Tool | Status |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const event of otherEvents) {
      lines.push([
        localTime(event.capturedAt),
        event.source,
        event.kind,
        event.toolName ?? "",
        event.toolStatus ?? "",
      ].map(tableCell).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function metadataLine(event: CaptureEvent): string {
  const parts = [
    event.sessionId ? `session \`${event.sessionId}\`` : undefined,
    event.threadId ? `thread \`${event.threadId}\`` : undefined,
    event.turnId ? `turn \`${event.turnId}\`` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "no session metadata";
}

function tableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
