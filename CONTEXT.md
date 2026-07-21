# prompt-capture

A local-first archive of prompts and tool events captured from AI CLI tools (Claude Code, Codex) through their native hooks, browsable via a local Web UI.

## Language

**Capture Source**:
An AI CLI tool whose hooks feed the archive. Currently `claude-code` or `codex`.
_Avoid_: adapter, integration (those are implementation; a Source is the thing being captured).

**Capture Event**:
An immutable record of one thing that happened in a Capture Source — a submitted user prompt, a tool call, or a stop. The unit of everything we store.
_Avoid_: log entry, record, message.

**Event Log**:
The append-only source of truth (`events/*.jsonl`); each Capture Event is appended once and never rewritten.
_Avoid_: database, store.

**Query Index**:
A derived read projection rebuilt from the Event Log that the Web UI filters and searches. It holds no authority the Event Log does not — it can be regenerated.
_Avoid_: database, sqlite (it is not a real SQLite store, despite a misleading historical filename).

**Project**:
The source-code working directory a Capture Event happened in.
_Avoid_: repo, workspace.

**projectSlug**:
A stable, filesystem-safe identifier derived from a Project's path; the key Projects are filtered and grouped by.

**Session**:
One AI CLI conversation, identified by a `sessionId` issued by the Capture Source.

**Turn**:
One round within a Session. Codex provides a `turnId`; Claude Code has no turn id and turns are stitched from the transcript.

### Transcript and conversation

**transcript**:
The complete conversation JSONL file that the Capture Source (Claude Code) maintains for a Session — user, assistant, and tool messages interleaved. Written by the Source, not by prompt-capture.
_Avoid_: event log, capture (it is not our data).

**rollout (Codex)**:
Codex's equivalent of a transcript: `~/.codex/{sessions,archived_sessions}/.../rollout-<ts>-<session-uuid>.jsonl`. Located by sessionId (the uuid is in the filename) because Codex hook payloads carry no path — unlike Claude Code's `transcriptPath`.

**transcriptPath**:
The absolute path to a Session's transcript, carried on each Capture Event from the hook payload.

**Conversation**:
A read-only, on-demand projection of a Session's full dialogue (user ↔ assistant ↔ tool), produced by parsing the transcript. It is not persisted and never enters the Event Log or Query Index.
_Avoid_: transcript (that is the source file), chat history.

**Lazy transcript read**:
The act of building a Conversation at request time by opening `transcriptPath` and parsing it — instead of ingesting assistant text at capture time.

### Privacy

**Redact**:
Masking of secrets/credentials in captured content. Canonical boundary: **local display is raw; export is redacted.** Anything that may leave this machine (copy to clipboard, Markdown export) runs Redact; the local UI shows original values.
