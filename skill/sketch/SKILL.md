---
name: sketch
description: Draw one Sketch on the public viewer.
argument-hint: "[picture intent]"
---

# sketch

Write one Sketch source and open it on the public viewer.
Done when a tool `url` is shown.

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

1. Contains `<style>` and markup. No network.
2. Excludes `<!doctype>`, `<html>`, `<head>`, and `<body>`.
3. Sketch does not run scripts. Do not put a script in the fragment.

## Show

1. Pipe the source to `$SKETCH_CTL preview --kind sketch`, or pass `--file`.
2. Keep `url` first. Show the URL and stop.
