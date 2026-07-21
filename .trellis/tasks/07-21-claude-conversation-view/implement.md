# Implement — Claude Code 对话视图

执行前提:`task.py start` 后再动代码。每步完成后跑该步的验证命令。

## Step 1 — 解析层 `src/storage/conversation.ts`(纯函数,可单测)

- [ ] 定义 `ConversationEntry` 类型(见 design)。
- [ ] 实现 `parseConversation(path, opts?: { highlightPrompt?: string }): Promise<{ entries: ConversationEntry[]; reason?: string }>`:
  - [ ] `stat(path)`;ENOENT → `{entries:[], reason:"transcript 文件未找到"}`。
  - [ ] 读文件,按行 split;逐行 `JSON.parse`,失败则跳过。
  - [ ] 跳过无 `message` 或 `type` 非 user/assistant 的行。
  - [ ] user content(string 或 block 数组):text 进 `text`;`tool_result` 摘要进 `toolResultSummary`。
  - [ ] assistant content:block 数组 → `text` 拼接 / `thinking` / `toolUses`(input 经 `summarizeUnknown`)。
  - [ ] 启发式 `isCurrent` 标记(design 规则),命中即停。
  - [ ] entries 为空 → `reason:"transcript 解析后无可展示内容"`。
- [ ] 缓存层:模块级 `Map` by `(path, mtimeMs)`;封装 `readConversation(path, opts)` 先查缓存。
- [ ] 复用 `summarizeUnknown`(`capture/object.ts`),不重复造摘要逻辑。

**验证**:`npm run typecheck`;新增 `tests/conversation.test.ts`(见 Step 4)此时先写解析用例并跑 `npm test`。

**Review gate G1**:解析层对「user 文本 / assistant 多 text / thinking / tool_use / tool_result / 坏行跳过 / ENOENT / 空结果」各有用例通过。

## Step 2 — 服务端路由 `src/web/server.ts`

- [ ] 在 `relatedMatch` 之后加:`GET /api/events/:id/conversation`。
- [ ] `getEvent(id)`;不存在 → 404。
- [ ] `transcriptPath` 空 → 200 `{entries:[], reason:"该来源未提供 transcript 路径(Codex 支持 forthcoming)"}`。
- [ ] 否则 `readConversation(transcriptPath, { highlightPrompt: event.prompt })`,200 返回。
- [ ] 异常 → 走既有 500 分支(保持与现有一致)。
- [ ] 注意路由顺序:`/api/events/:id/conversation` 要在 `/api/events/:id` 通配之前匹配(现有代码用 regex,确保 `:id` 正则不误吞 `/conversation`)。

**验证**:`npm run typecheck && npm test`(server 行为用例)。

**Review gate G2**:手动 `node dist/src/cli/index.js web --home /tmp/pc-dev --port 4873`,curl 上述三种情况(有 transcript / Codex 空 / 不存在文件)返回符合 design 降级表。

## Step 3 — UI `src/ui/app.js` + `styles.css`

- [ ] `renderDetail` 内,获取 conversation:复用既有 `fetchJson` 拉 `/api/events/:id/conversation`。
- [ ] `detailContent` 在 Prompt section 之后插入「对话」section:
  - [ ] `entries.length===0` → 渲染降级卡片(`reason`)。
  - [ ] 否则渲染时间线;assistant text 展开;tool_use/thinking/tool_result 用 `<details>`。
  - [ ] `isCurrent` entry 加 `is-current` 类并 `scrollIntoView({block:"center"})`。
- [ ] section 头「复制对话」按钮:复制前对每条 entry 文本字段跑 **前端** redact。
  - [ ] 前端无 TS 模块;在 `app.js` 内实现与 `redactText` 同样三条正则的轻量 `redactText`(synchronize 注释指向 `src/capture/redact.ts`)。
- [ ] `styles.css`:对话行布局、角色标签、`is-current` 高亮、`<details>` 样式、长内容限高(复用 `pre` 模式)。
- [ ] 失败(detail 现有 try/catch)不影响 detail 其余部分;conversation 单独 try/catch。

**验证**:`npm run build`;浏览器打开 UI,选一条 Claude Code 事件,确认对话渲染/折叠/高亮/复制(脱敏)。

**Review gate G3**:用一条真实 Claude Code transcript(从 `~/.claude/projects/...` 取一段造 fixture)验证全保真;对 Codex 事件确认降级提示。

## Step 4 — 测试 `tests/conversation.test.ts` + server 用例

- [ ] fixture:造一个最小 transcript JSONL(含 user 文本、assistant 多 text、thinking、tool_use、tool_result、一行坏 JSON、一行 summary)。
- [ ] 断言:entries 顺序、角色、text 拼接、thinking 字段、toolUses 名、坏行被跳过、`highlightPrompt` 命中 `isCurrent`。
- [ ] ENOENT 路径 → `{entries:[], reason}`。
- [ ] server:对 mock root 注入事件 + transcript 文件,curl/fetch 三种降级返回。
- [ ] 缓存:同文件二次调用不重读(可用 spy 或 mtime 不变断言)。

**验证**:`npm run typecheck && npm test && npm run build`。

## Step 5 — 文档同步

- [ ] `README.md` / `README.zh-CN.md`:Web UI features 列表加「Claude Code 对话视图(按 transcript 现读)」一句;Privacy 段补「对话展示用原文,复制时脱敏」。
- [ ] `CONTEXT.md` / ADR-0001 已在 grilling 阶段写就,复核无需改。

## 全局验证(完成前)

- [ ] `npm run typecheck && npm test && npm run build` 全绿。
- [ ] 既有流程无回归:install --dry-run、ingest fixture、/api/events?...、/related、/config、/export-md、静态资源。
- [ ] 未改动 `hooks/manifest.ts`(`git diff src/hooks` 应为空)。
- [ ] 未新增运行时依赖(`package.json` dependencies 无变化)。

## Rollback points

- G1 未过 → 解析层问题隔离在 `conversation.ts`,不影响线上。
- G2 未过 → 移除新路由即可,UI 不受影响(端点 404 时前端走降级)。
- G3 未过 → UI section 单独可回退;前端 redact 与解析独立。
- 全量回滚:删路由 + conversation.ts + UI section;无数据/schema 影响。
