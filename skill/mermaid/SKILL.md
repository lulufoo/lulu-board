---
name: mermaid
description: List Mermaid types, or draw an open catalog type and open it on the public viewer.
argument-hint: "[list | <topic or type>]"
---

# mermaid

List the catalog, or author an open catalog type and open it on the public viewer.
Done when the list is shown, a tool `url` is shown, or chat-only source is
delivered.

## Syntax

Author Mermaid 12.1.0 built-in syntax. Drawer renders flowchart with Pele 1.7.0
and mindmap with a custom SVG pipeline, not Mermaid.js.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

## References

Load only what the current interface needs.

1. **list** — load [catalog](./references/catalog.md) only.
2. **route** — after an **open** type is chosen, load that one file from catalog.
3. Load [viewer](./references/viewer.md) for CLI `status` or preview kind.

## Interfaces

Two entries. Do not author during list.

1. **list** — slash `list`, or the ask is which types exist. Load catalog.
   Show the class table, including Open. Stop.
2. **route** — any draw ask. Pick exactly one catalog type. If it is not
   open, say it is not open, then stop. If it is open, load only that file.
   Author. Preview.

## Route

The catalog is the type boundary. **Open** is `flowchart` (`flowchart` /
`graph`), `mindmap`, and the Design group (`sequence`, `class`, `state`,
`er`, `requirement`, `c4`, `usecase`, `eventmodeling`, `railroad`).
`flowchart-elk` is the flowchart type.

1. A named type or alias wins.
2. Else pick the type that matches what must be visible.
3. Two fit → pick one; do not stop to ask.
4. None fit → ask one line, then stop.
5. A closed type → say it is not open, then stop. Do not author.
6. Source already in hand and the ask is preview → drawer only.

## Author

What to write, after the open type file is loaded.

1. Use one sample in that file (minimal default). Flowchart: one edge-meaning
   category. Mindmap: one root, indented branches. Design: Pele preview;
   Title and Source.
2. Replace labels; keep the sample's node and edge kinds.
3. Prefer ≤ ~12 primary elements unless the user asked for more.
4. Mint without `%% style`. On update, leave those lines unchanged.

## Mode

Pick hash or cloud.

1. If the `whoami` MCP tool is listed, use **cloud mode**. Load [cloud](../references/cloud.md).
2. If it is missing, use **hash mode**. Do not mention MCP.
3. If `whoami` is listed but a tool call fails, stop and report. Do not fall back.
4. If the user pastes a viewer URL in hash mode, load [pointers](../references/pointers.md).

## Hash flow

Publish unsigned.

1. Use the public viewer unless the user explicitly requests chat-only output.
2. After any preview, Keep `url` first, then `open`. Show the URL and stop.
3. No scene to draw (and not an update): run `$DRAWER_CTL preview --kind flowchart`,
   `$DRAWER_CTL preview --kind mindmap`, or `$DRAWER_CTL preview --kind sequence`
   with no `--file` and no stdin body.
4. For an update, edit this session’s last Source text. If none yet, run
   step 3 first.
5. For the public viewer, run `$DRAWER_CTL preview --kind flowchart`,
   `$DRAWER_CTL preview --kind mindmap`, or `$DRAWER_CTL preview --kind sequence`
   (and the other Design kinds) with stdin or `--file`. If it reports a DSL
   error, correct the Source and rerun.
6. For chat-only output, return one mermaid-fenced block and stop.

## Cloud flow

Publish owned.

Follow [cloud](../references/cloud.md). Chat-only: one mermaid-fenced block.

## Open wording

Say one line with the URL, from stdout `open` or MCP `url`:

| `open` | Say |
|---|---|
| `created` | The new diagram is now current. |
| `current` | This is the current diagram. |

## Boundaries

1. CLI stdout contract: `$DRAWER_CTL --help`.
2. CLI success or MCP write completes the skill; do not open the URL, drive
   the viewer, or screenshot the layout unless the user explicitly requests
   visual verification.
