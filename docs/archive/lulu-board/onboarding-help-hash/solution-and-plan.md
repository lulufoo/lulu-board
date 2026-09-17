# Onboarding 进网站并接「？」

把入门板从 skill 挪到 Drawer 资源，右侧栏「？」编成 `#z:` 打开。`demo.bmd` 留给 AI。

## 锁定

✅ Verified（本对话，用户「是的，执行吧」，2026-09-17）：

| 项 | 选择 |
|---|---|
| 源文件 | `packages/drawer-app/onboarding.bmd` |
| AI 例子 | 保留 `skill/board/templates/demo.bmd` |
| 入口 | 右侧 dock 栏底「？」 |
| 打开方式 | `fetch` 后 `encodeBoardHash`，hash 设为 `#z:` |
| `examples/` | 仍作 README 预览，不再打进 `skill/board/templates/board/` |

## 方案

✅ Verified（`scripts/web-build/build.mjs`）：网站构建不拷 `skill/`。

✅ Verified（`scripts/drawer-app-build/build.mjs`）：`packages/drawer-app/brand/` 的 favicon 会进 `.cache/web/`。

✅ Verified（`scripts/board-build/build.mjs`）：构建会跑 `examples-templates-build`，把 `examples/board-*` 打回 `skill/board/templates/board/`。

✅ Verified（`packages/drawer-app/js/00-hash-persist.js`、`02-board.js`）：`#z:` 由 `encodeBoardHash` 生成，`hashchange` 走 `bootstrapBoardFromHash`。

⚠️ Inferred：不跑 packer，已删的 android-mvi / llm 模板才不会在构建时回来。

## 计划

1. 把 `skill/board/templates/onboarding.bmd` 挪到 `packages/drawer-app/onboarding.bmd`。
2. `drawer-app-build` / `web-build` 拷到 `.cache/web/onboarding.bmd`。
3. `board-build` 不再调用 `examples-templates-build`。
4. dock 栏底加「？」；hash persist 下点击加载该文件。
5. 测试改指向新路径；skill 里的 seed 在 `templates/board` 为空时不再种板。
