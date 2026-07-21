# 时区统一到本地

## Goal

消除 prompt-capture 中「UTC / 本地时区」混用导致的日期归属错位。用户在 UTC+8,凌晨提交的 prompt 会被提交矩阵和「今日 Prompt」算到前一天,而 jsonl 文件名却落到今天。统一到**本地时区**,让「今天」「提交矩阵」「日历筛选」「jsonl 文件名」四者口径一致。

## Background（当前三套口径）

- ingest 端 jsonl 文件名:`capture/project.ts#localDate` —— **已用本地时区**(`getFullYear/getMonth/getDate`)。✓ 保留。
- 前端 `app.js`:`todayKey()`(L618)、`dateKey()`(L614)、`recentDateKeys()`(L588) —— 用 `toISOString()`(UTC)。
- 服务端过滤 `sqlite.ts#listEvents`:`event.capturedAt.startsWith(filter.date)` —— `capturedAt` 是 UTC ISO,`filter.date` 来自前端(当前是 UTC key),口径同为 UTC,但与 ingest 的本地文件名不一致。
- 显示 `formatDate()` —— 本地 `zh-CN`(保持)。

结果:UTC+8 凌晨 01:30 提交(`capturedAt` = 前一日 17:30Z),矩阵归到昨天、statToday=0,而 jsonl 落在今天。

## Requirements

1. **前端统一本地归属**:`todayKey()`、`dateKey(value)`、`recentDateKeys()` 改为按本地时区年月日生成 `YYYY-MM-DD`(用 `getFullYear/getMonth/getDate`,与 `localDate` 同口径)。
2. **服务端过滤统一本地归属**:`listEvents` 的 `date` 过滤不能再 `startsWith`(UTC ISO 不匹配本地日期)。改为:对每条事件用本地日期键(`localDateKey(capturedAt)`)与 `filter.date` 比较。
   - 后端复用/新增与 `capture/project.ts#localDate` 等价的本地日期键逻辑(避免循环依赖;可在 `storage` 或 `capture` 内提供,服务端调用)。
3. **提交矩阵 / 日历 / statToday**:在前端改本地口径后自然一致;确认 `renderActivityMatrix`、`renderDateControl`、`countPromptsByDate`、`renderStats` 均走新的 `dateKey`。
4. **不改**:`localDate`(ingest jsonl 命名)、`formatDate`(本地显示)、事件 `capturedAt`(仍是 UTC ISO 真值)、`redact` 等无关路径。
5. 不引入新依赖;不引入时区库。

## Acceptance Criteria

- [ ] 构造 `capturedAt = <本地今天 00:30 对应的 UTC ISO>`,断言:`dateKey(capturedAt)` === `todayKey()`(本地今天)。
- [ ] `statToday` 把该事件计入本地今天(而非 UTC 的昨天)。
- [ ] 提交矩阵把该事件归到本地今天的那一格。
- [ ] 日历选中本地今天时,`listEvents({date: 本地今天})` 返回该事件。
- [ ] 该事件 ingest 后,`localDate(capturedAt)` 的 jsonl 文件名 = 本地今天,与矩阵/日历口径一致。
- [ ] UTC 时区(将 TZ=UTC 跑测试)下行为自洽,不抛错。
- [ ] `npm run typecheck && npm test && npm run build` 全绿;既有用例无回归。

## Notes

- 前后端各自维护一份「本地日期键」函数(JS / TS 不共享代码);口径必须与 `capture/project.ts#localDate` 严格一致。
- 跨时区同步不是本轮目标;若未来要多人/云同步,再整体迁 UTC(届时会推翻本决策,但当前个人本地工具优先直观)。
