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

## Scenario: Modal And Local Overlay Stacking

### 1. Scope / Trigger
- Trigger: changes to `src/ui/styles.css` that add or modify modals, toolbars, date pickers, dropdowns, or other positioned overlays.
- The Web UI uses local stacking contexts for toolbar/date picker controls and a full-screen config modal.

### 2. Signatures
- Toolbar selector: `.toolbar`
- Date picker selector: `.date-picker`
- Full-screen modal selector: `.modal`

### 3. Contracts
- `.modal` must render above every in-page overlay while open.
- Local overlays such as `.toolbar` and `.date-picker` may use z-index only within the page content layer.
- Modal backdrop and modal card must not be partially obscured by filters, toolbars, event panels, or detail panels.

### 4. Validation & Error Matrix
- Open config modal while toolbar is visible -> modal and backdrop cover the toolbar.
- Open date picker while modal is closed -> date picker appears above surrounding panels.
- Open modal after date picker was used -> modal still wins the stacking order.

### 5. Good/Base/Bad Cases
- Good: `.modal` uses a higher z-index than `.toolbar` and `.date-picker`.
- Base: local date picker remains above panels without competing with global modal.
- Bad: toolbar z-index is higher than modal z-index, causing controls to appear over the modal.

### 6. Tests Required
- Manual browser smoke should open the config modal from the top toolbar and verify the toolbar is dimmed behind the backdrop.
- For layout fixes, verify at desktop width and mobile/narrow width if the affected selector participates in responsive rules.

### 7. Wrong vs Correct
#### Wrong
```css
.toolbar { z-index: 20; }
.modal { z-index: 10; }
```

The toolbar can paint above the modal backdrop.

#### Correct
```css
.toolbar { z-index: 2; }
.date-picker { z-index: 40; }
.modal { z-index: 100; }
```

Local overlays stay above panels, and global modal overlays stay above local controls.

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
