# P1 前端交互(键盘导航 / debounce / URL 同步)

## Goal

让「翻归档 + 搜」这两个最高频动作变快:键盘翻列表、搜索不卡顿、筛选状态可分享/书签。

## Requirements

1. **键盘导航**
   - `j` / `↓`、`k` / `↑`:在事件列表上下移动选中;**选中即加载 detail**(不必再点)。
   - `/`:聚焦搜索框。
   - `Esc`:日期选择器/配置弹窗开着则关闭;否则不处理(保留既有 Esc 行为)。
   - 仅在未聚焦 input/textarea/select 时触发导航键,避免与输入冲突。
2. **搜索 debounce**:输入后 ~200ms 再触发 `loadEvents`(现在每次 `input` 即触发);命中关键词在 snippet 里高亮。
3. **URL 同步筛选**:`project` / `date` / `source` / `kind` / `q` 写入 `location.search`;页面加载从 query 恢复;前进/后退/刷新/书签保持筛选;localStorage 降级为 fallback。

## Acceptance Criteria

- [ ] 未聚焦输入时 `j`/`k`(或 ↑/↓)上下移动选中并自动加载对应 detail。
- [ ] `/` 聚焦搜索框;输入框聚焦时 `j`/`k` 不触发导航。
- [ ] 连续快速输入搜索词,`loadEvents` 仅在停顿后发一次(可由请求计数验证)。
- [ ] 搜索词在事件 snippet 中以高亮标记出现。
- [ ] 设筛选后 URL 含对应 query;复制 URL 到新标签恢复同样筛选;浏览器后退键回到上一筛选。
- [ ] `typecheck && test && build` 全绿;既有交互无回归。

## Notes

- 选中即加载 detail 会增加 conversation/related 请求:键盘连续移动时对相邻事件做轻量节流(如 100ms 内只加载最后选中项),避免狂打 API。
- URL 同步用 `history.pushState`(每次筛选变化推一条历史,支持后退),加载时从 query 恢复到控件 + state。
