# Claude Code 对话视图

## Goal

在 Web UI 的 detail 区,把一条 user prompt 扩展成「整 session 完整对话」视图:user ↔ assistant ↔ tool 交错的全保真时间线。**不新增 hook**,靠每条事件已采集的 `transcriptPath` 现读 Claude Code transcript 解析。

## Background

- Claude Code 的 `UserPromptSubmit` payload 已带 `transcript_path`,`claude-code.ts:52` 已存入事件的 `transcriptPath` 字段,但全代码库无消费者。
- transcript 是 Claude Code 自维护的 session 对话 JSONL(含 user/assistant/tool_use/tool_result/thinking),持续追加;用户事后打开 UI 时,该轮 assistant 回复已落盘。
- Codex payload 不带 transcript_path → 本轮不支持 Codex 对话视图(二期)。

## Requirements

1. **零 hook 变更**:不改 `hooks/manifest.ts`,不改默认/可选事件集,不改 install/uninstall。
2. **服务端懒读**:新增 `GET /api/events/:id/conversation`,按事件 `transcriptPath` 读 transcript 文件并解析为有序对话时间线返回。
3. **全保真解析**:正确提取 user 文本、assistant 文本(多 text block 拼接)、thinking、tool_use(名 + 输入摘要)、tool_result(摘要)。跳过 summary/system/无 message/坏行,不因单行坏掉整个响应。
4. **UI 呈现**:detail 区新增「对话」section,整 session 时间线;assistant 文本展开;tool_use / tool_result / thinking 可折叠、默认收起;长内容限高滚动。
5. **当前轮高亮 + 定位**:用 `event.prompt` 启发式匹配 transcript 中的 user 行,命中则标记「当前轮」并自动滚动到此;未命中则不高亮(不报错)。
6. **失效降级**:transcript 文件不存在 / 读失败 / 解析为空 → 返回空数组 + 原因;UI 显示「对话归档不可用:<原因>」,不影响 detail 其余部分。
7. **缓存**:服务端按 `(transcriptPath, mtime)` 缓存解析结果,文件未变不重解析。
8. **隐私边界(本地原样 / 出口脱敏)**:对话展示用原文;「复制对话」按钮复制时走 Redact。
9. **不持久化**:对话不进 Event Log、不进 index、不落 md;纯按需投影。
10. **Codex**:该端点对 Codex 事件(transcriptPath 为空)返回空 + 明确原因,不报 500。

## Acceptance Criteria

- [ ] 给定一个带 `transcriptPath` 的 Claude Code 事件,`GET /api/events/:id/conversation` 返回有序 `ConversationEntry[]`,含 user/assistant/tool 各角色。
- [ ] assistant 多 text block 被正确拼接;tool_use/thinking/tool_result 各自归类。
- [ ] transcript 含坏行/summary 行时,响应仍成功(跳过坏行),不 500。
- [ ] `event.prompt` 能匹配 transcript 时,对应 entry 标记 `isCurrent=true`。
- [ ] transcriptPath 为空(Codex 事件)或文件不存在:HTTP 200 + `{entries:[], reason:"..."}`,UI 显示降级提示。
- [ ] 同文件未变时,第二次请求命中缓存(可由解析计数/日志验证,不重读重解析)。
- [ ] 「复制对话」复制出的文本为 Redact 后版本;UI 展示为原文。
- [ ] 既有路由(`/api/events`、`/related`、`/config`、`/export-md`、静态资源)行为无回归。
- [ ] `npm run typecheck && npm test && npm run build` 全绿;新增解析单测覆盖 user/assistant/tool_use/tool_result/thinking/坏行。

## Constraints

- 不引入新运行时依赖;不引入 markdown 渲染库(纯文本 + 折叠)。
- 解析在服务端做(Node),不在浏览器做。
- 不改 `CaptureEventKind`,不新增事件类型。

## Related

- `CONTEXT.md` — transcript / Conversation / 懒读 / Redact 边界。
- `docs/adr/0001-lazy-transcript-conversation.md` — 决策与备选方案否决理由。
