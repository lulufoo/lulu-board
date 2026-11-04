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
| `$SKETCH_CTL` | `python3 scripts/sketch_control.py` |

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

1. Use **cloud mode** only when the `whoami` MCP tool is listed and one of these holds: the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams; the user pastes a `#b:` link; this session already created the diagram in cloud mode. Load [cloud](../references/cloud.md).
2. Otherwise use **short-link mode**.
3. If `whoami` is listed but a tool call fails, use **short-link mode**.
4. If the user pastes a viewer URL, load [pointers](../references/pointers.md).

## Short link flow

Publish unsigned.

1. Write the fragment to `.cache/sketch/<name>.html`. `<name>` is a short English name for the diagram.
2. Run `$SKETCH_CTL preview --html <file> --title <title>`. Always write a short title that names the diagram.
3. Show only the `url` field and stop.
4. To change, edit the HTML file and preview again. That creates a new short url.
5. To keep, use cloud mode (`#b:`).

## Cloud flow

Read and write cloud diagrams as SKT Source.

1. SKT Source has three lines: `sketch "<title>"`, `style`, and `content`. `content` is the encoded HTML. Only `$SKETCH_CTL encode` writes it and `$SKETCH_CTL decode` reads it.
2. New: write the HTML file as in the short link flow, run `$SKETCH_CTL encode --html <file> --title <title>`, and pass the text of the `skt` file it returns unchanged as `bmd` to `create_diagram`.
3. Read: `get_diagram`, write the returned `bmd` unchanged to `.cache/sketch/<name>.skt`, run `$SKETCH_CTL decode --skt <file>`, and edit the `html` file it returns.
4. Save: run `$SKETCH_CTL encode --html <html> --title <title> --style "<style>"` with the `title` and `style` that `decode` returned, and pass the text of the `skt` file it returns unchanged as `bmd` to `save_diagram`.
5. When `decode` returns an empty `title`, write a short title that names the diagram before `encode`.

## Boundaries

1. CLI contract: `$SKETCH_CTL --help`.
