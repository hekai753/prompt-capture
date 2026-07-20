# Prompt Capture CLI Design

## Architecture

The system is a local npm CLI package with four main runtime surfaces:

1. Hook installer commands that modify Codex and Claude Code hook configuration.
2. Hook ingestion command invoked by those tools with JSON payload on stdin.
3. Local persistence layer with raw payload files, append-only JSONL, and a query index.
4. Local Web UI served by the CLI and backed by the query index.

Data flow:

```text
Codex / Claude Code native hook
  -> prompt-capture ingest --source <source>
  -> source adapter parses raw payload
  -> shared normalizer validates and projects CaptureEvent
  -> redaction pass
  -> raw payload writer
  -> append-only JSONL writer
  -> query index upsert
  -> optional Markdown refresh
  -> Web API reads SQLite
```

Markdown is a readable projection, not the source of truth.

## Package Shape

Recommended initial stack:

- TypeScript for CLI, ingestion, adapters, persistence, and Web API.
- Node.js runtime distributed as an npm package.
- A JSON query index for the MVP to avoid native dependency install friction; SQLite/FTS is the target upgrade path for larger archives.
- JSONL for append-only event history.
- Vite + React for Web UI, served by the CLI, or a simpler static UI if implementation pressure requires it.

Suggested source layout:

```text
package.json
src/
  cli/
    index.ts
    commands/
      install.ts
      uninstall.ts
      ingest.ts
      export-md.ts
      web.ts
  adapters/
    claude-code.ts
    codex.ts
    types.ts
  capture/
    normalize.ts
    redact.ts
    event-id.ts
  storage/
    paths.ts
    raw.ts
    jsonl.ts
    sqlite.ts
    markdown.ts
  web/
    server.ts
    api.ts
  ui/
    ...
tests/
```

## Hook Installation Contract

The installer must never replace a whole config file with a template. It must:

1. Resolve the target config path from `target` and `scope`.
2. Parse existing config, or create a minimal config if the file does not exist.
3. Backup the original file before writing.
4. Append hook entries for selected events.
5. Mark installed entries so uninstall can remove only entries owned by this tool.

Hook command format:

```text
prompt-capture ingest --source claude-code --installed-by prompt-capture
prompt-capture ingest --source codex --installed-by prompt-capture
```

The marker should be part of the command string and also recorded in a local installation registry:

```text
~/.prompt-capture/installed-hooks.json
```

The registry helps uninstall even if surrounding configuration changed.

### Codex Hook Configuration Findings

Local verification against Codex CLI v0.144.4 and installed Codex/Trellis integration artifacts found:

- Codex supports a project-scoped hook manifest at `.codex/hooks.json`.
- The manifest shape is:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "prompt-capture ingest --source codex",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

- Known Codex hook event names include `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `PreCompact`, `PostCompact`, and `Stop`.
- User-level Codex config must enable hooks:

```toml
[features]
hooks = true
```

- Older Codex versions may also accept the legacy feature name `codex_hooks`, but MVP should write/read the current `features.hooks` key and document version constraints.
- Project-level `.codex/config.toml` cannot enable feature flags. Installation must update or instruct the user to update the user-level config for hook support.
- Codex tracks hook trust in user-level `config.toml` under `[hooks.state]` entries keyed by `<hooks-path>:<event>:<matcher-index>:<hook-index>`. MVP should not attempt to forge trust entries; it should rely on Codex review/trust flow or document `--dangerously-bypass-hook-trust` only for tests.
- Project-level Codex hooks are gated by project trust. The installer should detect whether the project is trusted and report clear next steps when it is not.

An attempted live probe with a temporary project confirmed the CLI feature gate behavior but did not successfully capture a project-local hook payload in that temp project. Implementation should keep a Phase 0 fixture-capture step before hardening the Codex adapter.

## Capture Event Contract

One shared event contract owns all cross-layer payload semantics. UI, Markdown export, and Web APIs must import projections from this contract instead of recasting raw hook payloads.

```ts
type CaptureSource = "claude-code" | "codex";

type CaptureEventKind =
  | "user_prompt_submit"
  | "pre_tool_use"
  | "post_tool_use"
  | "stop"
  | "unknown";

