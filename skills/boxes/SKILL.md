---
name: boxes
description: Create a structured Boxes diagram from a scene or system.
argument-hint: "[scene intent]"
---

# boxes

Define one diagram with the boxes protocol and open it on the public viewer.
Done when a tool `url` is shown.

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

Load what the current write needs.

1. Run `$BOARD_CLI assets`. If it fails, stop and report.
2. Load vocab from `files["vocab.md"].path`.
3. Load [demo.bmd](./templates/demo.bmd) only when a complete example helps.
4. When using an icon, load `files["icons.json"].path`.

## Author

What to write.

1. **BMD Source** is the `.bmd` body. The file has no identity.
2. Author one BMD Source string that follows vocab.
3. Mint without style. On update, leave those lines unchanged.

## Mode

Pick short link or cloud. Short link is the default.

1. Use **cloud mode** only when one of these holds: the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams; the user pastes a `#b:` link; this session already created the diagram in cloud mode. Load [cloud](../references/cloud.md).
2. Otherwise use **short-link mode**.
3. If `login` fails or times out, use **short-link mode** and tell the user why.
4. If the user pastes a viewer URL, load [pointers](../references/pointers.md).

## Short link flow

Publish unsigned.

1. No scene to draw (and not an update): show `https://luluboard.app/` and stop.
2. Write the BMD Source to `.cache/boxes/<name>.bmd`. `<name>` is a short English name for the diagram.
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
