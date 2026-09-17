# 世界坐标 + 相机

组件坐标即世界坐标（负值合法），画布是零尺寸锚点，连线 SVG 不裁剪；视口只记「舞台中心对准的世界点 + 缩放」。

## 问题

✅ Verified（本对话，2026-09-17，`Link 链接路径算法` 板）：`pin ASK.top to parent.top -158` 后，ASK 落在 y<0；`.board-canvas` 与连线 SVG 以 `0 0 W H` 为 viewBox，负坐标区域被裁掉；PNG 导出以 `.board-render` 尺寸取景，同样丢掉 ASK 与其连线。

## 锁定

✅ Verified（本对话，用户确认「可行，按照你的方案执行」）：

| 项 | 选择 |
|---|---|
| 组件坐标 | 相对世界原点，`pin` 值直读，四象限合法 |
| 舞台（世界层） | `.board-canvas` 零尺寸锚点，子节点 `left/top` 即世界坐标 |
| 连线层 | SVG 固定 `viewBox="0 0 1 1"`、1×1、`overflow: visible`，路径直接用世界坐标 |
| 相机 | `{ scale, cx, cy }`：舞台中心对准的世界点 + 缩放 |
| 拖动 / 缩放 | 只改相机，不改组件坐标；`+` / `−` / 滚轮绕舞台中心 |
| Fit / 导出 | `worldBounds(root)` = 顶层节点 ∪ 连线 bbox |
| 旧 `viewport {x,y}` | 视为无相机 → 打开时 Fit 一次 |
| 布局求解器 | 不动 |
| 灰色网格 | 舞台背景，不随相机变化（保持现状） |

## 方案

✅ Verified（`board-render.js` 1756/1773/1795-1797/1998-2007）：现状把 root/canvas 设为 `result.width×height`，SVG `viewBox 0 0 W H`，`drawEdges` 用 `c.width / layoutWidth` 推缩放。改为：

- `applyLayout` 不再给 root/canvas 定尺寸；canvas 固定 `0×0`。
- canvas 内放一个 100×100 隐藏探针 `.board-probe`，`drawEdges` 与拖拽用探针 rect 推出当前缩放与原点屏幕位置。
- `drawEdges` 不再改 viewBox；节点 rect 换算为 `(rr - canvasRect) / scale` 即世界坐标。
- 新增 `BoardRender.worldBounds(root)`：canvas 直接子节点 `[data-board-id]` 的 `style.left/top` + `offsetWidth/Height`，并上 `svg.getBBox()`。
- ✅ Verified（浏览器复核，2026-09-17）：应用 CSP 拦截 `setAttribute('style', …)` 字符串，旧 SVG 的 `overflow:visible` 从未生效（这就是负坐标被裁的直接原因）；探针与 SVG 一律用 CSSOM 属性赋值。

✅ Verified（`00-canvas-view.js`、`01-shell-state.js`、`07-chrome-boot.js`）：现状以 `.board-render` 屏幕矩形量图心，`viewport {scale,x,y}` 存的是 pan 像素。改为：

- 纯函数 `cameraToPan(cam, stage, origin)` / `panToCamera(pan, scale, stage, origin)`，`origin` 为世界原点相对 `#preview` 的布局偏移（root padding）。
- `setCanvasZoom(next)`：读相机 → 改 scale → 回写 pan（舞台中心不动）。
- `fitBoardView`：`worldBounds` → `scale = clamp(min(1, (stageW-pad)/w, (stageH-pad)/h))`，相机对准 bounds 中心。
- `snapshotDocumentView` / `applyDocumentView` 走相机；`authoredViewport` 只认 `{scale,cx,cy}`。

✅ Verified（`02-board.js` `boardCanvasPoint`）：现状 `canvas.clientWidth / rect.width`，零尺寸后为 NaN。改为探针缩放：`(client - canvasRect) / scale`。

✅ Verified（`05-export-png.js`）：现状按 `.board-render` 的 `clientWidth/Height` 取景 + 64px bleed。改为 `worldBounds` 取景，克隆时把 canvas 平移 `(pad - minX, pad - minY)`，保留墨迹裁切与网格。

## 计划

1. 引擎：零尺寸 canvas、探针、SVG 固定 viewBox、`worldBounds`。
2. 应用：相机纯函数、缩放 / Fit / 持久化 / 拖拽点换算。
3. 导出：`worldBounds` 取景。
4. 测试：改 `canvas-view`、`style-base64`；新增 `world-camera` 纯函数与源码约束测试。
5. 浏览器复核：ASK 板连线完整、拖动与缩放不改坐标、PNG 含 ASK。
