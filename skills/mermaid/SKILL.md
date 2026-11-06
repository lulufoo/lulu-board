---
name: mermaid
description: List Mermaid types, or draw an open catalog type and open it on the public viewer.
argument-hint: "[list | <topic or type>]"
---

# mermaid

List the catalog, or author an open catalog type and open it on the public viewer.
Done when the list is shown, or a tool `url` is shown.

## Syntax

Author Mermaid 12.1.0 built-in syntax. Drawer renders flowchart with Pele 1.7.0
and mindmap with a custom SVG pipeline, not Mermaid.js.

## Script Macros

| Macro | CLI |
|---|---|
| `$BOARD_CLI` | `~/.local/bin/board-cli` |
| `$INSTALL_BOARD_CLI` | `mkdir -p ~/.local/bin && curl -fsSL https://github.com/lulufoo/lulu-board/releases/download/board-cli-v0.3.0/board-cli.pyz -o ~/.local/bin/board-cli && chmod +x ~/.local/bin/board-cli` |

## CLI

`$BOARD_CLI` is the installed `board-cli` program. Minimum version: `0.3.0`.

1. Before the first `$BOARD_CLI` call of a session, run `$BOARD_CLI --version`.
2. When the command is missing or its `version` is below the minimum, run `$INSTALL_BOARD_CLI`, then continue.

## References

Load only what the current interface needs.

1. **list** — load [catalog](./references/catalog.md) only.
2. **route** — after an **open** type is chosen, load that one file from catalog.

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
6. Source already in hand and the ask is to publish it → skip Author; run the Short link flow.

## Author

What to write, after the open type file is loaded.

1. Use one sample in that file (minimal default). Flowchart: one edge-meaning
   category. Mindmap: one root, indented branches. Design: Pele preview;
   Title and Source.
2. Replace labels; keep the sample's node and edge kinds.
3. Prefer ≤ ~12 primary elements unless the user asked for more.
4. Mint without `%% style`. On update, leave those lines unchanged.

## Mode

Pick short link or cloud. Short link is the default.

1. Use **cloud mode** only when one of these holds: the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams; the user pastes a `#b:` link; this session already created the diagram in cloud mode. Load [cloud](../references/cloud.md).
2. Otherwise use **short-link mode**.
3. If `login` fails or times out, use **short-link mode** and tell the user why.
4. If the user pastes a viewer URL, load [pointers](../references/pointers.md).

## Short link flow

Publish unsigned.

1. No scene to draw (and not an update): show `https://luluboard.app/` and stop.
2. Write the Source to `.cache/mermaid/<name>.mmd`. `<name>` is a short English name for the diagram.
3. Run `$BOARD_CLI preview-diagram --file <file>`.
4. Show only the `url` field and stop.
5. To change, edit the file and publish again. That creates a new short url.
6. To keep, use cloud mode (`#b:`).

## Open wording

Show the `url`. One line.

## Boundaries

1. CLI contract: `$BOARD_CLI --help`.
2. CLI success completes the skill; do not open the URL, drive the viewer, or
   screenshot the layout unless the user explicitly requests visual
   verification.
