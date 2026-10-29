# Cloud

Shared MCP flow for Board and Mermaid. Load when `whoami` is listed.

`diagram_id` is only the bare id (`b_` plus 8 lowercase hex). Diagram tools
return `diagram_id` and `url`. `get_group` returns `group_id` and `members`.
Show `url` when present. Do not build the host.

1. Call `whoami` and remember the email.
2. New: author Source → `create_diagram`. Pass the Source as `bmd`. Optional
   `diagram_id`. `group_id` is the group this `diagram_id` belongs to. Optional
   `group_id` joins that group on the current account. Omit `group_id` to create a new group. Show the returned `url`.
3. Same group as a pasted `#b:`: `get_group` with that `diagram_id`. Pass the
   returned `group_id` to `create_diagram`. Do not `get_diagram` only to join a
   group.
4. Update: `get_diagram` for this session’s last `diagram_id`, or the `diagram_id`
   taken from a pasted `#b:` link ([pointers](./pointers.md)). Edit `bmd`.
   `save_diagram` with that `version`. Show `row.url`.
5. On `conflict`, redo the edit on the returned row and save once. Still
   conflict: stop and show both versions.
6. Chat-only: fence the Source; do not write cloud.
