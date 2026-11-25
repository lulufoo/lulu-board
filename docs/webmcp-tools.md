# Board WebMCP — Chrome verification and tool contract

## 首票完成回执与实现契约 · 2026-11-25

普通 Chrome 已有标签页原生链路通过。环境为 Chrome 158.0.8127.37、chrome-devtools-mcp 1.14.0、MCP SDK 1.29.0；用户启用 Remote Debugging 和 WebMCP testing 后，实测 API 为 document.modelContext。连接使用 --autoConnect --categoryExperimentalWebmcp=true，仅允许本地探针 http://127.0.0.1:48761/*，关闭统计与不需要的工具类别；验证后已断开临时 MCP 连接。

本地页先在用户的普通 Chrome 中打开，MCP 随后发现并调用该既有页面。调用走官方 list_webmcp_tools / execute_webmcp_tool，没有用直接页面脚本代替验收。

实测记录：

- 发现 get_current_diagram 和 update_current_diagram 两个原生工具。
- 读取 r1；提交 r1 后，同页显示 Native WebMCP edit，修订变为 r2；原生读回确认。
- 人连续编辑两次后修订为 r4；提交旧 r2 返回 STALE_REVISION，错误 ID 返回 DIAGRAM_MISMATCH。
- AbortController.abort 后发现列表为空，旧工具名不可调用；重注册后恢复两项，读回 r4 和人改动。
- 探针没有登录与云保存。实际 Board 和云端验收仍由 LB-764 / LB-766 承担。

### 后续工具契约

**get_current_diagram**

输入 { diagram_id: string }，ID 必填，仅允许当前真正已加载图。

成功返回 { ok: true, diagram_id, kind, source, revision, save_status }。source 为页面完整 Source，包含尚未保存修改。revision 为页面内 opaque string，不使用会话凭据或仅云端版本，不写入图或浏览器存储。

**update_current_diagram**

输入 { diagram_id: string, expected_revision: string, source: string }，三项必填。

成功返回 { ok: true, diagram_id, revision, save_status }。先校验当前目标、页面修订和有效源码，再整份更新与同页渲染。自动保存结果如实表示为 saved / saving / error / conflict；不能把排队保存说成已保存。

可预期拒绝返回 { ok: false, code, message }，code 至少区分 NOT_AVAILABLE、TARGET_NOT_READY、DIAGRAM_MISMATCH、STALE_REVISION、INVALID_SOURCE、SAVE_FAILED、CLOUD_CONFLICT。若画布已经改变而云保存失败，须明确实际状态，不伪装为未发生修改。

覆盖现有可渲染 kind：boxes、sketch、flowchart、mindmap、sequence、class、state、er、requirement、c4、usecase、eventmodeling、railroad。现有渲染器拒绝的 Mermaid 类型不因此新增支持。

先同步恢复浏览器开关再决定注册；撤下注册不等于终止已进入 execute 的回调，实际写入前仍检查适用状态、ID与修订。读取 Source 视为不可信文档内容，不返回登录凭据。

证据产物位于 .cache/webmcp/：probe.html、bridge.mjs、evidence.jsonl、native-probe.jpg。

[Chrome API 与在途调用语义](https://developer.chrome.com/docs/ai/webmcp/imperative-api) · [官方原生工具参考](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md#webmcp)
