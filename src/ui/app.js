const state = {
  projects: [],
  events: [],
  allEvents: [],
  selectedId: "",
  config: null,
  calendarMonth: todayKey().slice(0, 7),
};

const els = {
  project: document.querySelector("#project"),
  date: document.querySelector("#date"),
  source: document.querySelector("#source"),
  kind: document.querySelector("#kind"),
  query: document.querySelector("#query"),
  dateToggle: document.querySelector("#date-toggle"),
  datePicker: document.querySelector("#date-picker"),
  dateTitle: document.querySelector("#date-title"),
  dateGrid: document.querySelector("#date-grid"),
  datePrev: document.querySelector("#date-prev"),
  dateNext: document.querySelector("#date-next"),
  refresh: document.querySelector("#refresh"),
  openConfig: document.querySelector("#open-config"),
  closeConfig: document.querySelector("#close-config"),
  configModal: document.querySelector("#config-modal"),
  clearDate: document.querySelector("#clear-date"),
  activityGrid: document.querySelector("#activity-grid"),
  activityStats: document.querySelector("#activity-stats"),
  activityLegend: document.querySelector("#activity-legend"),
  activitySummary: document.querySelector("#activity-summary"),
  events: document.querySelector("#events"),
  detail: document.querySelector("#detail"),
  export: document.querySelector("#export"),
  exportStatus: document.querySelector("#export-status"),
  eventCount: document.querySelector("#event-count"),
  statEvents: document.querySelector("#stat-events"),
  statPrompts: document.querySelector("#stat-prompts"),
  statProjects: document.querySelector("#stat-projects"),
  statFiltered: document.querySelector("#stat-filtered"),
  statDays: document.querySelector("#stat-days"),
  statToday: document.querySelector("#stat-today"),
  statTools: document.querySelector("#stat-tools"),
  statSessions: document.querySelector("#stat-sessions"),
  configForm: document.querySelector("#config-form"),
  configStatus: document.querySelector("#config-status"),
  rawPayloads: document.querySelector("#rawPayloads"),
  markdownMode: document.querySelector("#markdownMode"),
  storageRoot: document.querySelector("#storageRoot"),
  markdownDir: document.querySelector("#markdownDir"),
  configPath: document.querySelector("#configPath"),
};

for (const el of [els.project, els.source, els.kind]) {
  el.addEventListener("change", onFilterChange);
}
els.query.addEventListener("input", debounce(onFilterChange, 200));

els.refresh.addEventListener("click", refreshAll);
els.export.addEventListener("click", exportMarkdown);
els.configForm.addEventListener("submit", saveConfig);
els.openConfig.addEventListener("click", openConfigModal);
els.closeConfig.addEventListener("click", closeConfigModal);
els.configModal.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.hasAttribute("data-close-config")) closeConfigModal();
});
els.clearDate.addEventListener("click", () => {
  els.date.value = "";
  renderDateControl();
  persistFilters();
  loadEvents();
});
els.dateToggle.addEventListener("click", () => {
  const shouldOpen = els.datePicker.hidden;
  setDatePickerOpen(shouldOpen);
});
els.datePrev.addEventListener("click", () => {
  state.calendarMonth = shiftMonth(state.calendarMonth, -1);
  renderDateControl();
});
els.dateNext.addEventListener("click", () => {
  state.calendarMonth = shiftMonth(state.calendarMonth, 1);
  renderDateControl();
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !document.querySelector("#date-filter").contains(event.target)) {
    setDatePickerOpen(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.configModal.classList.contains("is-open")) {
    closeConfigModal();
    return;
  }
  if (event.key === "Escape" && !els.datePicker.hidden) {
    setDatePickerOpen(false);
    els.dateToggle.focus();
    return;
  }
  if (isTypingTarget(event.target)) return;
  if (event.key === "j" || event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === "k" || event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === "/") {
    event.preventDefault();
    els.query.focus();
  }
});

restoreFilters();
window.addEventListener("popstate", () => {
  restoreFilters();
  loadEvents();
});
registerServiceWorker();
refreshAll();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // PWA support is optional; the local UI should still work if registration fails.
  });
}

async function refreshAll() {
  setListLoading();
  try {
    await Promise.all([loadConfig(), loadProjects(), loadAllEvents()]);
    await loadEvents();
  } catch (error) {
    renderError(error);
  }
}

