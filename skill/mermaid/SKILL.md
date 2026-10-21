---
name: mermaid
description: List Mermaid types, or draw a flowchart and open it on the public viewer.
argument-hint: "[list | <topic or type>]"
---

# mermaid

List the catalog, or author one open type and open it on the public viewer.
Done when the list is shown, a `preview.luluvela.app` URL is shown — `#z:` from
preview, or `#b:` from MCP — or chat-only source is delivered.

## Identity

**Source** is the Mermaid body. The file has no identity. **Vela ID** (`b_…`)
is the cloud row on `#b:<id>`. `preview` encodes source plus client version `1`
into `#z:`. Cloud mode mints `#b:` through MCP. The MCP string field is `bmd`.

## Syntax

Author Mermaid 12.1.0 built-in syntax. Drawer renders with Pele 1.7.0, not
Mermaid.js.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

## References

Load only what the current interface needs.

1. Keep this file at start.
2. **list** — load [catalog](./references/catalog.md) only.
3. **route** — after an **open** type is chosen, load that one file from catalog.
4. Load [viewer](./references/viewer.md) for `status` or the pointer protocol.

## Interfaces

Two entries. Do not author during list.

1. **list** — slash `list`, or the ask is which types exist. Load catalog.
   Show the class table, including Open. Stop.
2. **route** — any draw ask. Pick exactly one catalog type. If it is not
   open, say it is not open, then stop. If it is open, load only that file.
   Author. Preview.

## Route

The catalog is the type boundary. **Open** is only `flowchart` (`flowchart` /
`graph`). `flowchart-elk` is that same type.

1. A named type or alias wins.
2. Else pick the type that matches what must be visible.
3. Two fit → pick one; do not stop to ask.
4. None fit → ask one line, then stop.
5. A closed type → say it is not open, then stop. Do not author.
6. Source already in hand and the ask is preview → drawer only.

## Author

After the open type file is loaded.

1. Use one sample in that file (minimal default). Flowchart: one edge-meaning
   category.
2. Replace labels; keep the sample's node and edge kinds.
3. Prefer ≤ ~12 primary elements unless the user asked for more.
4. Hash and cloud write-back follow Mode / Hash flow / Cloud flow.

## Mode

1. If the `whoami` MCP tool is listed, use **cloud mode**.
2. If it is missing, use **hash mode**. Do not mention MCP.
3. If `whoami` is listed but a tool call fails, stop and report. Do not fall back.
4. If the user pastes `#b:` or `#s:` while hash mode is on, say: connect MCP to
   open the cloud diagram, or paste the Source.

## Hash flow

1. Use the public viewer unless the user explicitly requests chat-only output.
2. No scene to draw (and not an update): run `$DRAWER_CTL preview --kind flowchart`
   with no `--file` and no stdin body. Keep `url` first, then `open`. Show the
   URL and stop.
3. For an update, edit this session’s last Source text. If none yet, run
   step 2 first.
4. Infer the scene and author one Source string that follows the type file.
5. For the public viewer, run `$DRAWER_CTL preview --kind flowchart` with stdin
   or `--file`. If it reports a DSL error, correct the Source and rerun.
   Keep `url` first, then `open`. Show the URL and stop.
6. For chat-only output, return one mermaid-fenced block and stop.

## Cloud flow

1. Call `whoami` and remember the email.
2. New Vela: author Source → `create_vela`. Pass the Source as `bmd`.
   `group_id` is the group this `vela_id` belongs to. Optional `group_id`
   joins that group on the current account. Omit `group_id` to create a new
   group. Show `https://preview.luluvela.app/#b:<id>` for that account.
3. Update: `get_vela` for this session’s last `vela_id`, or a `#b:` the user
   pasted → edit the returned `bmd` → `save_vela` with that `version`.
4. On `conflict`, redo the edit on the returned row and save once. Still
   conflict: stop and show both versions.
5. Chat-only: one mermaid-fenced block; do not write cloud.

## Open wording

Say one line with the URL, from stdout `open` in hash mode, or after MCP write:

| `open` | Say |
|---|---|
| `created` | The new diagram is now current. |
| `current` | This is the current diagram. |

## Boundaries

1. Types come from catalog only. Do not invent a diagram kind.
2. Only open types may be authored for the drawer.
3. Samples stay in `references/`. Do not copy them here.
4. Preview rules live in [viewer](./references/viewer.md).
5. stdout `url` is the public hash link (`https://preview.luluvela.app/#z:…`). Cloud
   mode shows `#b:<id>` instead. CLI success or MCP write completes the skill;
   do not open the URL, drive the viewer, or screenshot the layout unless the
   user explicitly requests visual verification.
6. Mint without `%% meta` or `%% style`. On update, leave those lines unchanged.
7. `preview` does not write local history.
