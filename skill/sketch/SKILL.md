---
name: sketch
description: Draw one Sketch on the public viewer.
argument-hint: "[picture intent]"
---

# sketch

Write one Sketch source and open it on the public viewer.
Done when the returned short `url` is shown.

## Script Macros

| Macro | CLI |
|---|---|
| `$SKETCH_CTL` | `python3 scripts/sketch_control.py` |

## Source

Three lines. Payloads have no braces.

1. First line is `sketch ""`. The quotes hold the title. Leave them empty when there is no title.
2. `style`, then one base64 token, is the camera and theme. On an update, leave that line unchanged. Omit it when minting.
3. `content`, then one base64 token, is the fragment.

## Fragment

The fragment is the picture.

1. Contains `<style>` and markup.
2. Excludes `<!doctype>`, `<html>`, `<head>`, and `<body>`.

## Render Environment

The viewer mounts the fragment in its own document. Write for this environment.

1. The fragment renders in a sandboxed `iframe`. Board's CSS, variables, and fonts do not reach it. Its CSS does not reach Board.
2. Board supplies `html` and `body` with zero margin and a transparent background. `:root`, `html`, and `body` selectors act on that document.
3. Sketch does not run scripts. `on*` attributes and `javascript:` URLs do nothing. The picture is static.
4. The frame takes no pointer input. The canvas pans and zooms over it. Buttons, inputs, and links draw as pictures with no hover or click.
5. No network. Put every style, shape, and glyph in the fragment.
6. The frame width follows the canvas. A root wider than the canvas widens the frame. The frame height fits the content. Give the root element an explicit width for a stable picture.

## Show

1. Pipe the source to `$SKETCH_CTL preview --kind sketch`, or pass `--file`.
2. Show only the CLI stdout `url` and stop.
3. To change, edit the source and preview again. That creates a new short url.
4. To keep, use `#b:`.