async function loadConfig() {
  state.config = await fetchJson("/api/config");
  els.rawPayloads.checked = Boolean(state.config.rawPayloads);
  els.markdownMode.value = state.config.markdownMode;
  els.storageRoot.textContent = state.config.storageRoot;
  els.markdownDir.textContent = state.config.markdownDir;
  els.configPath.textContent = state.config.configPath;
  els.configStatus.textContent = "已加载";
}

async function loadProjects() {
  state.projects = await fetchJson("/api/projects");
  const current = els.project.value;
  els.project.replaceChildren(option("", "全部项目"));
  for (const project of state.projects) {
    els.project.append(option(project.slug, `${project.slug} (${project.count})`));
  }
  els.project.value = state.projects.some((project) => project.slug === current) ? current : "";
}

async function loadAllEvents() {
  state.allEvents = await fetchJson("/api/events");
  syncSelectedDate();
  renderDateControl();
  renderActivityMatrix();
  renderStats();
}

async function loadEvents() {
  const params = new URLSearchParams();
  if (els.project.value) params.set("project", els.project.value);
  if (els.date.value) params.set("date", els.date.value);
  if (els.source.value) params.set("source", els.source.value);
  if (els.kind.value) params.set("kind", els.kind.value);
  if (els.query.value.trim()) params.set("q", els.query.value.trim());
  state.events = await fetchJson(`/api/events?${params}`);
  renderEvents();
  renderActivityMatrix();
  renderStats();
}

function renderStats() {
  const promptEvents = state.allEvents.filter((event) => event.kind === "user_prompt_submit");
  const promptDates = new Set(promptEvents.map((event) => dateKey(event.capturedAt)));
  const toolCount = state.allEvents.filter((event) => event.kind === "pre_tool_use" || event.kind === "post_tool_use").length;
  const sessionCount = new Set(state.allEvents.map((event) => event.sessionId).filter(Boolean)).size;
  els.statEvents.textContent = String(state.allEvents.length);
  els.statPrompts.textContent = String(promptEvents.length);
  els.statProjects.textContent = String(state.projects.length);
  els.statFiltered.textContent = String(state.events.length);
  els.statDays.textContent = String(promptDates.size);
  els.statToday.textContent = String(countPromptsByDate().get(todayKey()) ?? 0);
  els.statTools.textContent = String(toolCount);
  els.statSessions.textContent = String(sessionCount);
}

function renderActivityMatrix() {
  const promptCounts = countPromptsByDate();
  const days = recentDateKeys(91);
  const max = Math.max(1, ...promptCounts.values());
  const total = days.reduce((sum, date) => sum + (promptCounts.get(date) ?? 0), 0);

  els.activitySummary.textContent = `最近 13 周 ${total} 次 prompt，${promptCounts.size} 个活跃日期`;
  els.activityGrid.replaceChildren();

  const firstDay = new Date(`${days[0]}T00:00:00.000Z`).getUTCDay();
  for (let index = 0; index < firstDay; index += 1) {
    const blank = document.createElement("span");
    blank.className = "activity-cell activity-blank";
    els.activityGrid.append(blank);
  }

  for (const date of days) {
    const count = promptCounts.get(date) ?? 0;
    const cell = document.createElement("button");
    cell.className = `activity-cell level-${activityLevel(count, max)} ${els.date.value === date ? "is-selected" : ""}`;
    cell.type = "button";
    cell.title = `${date}: ${count} prompts`;
    cell.setAttribute("aria-label", `${date}: ${count} prompts`);
    cell.addEventListener("click", () => {
      if (count === 0) return;
      els.date.value = date;
      state.calendarMonth = date.slice(0, 7);
      renderDateControl();
      persistFilters();
      loadEvents();
    });
    if (count === 0) cell.disabled = true;
    els.activityGrid.append(cell);
  }

  renderActivityStats(promptCounts, total);
  renderActivityLegend();
}

