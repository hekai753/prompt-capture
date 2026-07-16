#!/usr/bin/env node
import { exportMdCommand } from "./commands/export-md.js";
import { configCommand } from "./commands/config.js";
import { ingestCommand } from "./commands/ingest.js";
import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { webCommand } from "./commands/web.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "ingest":
      return ingestCommand(args);
    case "install":
      return installCommand(args);
    case "uninstall":
      return uninstallCommand(args);
    case "export-md":
      return exportMdCommand(args);
    case "config":
      return configCommand(args);
    case "web":
      return webCommand(args);
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return help();
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function help(): void {
  process.stdout.write(`prompt-capture

Usage:
  prompt-capture install --target claude|codex|all [--scope global|project] [--events prompt|prompt,tools|prompt,tools,stop|all] [--dry-run]
  prompt-capture uninstall --target claude|codex|all [--scope global|project] [--dry-run]
  prompt-capture ingest --source claude-code|codex [--home path] [--print-id]
  prompt-capture export-md [--home path]
  prompt-capture web [--home path] [--port 4873]
  prompt-capture config get [--home path]
  prompt-capture config set rawPayloads true|false [--home path]
  prompt-capture config set markdownMode realtime|manual [--home path]

Environment:
  PROMPT_CAPTURE_HOME  Override storage root (default ~/.prompt-capture)
`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
