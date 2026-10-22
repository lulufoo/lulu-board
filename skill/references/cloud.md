# Cloud

Shared MCP flow for Board and Mermaid. Load when `whoami` is listed.

`diagram_id` is only the bare id (`b_` plus 8 lowercase hex). The return always
includes `diagram_id` and `url`. Show `url`. Do not build the host.

1. Call `whoami` and remember the email.
2. New: author Source → `create_diagram`. Pass the Source as `bmd`. Optional
   `diagram_id`. `group_id` is the group this `diagram_id` belongs to. Optional
   `group_id` joins that group on the current account. Omit `group_id` to create a new group. Show the returned `url`.
3. Update: `get_diagram` for this session’s last `diagram_id`, or the `diagram_id`
   taken from a pasted `#b:` link ([pointers](./pointers.md)). Edit `bmd`.
   `save_diagram` with that `version`. Show `row.url`.
4. On `conflict`, redo the edit on the returned row and save once. Still
   conflict: stop and show both versions.
5. Chat-only: fence the Source; do not write cloud.
