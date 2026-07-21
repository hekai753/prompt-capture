# Codex 对话视图

## Goal

让 Codex 事件在 detail 区也能显示整 session 对话(与 Claude 对等的体验),仍**零 hook**。靠按 sessionId 在 `~/.codex` 下 glob rollout 文件解析。

## Background

- Codex hook payload 不带 transcript 路径,但 session 文件名含 session uuid(`~/.codex/sessions/.../rollout-<ts>-<uuid>.jsonl`,归档在 `archived_sessions/`)。
- 已验证:采集的 Codex sessionId = rollout 文件名 uuid(本机 5/5 命中)。详见 `research/codex-data-source.md`。

## Requirements

1. 复用 `GET /api/events/:id/conversation`;后端按 `event.source` 分流:`claude-code` 走 `transcriptPath`,`codex` 走 sessionId glob rollout。
2. Codex 解析:`type=response_item` 行,`payload.role=user/assistant`(跳过 `developer` / 其他);user 的 `input_text` → text;assistant 的 `output_text` → text;`function_call` → toolUses;`function_call_output` → toolResultSummary。复用 `ConversationEntry` 类型 + `applyHighlight` + `(path, mtime)` 缓存。
3. Codex home:默认 `~/.codex`,支持 `CODEX_HOME` 覆盖;扫 `sessions` 与 `archived_sessions` 两处,取首个命中。
4. UI 无变化:Codex 事件不再走「未提供路径」降级,返回真实对话;当前轮高亮用 `event.prompt` 匹配 user `input_text`。
5. 失效降级:rollout 找不到 / 解析空 → `{entries:[], reason}`。

## Acceptance Criteria

- [ ] 给定 Codex 事件,conversation 端点返回有序 `ConversationEntry[]`(user/assistant/tool)。
- [ ] `developer` / `system_meta` / `event_msg` / `turn_context` 行被跳过;坏行跳过。
- [ ] sessionId 在 `~/.codex/sessions` 命中时返回对话;命中 `archived_sessions` 亦可。
- [ ] rollout 缺失 / 空 → 200 + reason。
- [ ] Codex 事件 UI 显示对话(不再「未提供路径」);复制对话脱敏。
- [ ] `typecheck && test && build` 全绿;Claude 对话视图无回归。

## Constraints

- 零 hook;不持久化对话;复用现有端点与类型;不改 adapter / install。

## Related

- `research/codex-data-source.md` — 数据源验证与方案。
- `CONTEXT.md` — transcript / Conversation / Redact 边界。
