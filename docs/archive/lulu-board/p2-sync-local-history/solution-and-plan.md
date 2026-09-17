# 本机 History 一次性同步到云端

只做这一次上传。不删除本机文件。

## 锁定

✅ Verified（本对话，2026-09-17）：

| 项 | 选择 |
|---|---|
| 账号 | 当前浏览器已登录的 Supabase 用户 |
| 范围 | `~/.cache/board/history/*.bmd` |
| 同 ID | 保留 version 更高的一份 |
| 鉴权 | 用户 JWT，不用 service key |
| 本机文件 | 不删除 |

## 方案

✅ Verified（本机扫描）：92 个 `.bmd`，88 个不重复 `b_…`。

✅ Verified（浏览器标签 `https://luluboard.app/#b:b_6f06989c`）：已登录，可见 Save to cloud。

⚠️ Inferred：用该会话的 access token 对 `boards` 做 upsert，`owner_id` 为 `auth.uid()`。

## 计划

1. 按 `board_id` 去重，取最高 version。
2. 用浏览器会话调用 Supabase REST upsert。
3. 报告成功 / 失败数。
4. 不改产品代码，不删本机 History。
