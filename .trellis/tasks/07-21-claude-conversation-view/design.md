# Design — Claude Code 对话视图

## 模块边界

```
src/storage/conversation.ts   ← 新增:transcript 解析 + 缓存(纯函数,不碰 http)
src/web/server.ts             ← 改:新增路由 GET /api/events/:id/conversation
src/ui/app.js                 ← 改:detail 区渲染对话 section + 复制(脱敏)
src/ui/styles.css             ← 改:对话时间线样式(气泡 / 折叠 / 高亮)
```

不新增事件类型、不改 `adapters`、不改 `hooks`、不改 Event Log / index。

## 数据流

```
UI renderDetail(event)
  → fetch GET /api/events/:id/conversation
  → server: getEvent(id) 取 transcriptPath
       空/缺 → 200 {entries:[], reason}
       否则 → parseConversation(transcriptPath, {highlightPrompt: event.prompt})  (命中缓存直接返回)
                  read file (ENOENT → 200 {entries:[], reason:"transcript 文件未找到"})
                  逐行 JSON.parse(容错跳过)
                  归类为 ConversationEntry[]
                  启发式标记 isCurrent
                  缓存 by (path, mtime)
  → UI 渲染时间线;「复制对话」按钮:复制前对每条 text 跑 redactText
```

## transcript 解析(Claude Code JSONL)

每行一个 JSON 对象,关注字段:`type`、`uuid`、`timestamp`、`message.role`、`message.content`。

content 形态:
- user:可能是 `string`,或 block 数组(`{type:"text"|"tool_result", ...}`)。
- assistant:block 数组,block 类型 `text`(`{text}`)、`thinking`(`{thinking}`)、`tool_use`(`{name,input}`)。

归类规则(`ConversationEntry`):

```ts
export type ConversationEntry = {
  role: "user" | "assistant";
  uuid?: string;
  timestamp?: string;
  text?: string;                          // user/assistant 文本拼接
  toolUses?: Array<{ name: string; inputSummary: string }>;
  toolResultSummary?: string;             // user 行内 tool_result 的摘要
  thinking?: string;
  isCurrent?: boolean;                    // 命中 event.prompt 时标记
  isEmpty?: boolean;                      // 无可展示内容(用于折叠/过滤)
};
```

- 跳过 `type` 非 user/assistant、无 `message`、或 JSON 解析失败的行;不抛错。
- text:拼同一条 message 内所有 `text`/字符串 content;`tool_result` content 摘要进 `toolResultSummary`。
- assistant `thinking` 单独字段;`tool_use` 的 `input` 经 `summarizeUnknown`(复用 `capture/object.ts`)进 `toolUses`。
- 长文本不在此截断(前端 CSS 限高);解析只负责归类。

复用:`summarizeUnknown` 来自 `capture/object.ts`(已被 adapter 用于 tool_result 摘要)。

## 当前轮高亮(启发式,容错)

- 入参 `highlightPrompt`:对 user entry 的 `text` 做 `text === prompt || text.startsWith(prompt.slice(0,40)) || prompt.startsWith(text.slice(0,40))`。
- 命中第一条即标记 `isCurrent=true`,停止后续匹配。
- 不命中:`isCurrent` 全空,前端不高亮、不报错(满足「未命中则不高亮」)。

## 缓存

- 模块级 `Map<string, { mtimeMs: number; entries: ConversationEntry[] }>`。
- 请求时 `stat(path)`:mtimeMs 未变 → 返回缓存;变了/无缓存 → 重解析并替换。
- `stat` ENOENT → 不缓存,返回降级 reason。
- 缓存无界(MVP,本地单用户);后续若需可加 LRU。属于实现细节,非契约。

## Redact 边界

- **展示用原文**(服务端不脱敏、前端展示原值)。
- **出口脱敏**:仅前端「复制对话」按钮,复制前对每条 entry 的 `text/thinking/toolResultSummary/inputSummary` 跑 `redactText`(`capture/redact.ts` 已导出)。
  - 服务端不引 redact(展示路径保持原样);脱敏只发生在浏览器复制动作。
- md 导出本轮不包含对话(见 prd Out of Scope),故 export-md 路径不改。

## 失效降级(统一 200 + reason)

| 情况 | 响应 |
|---|---|
| 事件不存在 | 404(既有行为) |
| 事件存在但 transcriptPath 空(Codex) | 200 `{entries:[], reason:"该来源未提供 transcript 路径(Codex 支持 forthcoming)"}` |
| 文件 ENOENT / 读失败 | 200 `{entries:[], reason:"transcript 文件未找到:可能已清理或换机器"}` |
| 解析后为空 | 200 `{entries:[], reason:"transcript 解析后无可展示内容"}` |

前端按 `entries.length===0` 显示降级卡片,其余 detail 区域不受影响。

## UI 结构(detail 内新增 section)

- 位置:`detailContent` 里,在「Prompt」section 之后、Related 之前,新增「对话(本 session)」section。
- 时间线:每条 entry 一行,左角色标签(user/assistant),右内容。
- assistant text 默认展开;tool_use / tool_result / thinking 用 `<details>` 默认收起。
- `isCurrent` 的 entry 加 `is-current` 类 + `scrollIntoView({block:"center"})`。
- 「复制对话」按钮在 section 头;复制产物为脱敏纯文本。
- 长内容:`pre` 既有 `max-height + overflow:auto` 模式复用。

## 不改 / 不做(明确边界)

- 不新增 `CaptureEventKind`、不写 Event Log / index / md。
- 不改 install/uninstall/hook 默认集。
- 不在浏览器解析 transcript。
- 不引入 markdown / 语法高亮库。
- 不做 Codex 对话视图(端点对 Codex 走降级分支)。

## 兼容性 / 回滚

- 纯新增端点 + UI section;既有端点与渲染不动。
- 回滚:删除新路由 + conversation.ts + UI section 即恢复原状;无数据迁移、无 schema 变更。
