# 账号栏视觉

右侧拆成两列：保存是动作，账号是身份。Sign out 进账号菜单。

## 锁定

✅ Verified（本对话，2026-09-17）：

| 项 | 选择 |
|---|---|
| 头像 | 用 OAuth `avatar_url` / `picture`，失败则首字母 |
| Sign out | 点账户名弹出菜单 |
| Save to cloud | 单独一列，不进菜单 |
| 未登录 | Sign in 仍弹出 Google / GitHub |

## 方案

✅ Verified（`index.html`）：账号名、Save、Sign out 现在并排。

✅ Verified（`index.html` CSP）：`img-src` 只有 `'self' data: blob:`，Google / GitHub 头像会被挡住。

要给 `https://*.googleusercontent.com` 和 `https://avatars.githubusercontent.com` 开口。

## 计划

1. 账号改成头像 + 名的按钮，菜单里放邮箱和 Sign out。
2. Save to cloud 留在账号左侧单独一列。
3. 统一高度、描边、菜单样式。
4. 补测试；本地看登录态外观。
