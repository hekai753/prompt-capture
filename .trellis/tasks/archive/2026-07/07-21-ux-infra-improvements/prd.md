# P1 体验与 Codex 对话与 SW 缓存优化

## Goal

延续上轮(个人自用、不加 hook、不动存储层),推进三项已被识别的改进:P1 前端交互、Codex 对话视图、SW 缓存策略。

## Scope（任务地图）

- **子 C — P1 前端交互**(`07-21-p1-keyboard-debounce-url`):键盘导航 / 搜索 debounce+高亮 / URL 同步筛选。
- **子 D — Codex 对话视图**(`07-21-codex-conversation-view`):零 hook,按 sessionId glob `~/.codex` rollout 解析对话。数据源已验证(见 `research/codex-data-source.md`)。
- **子 E — SW 缓存策略**(`07-21-sw-cache-strategy`):cache-first → network-first(带缓存兜底),改 UI 不再需要 bump `CACHE_NAME`。

执行顺序:**E(解锁后续开发)→ C → D**。

## Cross-child Acceptance Criteria

- [ ] C / D / E 各自验收项通过。
- [ ] `npm run typecheck && npm test && npm run build` 全绿。
- [ ] 既有功能无回归;未新增 hook;未改 install/uninstall。
- [ ] Codex 事件在 UI 显示真实对话(不再降级)。
- [ ] 改 UI 后普通刷新即取最新(无需 unregister SW / bump cache)。

## Constraints

- 零 hook 变更;不动存储层架构;隐私边界不变(本地原样 / 出口脱敏)。

## Out of Scope

- P2 dark mode / `prefers-reduced-motion`;P3 `relatedEvents` 限量、按筛选导出、核实 `codex resume` 命令;Claude 对话视图已实现(上轮)。
