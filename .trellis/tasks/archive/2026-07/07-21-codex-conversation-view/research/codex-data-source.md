# Codex 对话视图 — 数据源研究

## 结论

Codex 对话视图可行,且**零 hook**(满足约束)。按事件 sessionId 在 `~/.codex` 下 glob rollout 文件即可,无需新增任何 hook。

## 关键事实(本机验证)

- Codex session 文件:`~/.codex/sessions/YYYY/MM/DD/rollout-<ISO ts>-<session-uuid>.jsonl`,**文件名含 session uuid**;归档后的在 `~/.codex/archived_sessions/`。
- 我们采集的 Codex 事件 `sessionId` = rollout 文件名里的 uuid:实测 index.json 中 5/5 codex sessionId 都能在 `~/.codex/sessions` 命中对应 rollout。
- rollout 每行 `{timestamp, type, payload}`:
  - `type=response_item`,`payload.role` = `user` / `assistant` / `developer`,`payload.content` = block 数组(user: `input_text`;assistant: `output_text`;另可能有 `function_call` / `function_call_output`)。
  - 其他 type(`session_meta` / `event_msg` / `turn_context`)无对话正文,跳过。
- Codex hook payload **不带** transcript/session 路径(仅 `session_id`),不能像 Claude 那样靠 `transcriptPath` 直接读;但文件名含 uuid,可 glob 定位。

## 方案

- 复用 `GET /api/events/:id/conversation`:后端按 `event.source` 分流 ——
  - `claude-code`:走已实现的 `readConversation(transcriptPath)`。
  - `codex`:按 `sessionId` glob `~/.codex/{sessions,archived_sessions}/**/*.jsonl`,命中后解析 `response_item` 为 `ConversationEntry[]`。
- 新增 `parseCodexRollout(path)`(放 `src/storage/conversation.ts`),复用 `ConversationEntry` 类型、`applyHighlight`、`(path, mtime)` 缓存。
- Codex home:默认 `~/.codex`,支持 `CODEX_HOME` 环境变量覆盖。
- UI 无变化:Codex 事件不再走「未提供路径」降级,而是返回真实对话。

## 风险 / 边界

- 扫描成本:用 sessionId 后缀精确 glob(`*<id>.jsonl`),非全量遍历,可接受。
- rollout 可能在 `sessions` 或 `archived_sessions`,两处都扫,取第一个命中。
- Codex home 自定义用户靠 `CODEX_HOME` 覆盖。