function renderActivityStats(promptCounts, total) {
  if (!els.activityStats) return;
  const todayCount = promptCounts.get(todayKey()) ?? 0;
  const activeDays = promptCounts.size;
  const avg = activeDays ? (total / activeDays).toFixed(1) : "0";
  let streak = 0;
  const cursor = new Date();
  while ((promptCounts.get(localDateKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  let busyDate = "";
  let busyCount = 0;
  for (const [date, count] of promptCounts) {
    if (count > busyCount) { busyCount = count; busyDate = date; }
  }
  const rows = [
    ["今日", String(todayCount)],
    ["活跃日均", avg],
    ["连续", streak > 0 ? `${streak} 天` : "—"],
    ["最忙", busyDate ? `${busyDate.slice(5)} · ${busyCount}` : "—"],
  ];
  const fragment = document.createDocumentFragment();
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    fragment.append(dt, dd);
  }
  els.activityStats.replaceChildren(fragment);
}

function renderActivityLegend() {
  if (!els.activityLegend) return;
  els.activityLegend.replaceChildren(element("span", "少"));
  for (const level of [0, 1, 2, 3, 4]) {
    const swatch = document.createElement("span");
    swatch.className = `activity-swatch level-${level}`;
    els.activityLegend.append(swatch);
  }
  els.activityLegend.append(element("span", "多"));
}

function renderEvents() {
  els.events.replaceChildren();
  els.eventCount.textContent = `${state.events.length} 条记录`;
  if (state.events.length === 0) {
    els.events.append(emptyBlock("没有匹配记录", "调整项目、日期、工具、类型或关键词后再试。"));
    return;
  }

  for (const event of [...state.events].reverse()) {
    const button = document.createElement("button");
    button.className = `event ${event.id === state.selectedId ? "is-active" : ""}`;
    button.type = "button";

    const title = event.prompt || event.toolName || event.kind;
    const snippet = event.prompt
      ? event.prompt.replace(/\s+/g, " ").slice(0, 180)
      : event.toolResultSummary || event.projectPath;

    const query = els.query.value.trim().toLowerCase();
    const strong = document.createElement("strong");
    appendHighlighted(strong, title.slice(0, 120), query);
    const snippetEl = document.createElement("span");
    appendHighlighted(snippetEl, snippet.slice(0, 220), query);
    button.append(
      tag(event.kind),
      strong,
      snippetEl,
      metaRow([
        event.source,
        shortProject(event.projectSlug),
        formatDate(event.capturedAt),
      ]),
    );
    button.addEventListener("click", () => renderDetail(event));
    els.events.append(button);
  }
}

async function renderDetail(event) {
  state.selectedId = event.id;
  renderEvents();
  els.detail.replaceChildren(detailSkeleton(event));
  try {
    const [related, conversation] = await Promise.all([
      fetchJson(`/api/events/${encodeURIComponent(event.id)}/related`).catch(() => []),
      fetchJson(`/api/events/${encodeURIComponent(event.id)}/conversation`).catch(() => ({ entries: [], reason: "对话加载失败" })),
    ]);
    els.detail.replaceChildren(detailContent(event, related, conversation));
    centerConversationCurrent();
  } catch (error) {
    els.detail.append(errorBlock(error));
  }
}

function detailContent(event, related, conversation) {
  const fragment = document.createDocumentFragment();
  const header = document.createElement("div");
  header.className = "detail-head";
  header.append(tag(event.kind), element("h2", detailTitle(event)));
  fragment.append(header);

  const meta = document.createElement("dl");
  meta.className = "meta-grid";
  addMeta(meta, "工具", event.source);
  addMeta(meta, "时间", formatDate(event.capturedAt));
  addMeta(meta, "项目", event.projectPath);
  addMeta(meta, "Session", event.sessionId);
  addMeta(meta, "Turn", event.turnId);
  addMeta(meta, "Raw event", event.rawEventName);
  fragment.append(meta);

  const commands = commandCopyItems(event);
  if (commands.length > 0) {
    fragment.append(section("快捷命令", copyGrid(commands)));
  }

  if (event.prompt) {
    fragment.append(section("Prompt", copyCard("复制 Prompt", event.prompt, pre(event.prompt))));
  }
  fragment.append(section("对话(本 session)", conversationPanel(conversation)));
  if (event.toolName) {
    fragment.append(section("Tool", element("p", event.toolName)));
  }
  if (event.toolResultSummary) {
    fragment.append(section("Tool result", pre(event.toolResultSummary)));
  }

  const relatedList = document.createElement("div");
  relatedList.className = "related-list";
  if (related.length === 0) {
    relatedList.append(emptyBlock("没有关联事件", "当前记录没有可识别的同 session 或 turn 事件。"));
  } else {
    for (const item of related) {
      const row = document.createElement("button");
      row.className = "related-item";
      row.type = "button";
      row.append(tag(item.kind), element("span", detailTitle(item)), element("small", formatDate(item.capturedAt)));
      row.addEventListener("click", () => renderDetail(item));
      relatedList.append(row);
    }
  }
  fragment.append(section("Related events", relatedList));
  return fragment;
}

function detailSkeleton(event) {
  const wrapper = document.createElement("div");
  wrapper.className = "detail-loading";
  wrapper.append(tag(event.kind), element("h2", detailTitle(event)), element("p", "正在读取关联事件..."));
  return wrapper;
}

function centerConversationCurrent() {
  const conv = els.detail.querySelector(".conversation");
  const current = conv?.querySelector(".conv-row.is-current");
  if (!conv || !current) return;
  const convRect = conv.getBoundingClientRect();
  const rowRect = current.getBoundingClientRect();
  // 只滚动对话容器本身,让当前轮在容器内居中,避免把整个页面拽到深处。
  conv.scrollTop += rowRect.top - convRect.top - conv.clientHeight / 2 + rowRect.height / 2;
}

function conversationPanel(conversation) {
  const wrap = document.createElement("div");
  wrap.className = "conversation";
  const entries = conversation?.entries ?? [];
  if (entries.length === 0) {
    wrap.append(emptyBlock("对话不可用", conversation?.reason || "未找到可展示的对话内容。"));
    return wrap;
  }
  const head = document.createElement("div");
  head.className = "conversation-head";
  head.append(element("span", `本 session 共 ${entries.length} 条`), conversationCopyButton(entries));
  wrap.append(head);
  for (const entry of entries) {
    wrap.append(conversationRow(entry));
  }
  return wrap;
}

function conversationRow(entry) {
  const row = document.createElement("div");
  row.className = `conv-row conv-${entry.role}${entry.isCurrent ? " is-current" : ""}`;
  const role = document.createElement("span");
  role.className = "conv-role";
  role.textContent = entry.role === "assistant" ? "assistant" : "user";
  const body = document.createElement("div");
  body.className = "conv-body";
  if (entry.text) body.append(pre(entry.text));
  if (entry.thinking) body.append(detailsBlock("thinking", entry.thinking));
  if (entry.toolUses && entry.toolUses.length > 0) {
    body.append(detailsBlock("tool_use", entry.toolUses.map((t) => `${t.name}\n${t.inputSummary || ""}`).join("\n\n")));
  }
  if (entry.toolResultSummary) body.append(detailsBlock("tool_result", entry.toolResultSummary));
  row.append(role, body);
  return row;
}

function detailsBlock(title, content) {
  const details = document.createElement("details");
  details.className = "conv-details";
  const summary = document.createElement("summary");
  summary.textContent = title;
  details.append(summary, pre(content));
  return details;
}

function conversationCopyButton(entries) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  button.textContent = "复制对话(脱敏)";
  button.addEventListener("click", async () => {
    const text = entries.map((entry) => {
      const parts = [
        entry.text,
        entry.thinking ? `[thinking]\n${entry.thinking}` : "",
        ...(entry.toolUses || []).map((t) => `[tool_use:${t.name}] ${t.inputSummary || ""}`),
        entry.toolResultSummary ? `[tool_result]\n${entry.toolResultSummary}` : "",
      ].filter(Boolean);
      return `[${entry.role}]\n${parts.join("\n")}`;
    }).join("\n\n");
    const safe = redactText(text);
    const copied = await copyText(safe);
    button.textContent = copied ? "已复制(脱敏)" : "复制失败";
    window.setTimeout(() => { button.textContent = "复制对话(脱敏)"; }, 1400);
  });
  return button;
}

// 与 src/capture/redact.ts 保持同步:出口(复制/导出)脱敏,本地展示保持原文。
const SECRET_PATTERNS = [
  [/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[REDACTED]"],
  [/\b([A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY)[A-Za-z0-9_]*\s*[:=]\s*)(["']?)[^"'\s]+/gi, "$1$2[REDACTED]"],
  [/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED_OPENAI_KEY]"],
];

function redactText(text) {
  return SECRET_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

async function exportMarkdown() {
  setStatus(els.exportStatus, "正在导出 Markdown...");
  els.export.disabled = true;
  try {
    const data = await fetchJson("/api/export-md", { method: "POST" });
    setStatus(els.exportStatus, `已导出 ${data.written.length} 个文件。`);
  } catch (error) {
    setStatus(els.exportStatus, errorMessage(error), true);
  } finally {
    els.export.disabled = false;
  }
}

async function saveConfig(event) {
  event.preventDefault();
  els.configStatus.textContent = "保存中";
  try {
    state.config = await fetchJson("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rawPayloads: els.rawPayloads.checked,
        markdownMode: els.markdownMode.value,
      }),
    });
    await loadConfig();
    els.configStatus.textContent = "已保存";
  } catch (error) {
    els.configStatus.textContent = errorMessage(error);
  }
}

function openConfigModal() {
  els.configModal.classList.add("is-open");
  els.configModal.setAttribute("aria-hidden", "false");
  els.rawPayloads.focus();
}

function closeConfigModal() {
  els.configModal.classList.remove("is-open");
  els.configModal.setAttribute("aria-hidden", "true");
  els.openConfig.focus();
}

function syncSelectedDate() {
  const promptCounts = countPromptsByDate();
  if (els.date.value && !promptCounts.has(els.date.value)) {
    els.date.value = "";
  }
  if (els.date.value) {
    state.calendarMonth = els.date.value.slice(0, 7);
    return;
  }
  const latestDate = [...promptCounts.keys()].sort().at(-1);
  if (latestDate) state.calendarMonth = latestDate.slice(0, 7);
}

function renderDateControl() {
  const promptCounts = countPromptsByDate();
  els.dateToggle.textContent = els.date.value
    ? `${els.date.value} (${promptCounts.get(els.date.value) ?? 0})`
    : "全部日期";
  els.dateTitle.textContent = state.calendarMonth;
  els.dateGrid.replaceChildren();

  const [year, month] = state.calendarMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let index = 0; index < first.getUTCDay(); index += 1) {
    const blank = document.createElement("span");
    blank.className = "date-cell date-blank";
    els.dateGrid.append(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${state.calendarMonth}-${String(day).padStart(2, "0")}`;
    const count = promptCounts.get(date) ?? 0;
    const button = document.createElement("button");
    button.className = `date-cell ${count > 0 ? "has-data" : "is-empty"} ${els.date.value === date ? "is-selected" : ""}`;
    button.type = "button";
    button.textContent = String(day);
    button.title = count > 0 ? `${date}: ${count} prompts` : `${date}: 无提交`;
    button.disabled = count === 0;
    button.addEventListener("click", () => {
      els.date.value = date;
      renderDateControl();
      setDatePickerOpen(false);
      persistFilters();
      loadEvents();
    });
    els.dateGrid.append(button);
  }
}

function setDatePickerOpen(open) {
  els.datePicker.hidden = !open;
  els.dateToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setListLoading() {
  els.eventCount.textContent = "加载中";
  els.events.replaceChildren(
    skeletonLine(),
    skeletonLine(),
    skeletonLine(),
    skeletonLine(),
  );
}

function renderError(error) {
  els.eventCount.textContent = "加载失败";
  els.events.replaceChildren(errorBlock(error));
  els.detail.replaceChildren(errorBlock(error));
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function tag(value) {
  const item = document.createElement("span");
  item.className = `tag tag-${String(value).replaceAll("_", "-")}`;
  item.textContent = labelKind(value);
  return item;
}

function metaRow(items) {
  const row = document.createElement("span");
  row.className = "event-meta";
  row.textContent = items.filter(Boolean).join(" / ");
  return row;
}

function addMeta(list, label, value) {
  if (!value) return;
  list.append(element("dt", label), element("dd", value));
}

function section(title, child) {
  const block = document.createElement("section");
  block.className = "detail-section";
  block.append(element("h3", title), child);
  return block;
}

function copyGrid(items) {
  const grid = document.createElement("div");
  grid.className = "copy-grid";
  for (const item of items) {
    grid.append(copyCard(item.label, item.value, element("code", item.value)));
  }
  return grid;
}

function copyCard(label, value, child) {
  const card = document.createElement("div");
  card.className = "copy-card";

  const head = document.createElement("div");
  head.className = "copy-card-head";
  head.append(element("strong", label), copyButton(value));

  card.append(head, child);
  return card;
}

function copyButton(value) {
  const button = document.createElement("button");
  button.className = "copy-button";
  button.type = "button";
  button.textContent = "复制";
  button.addEventListener("click", async () => {
    const copied = await copyText(value);
    button.textContent = copied ? "已复制" : "复制失败";
    window.setTimeout(() => {
      button.textContent = "复制";
    }, 1400);
  });
  return button;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function pre(value) {
  const item = document.createElement("pre");
  item.textContent = value;
  return item;
}

function emptyBlock(title, body) {
  const block = document.createElement("div");
  block.className = "empty-state";
  block.append(element("h3", title), element("p", body));
  return block;
}

function errorBlock(error) {
  const block = document.createElement("div");
  block.className = "error-state";
  block.append(element("h3", "请求失败"), element("p", errorMessage(error)));
  return block;
}

function skeletonLine() {
  const item = document.createElement("div");
  item.className = "skeleton-line";
  return item;
}

function element(name, text) {
  const item = document.createElement(name);
  item.textContent = text || "";
  return item;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}

function onFilterChange() {
  persistFilters();
  loadEvents();
}

function persistFilters() {
  const filters = {
    project: els.project.value,
    date: els.date.value,
    source: els.source.value,
    kind: els.kind.value,
    query: els.query.value,
  };
  localStorage.setItem("prompt-capture-filters", JSON.stringify(filters));
  syncUrl(filters);
}

function syncUrl(filters) {
  const params = new URLSearchParams();
  if (filters.project) params.set("project", filters.project);
  if (filters.date) params.set("date", filters.date);
  if (filters.source) params.set("source", filters.source);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  const search = params.toString();
  const target = search ? `?${search}` : "";
  if (location.search !== target) {
    history.pushState(null, "", search ? `?${search}` : location.pathname);
  }
}

function restoreFilters() {
  const params = new URLSearchParams(location.search);
  const hasUrl = [...params.keys()].length > 0;
  let filters;
  if (hasUrl) {
    filters = {
      project: params.get("project") || "",
      date: params.get("date") || "",
      source: params.get("source") || "",
      kind: params.get("kind") || "",
      query: params.get("q") || "",
    };
  } else {
    try {
      filters = JSON.parse(localStorage.getItem("prompt-capture-filters") || "{}");
    } catch {
      localStorage.removeItem("prompt-capture-filters");
      filters = {};
    }
  }
  els.project.value = filters.project || "";
  els.date.value = filters.date || "";
  els.source.value = filters.source || "";
  els.kind.value = filters.kind || "";
  els.query.value = filters.query || "";
}

function moveSelection(delta) {
  const list = [...state.events].reverse();
  if (list.length === 0) return;
  let idx = list.findIndex((event) => event.id === state.selectedId);
  if (idx < 0) idx = delta > 0 ? -1 : list.length;
  const next = list[idx + delta];
  if (!next) return;
  renderDetail(next);
  const active = els.events.querySelector(".event.is-active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function appendHighlighted(parent, text, query) {
  if (!query) { parent.append(text); return; }
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const hit = lower.indexOf(query, i);
    if (hit < 0) { parent.append(text.slice(i)); return; }
    if (hit > i) parent.append(text.slice(i, hit));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(hit, hit + query.length);
    parent.append(mark);
    i = hit + query.length;
  }
}

function countPromptsByDate() {
  const counts = new Map();
  for (const event of state.allEvents) {
    if (event.kind !== "user_prompt_submit") continue;
    const key = dateKey(event.capturedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recentDateKeys(days) {
  const dates = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(localDateKey(date));
  }
  return dates;
}

function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function activityLevel(count, max) {
  if (count === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function dateKey(value) {
  return localDateKey(new Date(value));
}

function todayKey() {
  return localDateKey(new Date());
}

function detailTitle(event) {
  if (event.kind === "user_prompt_submit") return promptSummary(event.prompt);
  if (event.toolName) return event.toolName;
  return labelKind(event.kind);
}

function promptSummary(prompt) {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Prompt";
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}

function commandCopyItems(event) {
  if (!event.sessionId) return [];
  const commands = [];
  if (event.source === "claude-code") {
    commands.push(
      { label: "Claude resume", value: `claude --resume ${event.sessionId}` },
      { label: "Claude fork", value: `claude --resume ${event.sessionId} --fork-session` },
    );
  }
  if (event.source === "codex") {
    commands.push(
      { label: "Codex resume", value: `codex resume ${event.sessionId}` },
    );
  }
  return commands;
}

function labelKind(kind) {
  switch (kind) {
    case "user_prompt_submit":
      return "prompt";
    case "pre_tool_use":
      return "pre tool";
    case "post_tool_use":
      return "post tool";
    case "stop":
      return "stop";
    default:
      return kind;
  }
}

function shortProject(slug) {
  return slug.length > 32 ? `${slug.slice(0, 29)}...` : slug;
}

function formatDate(value) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setStatus(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle("is-error", isError);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
