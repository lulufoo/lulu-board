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

1. First line is `sketch "<title>"`. The quotes hold the title. Always write a short title that names the diagram.
2. `style`, then one base64 token, is the camera and palette. On an update, leave that line unchanged. Omit it when minting.
3. `content`, then one base64 token, is the fragment.

## Fragment

The fragment is the picture.

1. Contains `<style>` and markup.
2. Excludes `<!doctype>`, `<html>`, `<head>`, and `<body>`.
3. Excludes `<iframe>`, `<object>`, `<embed>`, and `<link>`. Board removes them before mounting. Put CSS in `<style>`.

## Render Environment

The viewer mounts the fragment in its own document. Write for this environment.

1. The fragment renders in a sandboxed `iframe`. Board's CSS, variables, and fonts do not reach it. Its CSS does not reach Board.
2. Board supplies `html` and `body` with zero margin and a transparent background. `:root`, `html`, and `body` selectors act on that document.
3. Scripts run when the sketch mounts, inside the sandbox. They cannot reach Board's page, storage, or cookies. `fetch`, `XMLHttpRequest`, and `WebSocket` are blocked. Use a script to build the picture.
4. The frame takes no pointer input. The canvas pans and zooms over it. Buttons, inputs, and links draw as pictures with no hover or click. Scripts get no pointer events, so click handlers and `:hover` do nothing.
5. No network. Put every style, shape, glyph, and script in the fragment.
6. The frame width follows the canvas. A root wider than the canvas widens the frame. The frame height fits the content. Give the root element an explicit width for a stable picture.

## Performance

The frame is resized by its content and exported as one still image. Write for that.

1. Draw a still picture. Add animation only when the user asks for it.
2. Animate only `transform` and `opacity`. A change in size resizes the frame on every step.
3. Avoid `filter`, `backdrop-filter`, and large blurred shadows. They are slow to paint.
4. Run no endless loop. Keep script work short: the viewer gives up when the sketch does not report a size in time.
5. Keep the element count low.

## Show

1. Pipe the source to `$SKETCH_CTL preview --kind sketch`, or pass `--file`.
2. Show only the CLI stdout `url` and stop.
3. To change, edit the source and preview again. That creates a new short url.
4. To keep, use `#b:`.
