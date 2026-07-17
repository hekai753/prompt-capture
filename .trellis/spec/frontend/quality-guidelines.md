# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

## Scenario: Chrome-installable Local Web UI

### 1. Scope / Trigger
- Trigger: changes to `src/ui/index.html`, service worker registration, Web App Manifest, or static resource serving for the Web UI.
- This project supports Chrome standalone-app installation through PWA metadata while keeping all data local.

### 2. Signatures
- Manifest path: `GET /manifest.webmanifest`
- Service worker path: `GET /sw.js`
- Icon path: `GET /icon.svg`
- Browser registration: `navigator.serviceWorker.register("/sw.js")`

### 3. Contracts
- `index.html` must include `theme-color`, `manifest`, `icon`, and `apple-touch-icon` links.
- Manifest must define `name`, `short_name`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color`, `theme_color`, and at least one icon.
- Service worker may cache static UI assets only; API routes under `/api/` must stay network-backed and must not be cached.
- PWA support is optional at runtime; registration failure must not block the Web UI.

### 4. Validation & Error Matrix
- Service worker unavailable -> UI continues without install support.
- Service worker registration fails -> catch and ignore, no visible runtime error.
- `/api/*` request -> bypass service worker cache.
- Manifest served with wrong content type -> Chrome may not offer install.

### 5. Good/Base/Bad Cases
- Good: Chrome opens `http://127.0.0.1:<port>`, sees installable metadata, and launches a standalone window after installation.
- Base: Non-PWA browsers still load the normal Web UI.
- Bad: cache `/api/events`; users see stale prompt data after ingestion.

### 6. Tests Required
- Static asset test verifies `manifest.webmanifest` returns status 200 and manifest content type.
- Manual browser smoke should confirm Chrome shows install affordance after loading the local Web UI.

### 7. Wrong vs Correct
#### Wrong
```javascript
self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request));
});
```

This can cache API responses and hide new prompt events.

#### Correct
```javascript
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
```
