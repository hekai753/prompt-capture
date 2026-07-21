# SW 缓存策略优化

## Goal

把 service worker 从 cache-first 改为 network-first(缓存兜底),使 UI 改动即时生效,不再每次都 bump `CACHE_NAME`。保留离线可用(PWA)。

## Requirements

1. fetch 策略:`/api/*` 不缓存(维持现状);静态资源(`/`、`/index.html`、`/app.js`、`/styles.css`、`/manifest.webmanifest`、`/icon.svg`)先走网络,网络失败/错误再回退缓存。
2. `install` 仍预缓存静态资源(离线兜底);`activate` 清旧版本缓存。
3. 移除「改 UI 必须 bump `CACHE_NAME`」的隐性依赖(网络优先自然取最新)。
4. 保留 PWA 离线能力:网络不可用时用缓存渲染。

## Acceptance Criteria

- [ ] 改 `app.js` / `styles.css` 后,**普通刷新**(无需 unregister SW、无需 bump `CACHE_NAME`)即取到最新版本。
- [ ] 离线(断网)时 UI 仍能从缓存加载。
- [ ] `/api/*` 不被缓存(数据始终实时)。
- [ ] `build` / `typecheck` 全绿;无 SW 注册报错。

## Notes

- network-first 对静态资源可能略增延迟(本地 `127.0.0.1` 可忽略)。
- 仍保留 `CACHE_NAME` 用于 `install` 预缓存与旧缓存清理;但不再随每次 UI 改动 bump。