type CaptureEvent = {
  id: string;
  payloadHash: string;
  source: CaptureSource;
  kind: CaptureEventKind;
  capturedAt: string;
  eventTime?: string;

  projectPath: string;
  projectSlug: string;
  cwd?: string;
  sessionId?: string;
  conversationId?: string;
  transcriptPath?: string;

  prompt?: string;

  toolName?: string;
  toolInput?: unknown;
  toolResultSummary?: string;
  toolStatus?: "ok" | "error" | "blocked" | "unknown";

  rawPayloadPath?: string;
  rawEventName?: string;
};
```

Adapters are responsible for converting source-specific payloads into this shape:

- `claude-code` maps fields like `hook_event_name`, `session_id`, `cwd`, `transcript_path`, and `prompt`.
- `codex` maps equivalent fields from its hook payload.

Unknown fields are preserved in raw payload storage, not spread through the shared event contract.

### Codex Payload Field Findings

Installed Codex hook tooling and tests consume these Codex payload fields:

- Event name aliases: `hook_event_name`, `hookEventName`, `event`, or `name`.
- Common context: `cwd`, `session_id` / `sessionId`, `thread_id` / `threadId`, `turn_id` / `turnId`, `transcript_path` / `transcriptPath`.
- `UserPromptSubmit`: `prompt`.
- `PreToolUse`: `tool_name` and `tool_input`; Bash command is expected at `tool_input.command`.
- Tool path candidates may appear in `tool_input.file_path`, `tool_input.filePath`, `tool_input.path`, `tool_input.target_path`, or `tool_input.targetPath`.
- `PostToolUse`: `tool_name`, `tool_response`, and `tool_use_id` are observed in local integration tests.

The Codex adapter should accept snake_case and camelCase aliases for shared fields. It should treat unknown event names as `unknown` while preserving raw payloads.

## Storage Contract

Default storage root:

```text
~/.prompt-capture/
```

User-configurable through a command or environment variable:

```text
PROMPT_CAPTURE_HOME=/path/to/archive
```

Directory shape:

```text
~/.prompt-capture/
  config.json
  installed-hooks.json
  events/
    2026-07-16.jsonl
  raw/
    claude-code/2026-07-16/<event-id>.json
    codex/2026-07-16/<event-id>.json
  index.json
  md/
    projects/<project-slug>/<YYYY-MM-DD>.md
```

Write order should prefer recoverability:

1. Compute event id and payload hash.
2. Optionally write raw payload.
3. Append normalized JSONL event.
4. Upsert query index.
5. Refresh only the current project/date Markdown file if realtime export is enabled.

If index write fails after JSONL succeeds, a repair/reindex command can rebuild the query index from JSONL later.

## Query Index Model

MVP index shape:

```ts
type EventIndex = {
  events: CaptureEvent[];
};
```

The index is intentionally replaceable. A future SQLite/FTS implementation should preserve the Web API contract and rebuild from JSONL.

## Markdown Projection

Manual Markdown export reads normalized events from JSONL and groups by:

1. project slug
2. local date
3. prompt event/session

Output:

```text
md/projects/<project-slug>/<YYYY-MM-DD>.md
```

Prompt sections should include:

- local time
- source
- session id when present
- prompt body
- related tool-call summary if available

Markdown files are safe to delete and regenerate.

Realtime ingestion should not rebuild the whole Markdown archive. It should read only the current event's date JSONL file, filter to the current project slug and date, and rewrite `md/projects/<project-slug>/<YYYY-MM-DD>.md`.

## Web UI Contract

The local server exposes narrow APIs:

- `GET /api/projects`
- `GET /api/events?project=&date=&source=&q=`
- `GET /api/events/:id`
- `GET /api/events/:id/related`
- `POST /api/export-md`

The UI must not parse raw JSONL or Markdown. It consumes Web API projections from the local query index.

## Privacy And Redaction

Redaction runs before normalized JSONL and SQLite writes. Initial rules:

- redact common secret assignment patterns
- redact bearer tokens
- redact obvious API key formats when recognized
- preserve enough structure for search usefulness

Raw payload persistence is disabled by default. This reduces sensitive local data retention while still preserving normalized prompt/tool metadata.

Because raw payloads improve debugging when Codex or Claude Code payload schemas change, the product must provide:

- a config option to enable raw payload persistence
- a documented setting equivalent to `rawPayloads: true`
- clear documentation explaining that raw payloads are local but may be more sensitive than normalized records

## Operational Notes

- Hook ingestion should complete quickly and avoid network calls.
- Long-running export or repair actions should be explicit commands, not hook-time work.
- Config writes must be atomic where practical: write temp file, then rename.
- Invalid hook payloads should be logged locally without crashing the originating CLI if possible.
- The implementation should include a dry-run mode for installation to show planned config edits.

## Risks

- Codex hook payload shape is partially verified through installed hook tooling and tests, but a live project-local payload capture still needs to be completed before implementation hardens the adapter.
- Hook config schemas may change; adapters should isolate schema-specific logic and tests should use fixtures.
- Native hook command path resolution can fail if global npm bin is not in the environment used by the AI CLI. The installer may need to resolve and write an absolute executable path.
