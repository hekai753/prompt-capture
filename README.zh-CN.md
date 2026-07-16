# prompt-capture

面向 Codex 和 Claude Code 原生 Hook 的本地提示词采集工具。

`prompt-capture` 会记录 AI CLI 对话中用户提交的 prompt，将数据保存在本机，生成按项目和日期组织的 Markdown 归档，并提供一个本地 Web 界面用于浏览、搜索和修改配置。它不包装终端，也不接管 TUI 输入；采集入口只使用各工具自己的 Hook 机制。

![Prompt Capture Web 界面](./assets/web-ui.png)

English: [README.md](./README.md)

## 当前状态

这是一个适合本地使用和真实 Hook payload 验证的 MVP。

已实现：

- Codex 和 Claude Code 的原生 Hook 安装/卸载。
- 默认只采集 `UserPromptSubmit`。
- 可选采集工具调用事件和停止事件。
- 追加式 JSONL 事件日志。
- Web UI 使用的 JSON 查询索引。
- 按项目和日期生成 Markdown。
- 本地 Web UI，支持筛选、详情、关联事件、导出和配置编辑。
- raw hook payload 默认关闭。

暂未实现：

- 面向大型归档的 SQLite/FTS 索引。
- 云同步。
- 助手回复正文采集。
- wrapper / PTY 终端采集。

## 安装

从 npm 安装：

```bash
npm install -g prompt-capture
```

在当前仓库中开发运行：

```bash
pnpm install
npm run build
node dist/src/cli/index.js --help
```

如果希望全局命令直接使用当前源码目录：

```bash
npm link
prompt-capture --help
```

## 快速开始

先预览会写入哪些 Hook：

```bash
prompt-capture install --target all --scope global --dry-run
```

安装 Claude Code Hook：

```bash
prompt-capture install --target claude --scope global
```

安装 Codex Hook：

```bash
prompt-capture install --target codex --scope global
```

启动本地 Web UI：

```bash
prompt-capture web --port 4873
```

浏览器打开：

```text
http://127.0.0.1:4873
```

## Hook 采集模型

默认安装只采集用户提交的 prompt：

```bash
prompt-capture install --target claude --scope global
prompt-capture install --target codex --scope global
```

如需采集工具调用元数据：

```bash
prompt-capture install --target codex --scope global --events prompt,tools
```

如需同时采集 `Stop` 事件：

```bash
prompt-capture install --target codex --scope global --events prompt,tools,stop
```

支持的 `--events` 值：

```text
prompt              仅 UserPromptSubmit
prompt,tools        UserPromptSubmit + PreToolUse + PostToolUse
prompt,tools,stop   UserPromptSubmit + PreToolUse + PostToolUse + Stop
all                 全部支持的 Hook 事件
```

安装器会追加 Hook 条目，用 `--installed-by prompt-capture` 标记自身写入的命令，并在写配置前生成带时间戳的备份。`uninstall` 只会删除本工具安装的 Hook，不会删除用户已有的其他 Hook。

```bash
prompt-capture uninstall --target all --scope global
```

## Codex 注意事项

Codex 还需要开启用户级 Hook 功能：

```toml
[features]
hooks = true
```

项目级 Codex Hook 还要求该项目已被 Codex 信任。本工具会写入 Hook manifest，但不会伪造 Codex 的 Hook trust state。

## 命令

```bash
prompt-capture install --target claude|codex|all [--scope global|project] [--events prompt|prompt,tools|prompt,tools,stop|all] [--dry-run]
prompt-capture uninstall --target claude|codex|all [--scope global|project] [--dry-run]
prompt-capture ingest --source claude-code|codex [--home path] [--print-id]
prompt-capture export-md [--home path]
prompt-capture web [--home path] [--port 4873]
prompt-capture config get [--home path]
prompt-capture config set rawPayloads true|false [--home path]
prompt-capture config set markdownMode realtime|manual [--home path]
```

Hook 调用 `ingest` 时默认不输出 stdout，避免 Codex 或 Claude Code 将诊断文本当成 Hook 返回值解析。手动调试时可以打印事件 id：

```bash
prompt-capture ingest --source codex --print-id < payload.json
```

## Web UI

Web UI 只绑定本机 `127.0.0.1`：

```bash
prompt-capture web --port 4873
```

当前 Web UI 功能：

- 事件数、Prompt 数、项目数、活跃日期、今日 Prompt、工具事件、会话数和当前筛选结果概览。
- 最近 13 周的 Prompt 提交矩阵。点击有提交的日期会筛选事件列表。
- 按项目、日期、来源工具、事件类型、关键词筛选。
- 日期控件会将没有用户提交 prompt 的日期置灰，不可选择。
- 事件列表展示 prompt 摘要和来源元数据。
- 详情页展示完整 prompt、元数据、工具摘要和同 session/turn 关联事件。
- Markdown 导出状态以内联方式显示。
- 配置弹窗支持修改 `rawPayloads` 和 `markdownMode`。
- 只读展示存储目录、Markdown 目录和配置文件路径。

## 配置

查看配置：

```bash
prompt-capture config get
```

默认配置：

```json
{
  "rawPayloads": false,
  "markdownMode": "realtime"
}
```

仅在调试适配器 payload 时启用 raw payload 保存：

```bash
prompt-capture config set rawPayloads true
```

改为只在手动导出时生成 Markdown：

```bash
prompt-capture config set markdownMode manual
```

恢复为每次采集后刷新当前项目/日期 Markdown：

```bash
prompt-capture config set markdownMode realtime
```

## 存储

默认存储根目录：

```text
~/.prompt-capture/
```

通过环境变量覆盖：

```bash
PROMPT_CAPTURE_HOME=/path/to/archive prompt-capture web
```

或通过 `--home` 覆盖：

```bash
prompt-capture web --home /path/to/archive --port 4873
```

当前目录结构：

```text
~/.prompt-capture/
  config.json
  events/
    YYYY-MM-DD.jsonl
  index.json
  md/
    projects/<project-slug>/YYYY-MM-DD.md
  raw/
    <source>/YYYY-MM-DD/<event-id>.json
```

说明：

- `events/*.jsonl` 是追加式事件日志，也是最重要的持久化数据。
- `index.json` 是 MVP 阶段 Web UI 使用的查询索引。
- `md/` 是可读归档产物，可以重新生成。
- `raw/` 只有在开启 `rawPayloads` 后才会写入。

## Markdown 导出

生成或重新生成 Markdown：

```bash
prompt-capture export-md
```

文件输出到：

```text
~/.prompt-capture/md/projects/<project-slug>/YYYY-MM-DD.md
```

当 `markdownMode` 为 `realtime` 时，每次采集只刷新当前项目/日期对应的 Markdown 文件。完整重建仍然使用 `export-md`。

## 隐私

- 默认所有数据只保存在本机。
- 默认存储目录位于用户 Home 下，不在被采集项目里。
- raw hook payload 默认关闭。
- MVP 不采集助手回复正文。
- 不要随意提交生成的归档文件，prompt 可能包含密钥、内部代码或业务上下文。

## 开发

安装依赖并构建：

```bash
pnpm install
npm run build
```

运行校验：

```bash
npm run typecheck
npm test
npm run build
```

使用 fixture 做本地手动验证：

```bash
node dist/src/cli/index.js ingest --source claude-code --home /tmp/prompt-capture-dev < tests/fixtures/claude-user-prompt.json
node dist/src/cli/index.js export-md --home /tmp/prompt-capture-dev
node dist/src/cli/index.js web --home /tmp/prompt-capture-dev --port 4873
```

本地打包：

```bash
npm pack
```
