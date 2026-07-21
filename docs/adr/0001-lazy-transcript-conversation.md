---
status: accepted
---

# Show assistant responses by lazily reading the transcript, not by adding hooks

## Context

We want the Web UI to show full assistant responses next to captured user prompts,
turning the archive into a complete conversation view. The hard constraint is that
we **must not add or widen hooks** (no Stop / SessionStart capture): hook weight runs
inside the live AI CLI tool, and the owner does not want capture to affect it.

Claude Code already attaches `transcript_path` to every `UserPromptSubmit` payload, and
the adapter already stores it on each Capture Event — but nothing consumes it. The
transcript file is the only place assistant text lives; hook payloads themselves never
contain assistant text.

## Decision

Read assistant responses **lazily from the transcript**, at request time:

- The server gains an endpoint keyed by event id that opens the `transcriptPath`
  recorded on that event, parses the user/assistant/tool timeline, and returns a
  Conversation projection.
- We do **not** ingest assistant text, do **not** add a `CaptureEventKind`, and do
  **not** touch the Event Log or Query Index.
- The Conversation is a transient projection: non-persisted, redact-free on local
  display, redacted only on export (per the Redact boundary in `CONTEXT.md`).
- Codex is deferred: its hook payloads carry no transcript path, so the same path
  cannot serve it without new capture work, which is out of scope this round.

## Why not the alternatives

- **Ingest at Stop-time** would require installing the Stop hook and duplicating
  assistant text into the Event Log — bloat, and it violates the no-new-hooks
  constraint.
- **Store only a pointer, parse client-side** was rejected: transcript parsing
  belongs on the server, not the browser.

## Consequences

- Assistant responses are viewable only for Claude Code events whose transcript file
  still exists on disk. Changing machines or clearing `~/.claude` breaks the view —
  degrade gracefully ("transcript not found"), never break the rest of the detail view.
- Because we never persist assistant text, Markdown export still contains only user
  prompts. Folding Conversation text into export is a separate decision and must run
  Redact on the export path.
- Parsing must tolerate transcript lines that are not messages (summaries, system
  rows, malformed lines) without failing the whole response.
