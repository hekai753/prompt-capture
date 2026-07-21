# Design — Codex 对话视图

## 模块边界(改动)

```
src/storage/conversation.ts   ← 加 codexHome() / findCodexRollout() / parseCodexRollout() / readCodexConversation()
src/web/server.ts             ← conversation 路由按 source 分流(去掉「transcriptPath 空=Codex 降级」,改为 Codex 分支)
tests/conversation.test.ts    ← Codex 解析用例
tests/web.test.ts             ← Codex 端到端用例
```

不改 UI、adapter、hooks、install。

## 数据流

```
GET /api/events/:id/conversation
  event = getEvent(id)                      // 不存在 → 404
  switch event.source:
    claude-code:
       transcriptPath 空 → {entries:[], reason}
       否则 readConversation(transcriptPath, {highlightPrompt: event.prompt})
    codex:
       sessionId 空 → {entries:[], reason:"该事件无 sessionId"}
       path = findCodexRollout(sessionId)
       path 空 → {entries:[], reason:"未找到 Codex session 文件"}
       readCodexConversation(path, {highlightPrompt: event.prompt})
    其他 → {entries:[], reason}
```

## Codex rollout 解析

每行 `{timestamp, type, payload}`。仅处理 `type === "response_item"`:

| payload.role | content block | 归类 |
|---|---|---|
| user | `input_text` | `entry.text` 拼接 |
| assistant | `output_text` | `entry.text` 拼接 |
| assistant | `function_call` | `toolUses`({name, inputSummary: summarizeUnknown(input/arguments)}) |
| user | `function_call_output` | `toolResultSummary` |
| developer / 其他 | — | 跳过 |

非 `response_item` 行(`session_meta` / `event_msg` / `turn_context`)与坏 JSON 行跳过。`timestamp` 取行内;无 per-row uuid(uuid 在文件名)。

## glob 定位

```
codexHome() = process.env.CODEX_HOME || ~/.codex
findCodexRollout(sessionId):
  for dir in ["sessions", "archived_sessions"]:
    files = readdir(codexHome/dir, {recursive:true, withFileTypes:false})  // Node 18.17+
    hit = files.filter(f => f.endsWith(`${sessionId}.jsonl`)).first
    if hit: return join(codexHome/dir, hit)
  return undefined
```

sessionId 是 uuid,后缀精确匹配;不全量读文件内容,只按文件名过滤,开销小。

## 复用

- `ConversationEntry` 类型、`applyHighlight`、模块级缓存(`Map<path,{mtimeMs,entries}>`)与 Claude 共享——Codex 与 Claude 走同一个缓存 Map。
- `readCodexConversation` 与 `readConversation` 同骨架:`stat`(ENOENT → reason)→ 缓存查 `(path, mtimeMs)` → `parseCodexRollout` → `applyHighlight`。

## server 改动

conversation 路由去掉「transcriptPath 空 → Codex 降级」的笼统分支,改为按 `event.source` 分发到 `readConversation` 或 `readCodexConversation`。统一返回 `{entries, reason}`。

## 失效降级(200 + reason)

| 情况 | reason |
|---|---|
| 事件不存在 | 404 |
| claude-code 且 transcriptPath 空 | (既有可能,理论上 claude 总有) |
| codex 且 sessionId 空 | 「该事件无 sessionId」 |
| codex rollout 未找到 | 「未找到 Codex session 文件」 |
| 解析后为空 | 「session 解析后无可展示内容」 |

## 不改 / 不做

- 不改 `app.js` / `styles.css`(UI 对 source 无感)。
- 不新增 hook、不改 adapter、不改 install/默认事件集。
- 不在浏览器解析;不在 ingest 解析;不持久化。
