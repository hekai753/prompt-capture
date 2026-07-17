# Directory Structure

> How backend code is organized in this project.

---

## Overview

<!--
Document your project's backend directory structure here.

Questions to answer:
- How are modules/packages organized?
- Where does business logic live?
- Where are API endpoints defined?
- How are utilities and helpers organized?
-->

(To be filled by the team)

---

## Directory Layout

```
<!-- Replace with your actual structure -->
src/
├── ...
└── ...
```

---

## Module Organization

<!-- How should new features/modules be organized? -->

(To be filled by the team)

---

## Naming Conventions

<!-- File and folder naming rules -->

(To be filled by the team)

---

## Examples

<!-- Link to well-organized modules as examples -->

## Scenario: Web Server Background Process

### 1. Scope / Trigger
- Trigger: changes to `prompt-capture web` command behavior, web process lifecycle, or local Web API health/status semantics.
- Owner modules: `src/cli/commands/web.ts`, `src/web/server.ts`, `src/web/daemon.ts`, and storage path helpers in `src/storage/paths.ts`.

### 2. Signatures
- Foreground: `prompt-capture web [--home path] [--port 4873]`
- Background: `prompt-capture web [--home path] [--port 4873] --background`
- Status: `prompt-capture web status [--home path]`
- Stop: `prompt-capture web stop [--home path]`
- Health API: `GET /api/health -> { "ok": true }`

### 3. Contracts
- Web server must bind only to `127.0.0.1`.
- Background mode stores process state at `<storageRoot>/web-server.json` and logs at `<storageRoot>/web-server.log`.
- State fields: `pid`, `port`, `url`, `home`, `startedAt`, `logPath`.
- `PROMPT_CAPTURE_WEB_DAEMON=1` marks the detached child process; only the child writes the ready state after the server is actually listening.

### 4. Validation & Error Matrix
- Invalid `--port` -> CLI throws `Invalid port: <value>`.
- Port already in use -> `startServer` must reject from the server `error` event instead of hanging.
- Missing state file -> status reports stopped.
- PID alive but `/api/health` fails -> status reports stopped with health-check failure.

### 5. Good/Base/Bad Cases
- Good: `web --background`, then `web status`, then `web stop` reports running and then stopped.
- Base: `web` without `--background` remains a foreground process for users who want terminal logs.
- Bad: status only checks PID; stale PID reuse can report an unrelated process as the Web UI.

### 6. Tests Required
- Unit test `GET /api/health`.
- Unit test daemon status with a real listening server and current process state.
- Manual smoke: run built CLI background/status/stop using a temporary `--home`.

### 7. Wrong vs Correct
#### Wrong
```typescript
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
```

This hangs forever on listen errors.

#### Correct
```typescript
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});
```
