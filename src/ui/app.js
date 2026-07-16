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

for (const el of [els.project, els.date, els.source, els.kind, els.query]) {
  el.addEventListener("input", () => {
    persistFilters();
    loadEvents();
  });
}

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
  }
  if (event.key === "Escape" && !els.datePicker.hidden) {
    setDatePickerOpen(false);
    els.dateToggle.focus();
  }
});

restoreFilters();
refreshAll();

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

    button.append(
      tag(event.kind),
      element("strong", title.slice(0, 120)),
      element("span", snippet.slice(0, 220)),
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
    const related = await fetchJson(`/api/events/${encodeURIComponent(event.id)}/related`);
    els.detail.replaceChildren(detailContent(event, related));
  } catch (error) {
    els.detail.append(errorBlock(error));
  }
}

function detailContent(event, related) {
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

  if (event.prompt) {
    fragment.append(section("Prompt", pre(event.prompt)));
  }
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

function persistFilters() {
  localStorage.setItem("prompt-capture-filters", JSON.stringify({
    project: els.project.value,
    date: els.date.value,
    source: els.source.value,
    kind: els.kind.value,
    query: els.query.value,
  }));
}

function restoreFilters() {
  try {
    const filters = JSON.parse(localStorage.getItem("prompt-capture-filters") || "{}");
    els.project.value = filters.project || "";
    els.date.value = filters.date || "";
    els.source.value = filters.source || "";
    els.kind.value = filters.kind || "";
    els.query.value = filters.query || "";
  } catch {
    localStorage.removeItem("prompt-capture-filters");
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

function recentDateKeys(days) {
  const dates = [];
  const today = new Date(`${todayKey()}T00:00:00.000Z`);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
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
  return String(value).slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function detailTitle(event) {
  return event.prompt || event.toolName || event.kind;
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
