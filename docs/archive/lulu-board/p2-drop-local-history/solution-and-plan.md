# 停用本机 History 写入

只停产品功能，不删除已有缓存文件。

## 锁定

✅ Verified（本对话，2026-09-17）：

| 项 | 选择 |
|---|---|
| CLI `preview` | 只打开 `luluboard.app` 的 `#z:`，不再写入 `history/` |
| 空 `preview` | 打开站点，不 seed 模板 |
| 已有文件 | 不删除 `~/.cache/board/history` |
| Open File hint | 去掉 `Local history: ~/.cache/board/history` |
| `get-source` | 仍可读残留文件，找不到则失败 |

## 方案

✅ Verified（`skill/board/scripts/drawer_ctl/commands.py`）：`preview` 在内存里补 envelope 并编码 `#z:`，不调用 seed / commit。

✅ Verified（`packages/drawer-app/index.html`、`06-cloud-sync.js`）：Open File 的 title 仍提示本机 History 路径。

⚠️ Inferred：更新板时，对话里保留上次 BMD；`get-source` 只用于残留缓存。

## 计划

1. `preview` 在内存里补 `meta` envelope，编码 `#z:`，不调用 seed / commit。
2. 无正文时打开 `https://luluboard.app/`，不读、不写本机 current。
3. `--id` 且无正文时只读残留文件；不写回。
4. Open File hint 改为不含路径的短句。
5. 更新 SKILL / viewer / skill README 与测试。
6. 不添加任何删除 `~/.cache/board/history` 的步骤。
