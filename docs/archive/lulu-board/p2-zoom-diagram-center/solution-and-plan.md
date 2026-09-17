# 以图中心放大

`+` / `−` / 滚轮绕 `.board-render` 中心改 scale。Fit 与百分比按钮仍居中整图。

## 锁定

✅ Verified（本对话，2026-09-17）：

| 项 | 选择 |
|---|---|
| 原点 | 先量图中心，再改 scale 并补偿 pan |
| 手势 | `+` / `−` / 滚轮 |
| Fit / 百分比 | 不改，仍 `fitBoardView` |
| 无图 | 只改 scale，与现在相同 |

## 方案

✅ Verified（`07-chrome-boot.js`）：放大只写 `scale`，`transform-origin: 0 0`，图往右下长。

✅ Verified（`00-canvas-view.js`）：已能量图相对舞台的左上角。

公式：`pan' = C - (C - pan) * (next / prev)`，C 为图中心相对舞台的坐标。

## 计划

1. 增加量中心与补偿 pan。
2. `+` / `−` / 滚轮走补偿。
3. 测公式；Fit 路径不改。
