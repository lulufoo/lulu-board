---
name: sketch
description: Draw one Sketch on the public viewer.
argument-hint: "[diagram intent]"
---

# sketch

Write one Sketch as an HTML file and publish it on the public viewer.
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

## Template

Write from the template.

1. Load [template.md](./references/template.md) and write from it.

## Render Environment

The viewer mounts the fragment in its own document. Write for this environment.

1. The fragment renders in a sandboxed `iframe`. Board and the fragment cannot reach each other's CSS or scripts. Scripts run when the sketch mounts.
2. `:root`, `html`, and `body` selectors act on that document (zero margin, transparent). A `body` background paints the diagram only; an `html` background is ignored.
3. The frame takes no pointer input by default, so `:hover` and drag do nothing. A sketch may use click handlers. The canvas pans and zooms over it.
4. No network. Put every style, shape, glyph, and script in the fragment.

## Performance

The frame is resized by its content and exported as one still image. Write for that.

1. Draw a still diagram. Add animation only when the user asks for it.
2. Animate only `transform` and `opacity`. A change in size resizes the frame on every step.
3. Avoid `filter`, `backdrop-filter`, and large blurred shadows. They are slow to paint.
4. Run no endless loop. Keep script work short: the viewer gives up when the sketch does not report a size in time.
5. Keep the element count low.

## Mode

Pick short link or cloud. Short link is the default.

1. Use **cloud mode** only when one of these holds: the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams; the user pastes a `#b:` link; this session already created the diagram in cloud mode. Load [cloud flow](./references/cloud-flow.md).
2. Otherwise use **short-link mode**.
3. If `login` fails or times out, use **short-link mode** and tell the user why.
4. If the user pastes a viewer URL, load [pointers](../references/pointers.md).

## Short link flow

Publish unsigned.

1. Write the fragment to `.cache/sketch/<name>.html`. `<name>` is a short English name for the diagram.
2. Run `$BOARD_CLI encode-source --file <file> --out .cache/sketch --title <title>`. Always write a short title that names the diagram.
3. Run `$BOARD_CLI preview-diagram --file <skt>`, where `<skt>` is the `file` that `encode-source` returned.
4. Show only the `url` field and stop.
5. To change, edit the HTML file and publish again. That creates a new short url.
6. To keep, use cloud mode (`#b:`).

## Boundaries

1. CLI contract: `$BOARD_CLI --help`.
