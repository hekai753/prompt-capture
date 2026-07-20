# Prompt Capture CLI Implementation Plan

## Phase 0: Confirm External Hook Contracts

- [ ] Capture or obtain representative Claude Code payload fixtures for `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`.
- [ ] Capture representative Codex payload fixtures from a trusted project for `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`.
- [x] Verify Codex project hook manifest shape: `.codex/hooks.json` with `hooks.<Event>[]`.
- [x] Verify Codex user-level hook feature gate: `[features] hooks = true`.
- [x] Verify Codex trust state location: user `config.toml` `[hooks.state]` keyed by hook manifest path/event/index.
- [ ] Verify Claude Code config file locations and schemas for global and project scopes.
- [x] Decide whether raw payload storage is enabled by default: disabled by default, with a config/CLI option to enable it.

## Phase 1: Project Scaffold

- [x] Create npm/TypeScript project scaffold.
- [x] Add CLI entrypoint `prompt-capture`.
- [x] Add test runner, typecheck, and build scripts.
- [x] Add shared TypeScript types for sources, event kinds, adapters, and normalized events.

## Phase 2: Ingestion Core

- [x] Implement stdin JSON reader with clear error handling.
- [x] Implement event id and payload hash generation.
- [x] Implement `claude-code` adapter using fixtures.
- [x] Implement `codex` adapter using fixtures.
- [x] Implement redaction pipeline.
- [x] Implement `prompt-capture ingest --source ...`.
- [x] Keep hook ingestion stdout silent by default; use `--print-id` only for manual debugging.
- [x] Add tests for representative valid payloads and adapter normalization.

## Phase 3: Storage

- [x] Implement storage root resolution from config/env/default.
- [x] Implement raw payload writer disabled by default with opt-in behavior.
- [x] Add CLI config command to enable raw payload persistence.
- [x] Implement append-only JSONL writer.
- [x] Implement MVP JSON query index.
- [ ] Implement SQLite schema/migration bootstrap as a future scale upgrade.
- [x] Implement event upsert and keyword filtering against the MVP index.
- [x] Add tests for persistence, index query, and Markdown export.
- [ ] Add follow-up tests for duplicate handling and reindex feasibility.

## Phase 4: Markdown Export

- [x] Implement project slug generation.
- [x] Implement grouped Markdown renderer.
- [x] Implement `prompt-capture export-md`.
- [x] Refresh only the current project/date Markdown file during prompt ingestion when realtime export is enabled.
- [ ] Add snapshot tests for deterministic Markdown output.

## Phase 5: Hook Install/Uninstall

- [x] Implement adapter-level config path resolution for Claude Code.
- [x] Implement adapter-level config path resolution for Codex.
- [x] Implement config backup and atomic write.
- [x] Implement append-only hook merge that preserves existing hooks.
- [x] Default hook installation to `UserPromptSubmit`; make tool/stop hooks explicit via `--events`.
- [x] Implement installed-hook marker in hook command.
- [x] Implement uninstall that removes only owned hook entries.
- [x] Add dry-run output.
- [x] Add tests for append and uninstall behavior.
- [ ] Add installation registry and malformed config handling.

## Phase 6: Web Server And UI

- [x] Implement local Web API backed by the MVP query index.
- [x] Implement Web UI list/detail/search views.
- [x] Add filters for project, date, source, and keyword.
- [x] Add related tool-call display for prompt events.
- [x] Add command `prompt-capture web --port`.
- [x] Run local API/page smoke test.
- [ ] Add automated API tests and browser-level smoke test if practical.

## Phase 7: Documentation And Release Shape

- [x] Document install, uninstall, storage location, privacy model, and supported events.
- [x] Document Markdown regeneration command.
- [ ] Document future reindex/repair command after it exists.
- [ ] Add sample hook payload fixtures with sensitive values redacted.
- [x] Prepare package metadata and local package validation.

## Validation Commands

Exact commands depend on the scaffold, but the target validation set should include:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual MVP validation:

```bash
printf '%s' '<fixture-json>' | prompt-capture ingest --source claude-code
prompt-capture export-md
prompt-capture web --port 4873
```

## Rollback Points

- Hook installation modifies external user config files; always backup before writing.
- `uninstall` must be tested against configs containing unrelated hooks before use on real configs.
- Storage migrations must be additive until the event contract stabilizes.

## Planning Gate Before Implementation

- [x] User reviewed the plan and approved implementation before live Codex payload capture.
- [x] Raw payload default decision is resolved: default disabled.
- [x] Codex hook config contract is verified; payload contract is partially verified through installed hook tooling/tests and implementation starts with tolerant alias handling until real trusted-project fixtures are captured.
