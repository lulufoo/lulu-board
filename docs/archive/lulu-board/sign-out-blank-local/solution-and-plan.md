# 登出后落地成本地板

只修「登录打开 `#b:` 再退出」这一条。未登录直接打开 `#b:` 维持入口，不在本次改。

## 锁定

✅ Verified（本对话，用户回复 `A`，2026-09-17）：

| 项 | 选择 |
|---|---|
| 登出且当前是 `#b:` | 清 hash，种 Untitled，存成 `#z:` |
| 登出且当前不是 `#b:` | 不改 URL，不换板 |
| 未登录打开 `#b:` | 仍走现有入口，本次不改 |

## 方案

✅ Verified（`packages/drawer-app/js/06-cloud-sync.js` `cloudSignOut`）：登出后调用 `cloudClearOpenBoard()`，只把源清空，不改 hash。

✅ Verified（同文件 `deleteCloudBoard`）：删当前云板时用 `history.replaceState` 清 hash，再 `bootstrapBoardFromHash()`。

✅ Verified（`packages/drawer-app/js/02-board.js` `bootstrapBoardFromHash`）：hash 为空时种 Untitled，并 `saveBoardToHash()`。

✅ Verified（`packages/drawer-app/js/00-document-meta.js` `blankHashBoardSource`）：空板正文是 `board "Untitled"`。

⚠️ Inferred：登出落地复用删当前云板那三段，不另开路径。

## 计划

1. `cloudSignOut` 不再调用 `cloudClearOpenBoard`。
2. 当前 hash 是 `#b:` 时：`replaceState` 清 hash → `bootstrapBoardFromHash` → `renderBoard`。
3. 当前不是 `#b:` 时：只清会话 UI。
4. 测试锁住 `cloudSignOut` 走清 hash + bootstrap，不再清空源。
5. 不改 `loadCloudBoardByHash` 的未登录分支。
