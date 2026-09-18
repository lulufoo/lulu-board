---
name: board
description: Create a structured visual board from a scene or system.
argument-hint: "[scene intent]"
---

# board

Define one diagram with the Board protocol and open it on the public viewer.
Done when preview returns `ok` with a `luluboard.app` URL and the matching
`open` line, or chat-only BMD Source is delivered.

## Identity

**BMD Source** is the `.bmd` body. The file has no identity. **BMD ID** (`b_…`)
is the cloud row on `#b:<id>`. `preview` encodes source plus client version `1`
into `#z:`.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

## References

Load the authoring contract before writing.

1. Keep this file at start.
2. Load [vocab](./references/vocab.md); it is the authoring contract.
3. Load [demo.bmd](./templates/demo.bmd) only when a complete example helps.
4. When using an icon, load [icons.json](./common/icons.json).
5. Load [viewer](./references/viewer.md) for `status` or the pointer protocol.

## Flow

1. Use the public viewer unless the user explicitly requests chat-only output.
2. No scene to draw (and not an update): run `$DRAWER_CTL preview --kind board`
   with no `--file` and no stdin body. Keep `url` first, then `open`. Show the
   URL and stop.
3. For an update, edit this session’s last BMD Source text. If none yet, run
   step 2 first.
4. Infer the scene and author one BMD Source string that follows vocab.
5. For the public viewer, run `$DRAWER_CTL preview --kind board` with stdin or
   `--file`. If it reports a DSL error, correct the BMD Source and rerun.
   Keep `url` first, then `open`. Show the URL and stop.
6. For chat-only output, return one `board`-fenced block and stop.

## Open wording

Say one line with the URL, from stdout `open`:

| `open` | Say |
|---|---|
| `created` | The new board is now current. |
| `current` | This is the current board. |

## Boundaries

stdout `url` is the public hash link (`https://luluboard.app/#z:…`). CLI
success completes the skill; do not open the URL, drive the viewer, or
screenshot the layout unless the user explicitly requests visual verification.
Mint without meta or style. On update, leave those lines unchanged.
`preview` does not write `~/.cache/board/history`.
