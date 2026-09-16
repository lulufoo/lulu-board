---
name: board
description: Create a structured visual board from a scene or system.
argument-hint: "[scene intent]"
---

# board

Define one diagram with the Board protocol and render it with Drawer. Done when
preview returns `ok` with a URL and the matching `open` line, or chat-only
BMD Source is delivered.

## Identity

**BMD ID** (`b_…`) is which board. **BMD Source** is the `.bmd` body. `--id` is
BMD ID. Omit `--id` only to mint. `current` is the viewed pointer.

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
5. Load [viewer](./references/viewer.md) for `mount` / `status` / `stop` or the pointer protocol.

## Flow

1. Use Drawer unless the user explicitly requests chat-only output.
2. No scene to draw (and not an update): run `$DRAWER_CTL preview --kind board`
   with no `--file` and no stdin body. Keep `id` (BMD ID) first, then `open`
   and `url`. Show the URL and stop.
3. For an update, run `$DRAWER_CTL get-source --kind board --id <id>` and treat
   that BMD Source as the text to edit. `<id>` is the BMD ID from this session’s
   last preview or set-source. If none yet, run step 2 first and keep that BMD ID.
4. Infer the scene and author one BMD Source string that follows vocab.
5. For Drawer, run `$DRAWER_CTL preview --kind board --id <id>` with stdin or
   `--file` when updating that board. Omit `--id` only to mint a new board.
   If it reports a DSL error, correct the BMD Source and rerun. Keep the BMD
   ID from stdout, then `open` and `url`. Show the URL and stop.
6. For chat-only output, return one `board`-fenced block and stop.

## Open wording

Say one line with the URL, from stdout `open`:

| `open` | Say |
|---|---|
| `seeded` | First-run welcome: this is the built-in guide. |
| `created` | The new board is now current. |
| `current` | This is the current board. |

## Boundaries

The preview URL is user-facing output. CLI success completes the skill; do not
open the URL, drive Drawer, or screenshot the layout unless the user explicitly
requests visual verification. Mint without meta or style. On update, leave those
lines unchanged.
