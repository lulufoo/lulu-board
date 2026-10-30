# Cloud

Shared MCP flow for Board and Mermaid. Load when `whoami` is listed.

`diagram_id` is only the bare id (`b_` plus 8 lowercase hex). Diagram tools
return `diagram_id` and `url`. `get_group` returns `group_id` and `members`.
`search_diagrams` returns `diagram_id`, `title`, and `url`.
Show `url` when present.

1. Call `whoami` and remember the email. If the call fails, leave this file.
2. New: author Source → `create_diagram`. Pass the Source as `bmd`. Optional
   `diagram_id`. `group_id` is the group this `diagram_id` belongs to. Optional
   `group_id` joins that group on the current account. Omit `group_id` to create a new group. Show the returned `url`.
3. Same group as a pasted `#b:`: `get_group` with that `diagram_id`. Pass the
   returned `group_id` to `create_diagram`. Do not `get_diagram` only to join a
   group.
4. Update: `get_diagram` for this session’s last `diagram_id`, or the `diagram_id`
   taken from a pasted `#b:` link ([pointers](./pointers.md)). Edit `bmd`.
   `save_diagram` with that `version`. Show `row.url`.
5. Search owned: `search_diagrams` with a non-empty `query`. Hits are
   `diagram_id`, `title`, and `url`. To load Source, `get_diagram`.
6. On `conflict`, redo the edit on the returned row and save once. Still
   conflict: stop and show both versions.
