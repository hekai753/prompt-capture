# Prompt Capture CLI

## Goal

Build a local-first npm CLI package that captures user prompts and tool-call metadata from Codex and Claude Code through their native hook mechanisms, stores the data locally, generates readable Markdown archives, and serves a local Web UI for browsing and search.

The product should let a developer install once, add hooks to supported AI CLI tools, and then automatically collect each submitted user prompt by project and date without wrapping or proxying the CLI.

## Background

- The user wants to collect only the user-entered prompt portions from AI CLI conversations, organized locally by project, date, and time.
- Wrapper-based terminal capture is out of scope because it cannot reliably observe structured internal tool calls and is fragile for TUI/multiline input.
- Native hooks are the chosen capture mechanism:
  - `UserPromptSubmit` captures the submitted prompt before the assistant handles it.
  - `PreToolUse` / `PostToolUse` capture structured tool-call metadata.
  - `Stop` marks the end of a turn/session segment for grouping.
- Markdown should be generated for human reading, but it must not be the only source of truth.

## Requirements

- Package and install
  - Provide an npm package exposing a `prompt-capture` binary.
  - Support global installation through npm-compatible package managers.
  - Provide commands for hook installation, hook removal, ingestion, Markdown export, and local Web UI startup.

- Native hook installation
  - `prompt-capture install --target claude|codex|all --scope global|project` must append hook configuration without deleting existing user hooks.
  - Install must default to `UserPromptSubmit` only.
  - Install must support optional tool/stop events through an explicit events option.
  - `prompt-capture uninstall --target claude|codex|all --scope global|project` must remove only hooks installed by this tool.
  - Installation must create timestamped backups before modifying configuration files.
  - Hook commands must call `prompt-capture ingest --source <source>` and read hook payloads from stdin.
  - The implementation must use per-tool adapters for configuration file paths, schema differences, and event/payload normalization.

- Ingestion
  - `prompt-capture ingest --source claude-code|codex` must read a single JSON hook payload from stdin.
  - It must normalize supported source payloads into one internal event contract.
  - It must tolerate unknown fields and optionally preserve raw payloads for troubleshooting.
  - It must hash payloads or otherwise deduplicate obvious hook retries.
  - It must avoid blocking the originating CLI with long-running work.

- Storage
  - Default storage directory should be user-local, not project-local, to avoid accidental commits of sensitive prompts.
  - Store raw hook payloads separately from normalized records.
  - Use append-only JSONL as the durable event log.
  - Use a local query/index store for the Web UI and search. The MVP may use a JSON index to avoid native install friction; SQLite/FTS remains the target for larger archives.
  - Markdown archives are derived artifacts that can be regenerated from the event log/index.

- Markdown archive
  - Generate project/date Markdown files grouped by project slug and date.
  - Include prompt text, timestamp, source tool, session id when available, and summarized tool calls when available.
  - Markdown generation must be deterministic enough to regenerate after deleting the `md/` directory.

- Web UI
  - `prompt-capture web --port <port>` must start a local-only Web UI.
  - UI must support browsing by project, date, source tool, and keyword.
  - UI must show prompt detail and related tool-call events grouped by session/turn when possible.
  - UI must read from SQLite, not parse Markdown as its primary data source.

- Privacy and safety
  - All data must remain local by default.
  - Provide a configurable redaction pass before writing normalized prompt/tool data.
  - Do not capture assistant response bodies in the MVP.
  - Raw payload storage is disabled by default to minimize sensitive local data retention.
  - Users must be able to enable raw payload storage through CLI/config for adapter debugging.

## Acceptance Criteria

- [ ] After running `prompt-capture install --target claude --scope global`, the Claude Code hook configuration contains this tool's `UserPromptSubmit` hook command while preserving existing hooks.
- [ ] After running `prompt-capture install --target codex --scope global`, the Codex hook configuration contains this tool's `UserPromptSubmit` hook command while preserving existing hooks.
- [ ] After running install with `--events prompt,tools,stop`, optional tool and stop hooks are installed.
- [ ] Given a representative Claude Code `UserPromptSubmit` JSON payload on stdin, `prompt-capture ingest --source claude-code` appends one normalized JSONL event and upserts the event into the local query index.
- [ ] Given a representative Codex `UserPromptSubmit` JSON payload on stdin, `prompt-capture ingest --source codex` writes the same categories of local records using the unified event contract.
- [ ] Given representative `PreToolUse`, `PostToolUse`, and `Stop` payloads, events are stored and can be associated with the relevant session/turn when payload data allows.
- [ ] Markdown export produces `md/projects/<project-slug>/<YYYY-MM-DD>.md` with the captured prompt and source metadata.
- [ ] Deleting generated Markdown and re-running `prompt-capture export-md` recreates equivalent Markdown from stored events.
- [ ] `prompt-capture web` starts a local Web UI that lists captured prompts and filters them by project, date, source, and keyword.
- [ ] `prompt-capture uninstall` removes only this tool's hook entries and leaves unrelated hooks intact.
- [ ] Tests cover config append/remove behavior, payload normalization, redaction, event persistence, Markdown regeneration, and basic Web API/list retrieval.

## Out of Scope

- Terminal wrapper or PTY capture.
- Cloud sync or remote storage.
- Capturing full assistant output bodies by default.
- Browser extensions or IDE extensions.
- Supporting AI CLIs other than Codex and Claude Code in the MVP.

## Open Questions

- None currently blocking planning.
