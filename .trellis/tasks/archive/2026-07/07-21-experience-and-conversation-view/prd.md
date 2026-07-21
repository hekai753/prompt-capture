# prompt-capture 体验与对话视图优化

## Goal

作为个人本地工具,本轮解决两类最影响日常使用的问题:(1) 时区归属错位导致「今日 Prompt / 提交矩阵」骗人;(2) 归档只能看用户输入、看不到 assistant 回复,缺乏「完整对话」视图。**不重构存储层、不加任何 hook。**

## Scope（任务地图）

本请求含两个可独立验证的交付物,以子任务承载:

- **子任务 A — 时区统一到本地**(`07-21-local-timezone-unification`,轻量/PRD-only)
  - 统一 ingest jsonl 命名、前端日期分桶、`listEvents` 过滤、今日统计到**本地时区**。
- **子任务 B — Claude Code 对话视图**(`07-21-claude-conversation-view`,复杂/prd+design+implement)
  - 零额外 hook,服务端按已采集的 `transcriptPath` 懒读 Claude Code transcript,在 UI detail 展示整 session 全保真对话;本地原样展示、出口脱敏;Codex 二期。

执行顺序:先 A(小、独立、先清),再 B。

## Cross-child Acceptance Criteria

- [ ] 子任务 A 全部验收项通过。
- [ ] 子任务 B 全部验收项通过。
- [ ] `npm run typecheck && npm test && npm run build` 全绿。
- [ ] hook 配置(install/uninstall)、ingest、events/events/related/export-md/config 等既有 API 行为无回归。
- [ ] 无新增 hook、无对存储层架构(index.json 读改写模型)的结构性改动。

## Constraints

- **零 hook 变更**:不新增 Stop/SessionStart 等采集,不改 `hooks/manifest.ts` 的默认事件集。assistant 回复靠 `transcriptPath` 懒读。
- **不动存储层架构**:本轮不引入真正的 SQLite/FTS,不重构 `upsertEvent` 读改写模型(见 backlog)。
- **隐私边界**:本地 UI 展示原样;任何「出口」(复制、导出)走 Redact。
- **Codex 对话视图二期**:本轮不为 Codex 实现对话视图。

## Out of Scope（已识别的 backlog,本轮不做）

- 存储层债:`sqlite.ts` 实为全量 `index.json` 读改写;`upsertEvent` 非原子(并发丢事件);无 schema 版本/迁移。
- P1 体验:键盘导航(j/k/↑↓/`/`/Esc、选中即加载)、搜索 debounce + 命中高亮、URL 同步筛选。
- P2 视觉:dark mode、`prefers-reduced-motion` 守护。
- P3 小正确性:`relatedEvents` 按 turnId 优先 + 限量、导出支持「当前筛选视图」、核实 `codex resume` / `claude --resume` 命令准确性。
- Codex 对话视图(需先验证 Codex hook 是否给 transcript 路径,届时可能需轻量 hook 或 sessions 扫描,单独 grilling)。

## Related Docs

- `CONTEXT.md` — 项目 glossary(含 transcript / Conversation / 懒读 / Redact 边界等术语)。
- `docs/adr/0001-lazy-transcript-conversation.md` — 零-hook 懒读决策。
