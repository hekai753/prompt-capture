# Implement — Codex 对话视图

## Step 1 — `src/storage/conversation.ts` 加 Codex 解析

- [ ] `codexHome()`: `process.env.CODEX_HOME || join(homedir(), ".codex")`。
- [ ] `findCodexRollout(sessionId)`: 在 `codexHome()` 的 `sessions` 与 `archived_sessions` 下 `readdir({recursive:true})`,筛 `endsWith(\`${sessionId}.jsonl\`)`,返回首个命中绝对路径;无则 undefined。
- [ ] `parseCodexRollout(path)`: 逐行 JSON.parse(坏行跳过);仅 `type==="response_item"`;按 `payload.role` + content block 归类(input_text/output_text → text;function_call → toolUses;function_call_output → toolResultSummary;developer 跳过)。
- [ ] `readCodexConversation(path, opts)`: `stat`(ENOENT → reason) → 缓存 `(path, mtimeMs)` → `parseCodexRollout` → `applyHighlight`(复用);结构与 `readConversation` 一致。
- 复用 `summarizeUnknown`、`applyHighlight`、缓存 Map。

**验证**:`npm run typecheck`;`conversation.test.ts` 加 Codex fixture 用例并 `npm test`。

**G1**:`parseCodexRollout` 对 user input_text / assistant output_text / function_call / function_call_output / developer 跳过 / 坏行 / 空 各有用例通过。

## Step 2 — `src/web/server.ts` 按 source 分流

- [ ] conversation 路由去掉「transcriptPath 空 → Codex 降级」笼统分支。
- [ ] `event.source==="claude-code"`: 维持 `transcriptPath` 逻辑。
- [ ] `event.source==="codex"`: sessionId 空 → reason;否则 `findCodexRollout` → 命中 `readCodexConversation`,未命中 reason。
- [ ] 其他 source: `{entries:[], reason}`。

**验证**:`npm run typecheck`;`web.test.ts` 加 Codex 端到端(注入 codex 事件 + 临时 rollout 文件)。

**G2**:Codex 端点返回对话;Claude 端点行为无回归。

## Step 3 — 测试

- [ ] `conversation.test.ts`:Codex fixture(含 session_meta / event_msg / turn_context / developer / user input_text / assistant output_text / function_call / function_call_output / 坏行);断言归类、跳过、`highlightPrompt` 命中。
- [ ] `findCodexRollout`:临时目录造 `sessions/.../rollout-*-<id>.jsonl` 与 `archived_sessions/...`,断言命中(含归档目录)。
- [ ] `web.test.ts`:Codex 事件 → `/api/events/:id/conversation` 返回 entries。

**验证**:`npm run typecheck && npm test && npm run build`。

## Step 4 — 文档

- [ ] `README.md` / `README.zh-CN.md`:对话视图说明从「Claude Code transcript」扩展为「Claude Code transcript + Codex session 文件,均按需现读」。
- [ ] `CONTEXT.md`:`transcript` 条目补 Codex rollout 文件语义(或加一条 Codex 专用术语)。

## 全局验证(完成前)

- [ ] `npm run typecheck && npm test && npm run build` 全绿。
- [ ] 手动:启动 web,选一条 Codex 事件,确认对话渲染(真实 `~/.codex` 数据)。
- [ ] Claude 对话视图、时区、既有 API 无回归。
- [ ] 未改 `hooks/manifest.ts`、未改 adapter。

## Rollback

- Codex 分支独立于 Claude;移除 server 的 Codex 分流 + `conversation.ts` 的 Codex 函数即回退到「Codex 走降级」。无 schema 变更、无数据影响。
