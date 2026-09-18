---
name: board
description: Create a structured visual board from a scene or system.
argument-hint: "[scene intent]"
---

# board

Define one diagram with the Board protocol and open it on the public viewer.
Done when a `luluboard.app` URL is shown — `#z:` from preview, or `#b:` from
MCP — or chat-only BMD Source is delivered.

## Identity

**BMD Source** is the `.bmd` body. The file has no identity. **BMD ID** (`b_…`)
is the cloud row on `#b:<id>`. `preview` encodes source plus client version `1`
into `#z:`. Cloud mode mints `#b:` through MCP.

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

## Mode

1. If the `whoami` MCP tool is listed, use **cloud mode**.
2. If it is missing, use **hash mode**. Do not mention MCP.
3. If `whoami` is listed but a tool call fails, stop and report. Do not fall back.
4. If the user pastes `#b:` or `#s:` while hash mode is on, say: connect MCP to
   open the cloud board, or paste the Source.

## Hash flow

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

## Cloud flow

1. Call `whoami` and remember the email.
2. New board: author BMD Source → `create_board` → show
   `https://luluboard.app/#b:<id>` for that account.
3. Update: `get_board` for this session’s last id, or a `#b:` the user pasted →
   edit the returned BMD Source → `save_board` with that `version`.
4. On `conflict`, redo the edit on the returned row and save once. Still
   conflict: stop and show both versions.
5. Chat-only: one `board`-fenced block; do not write cloud.

## Open wording

Say one line with the URL, from stdout `open` in hash mode, or after MCP write:

| `open` | Say |
|---|---|
| `created` | The new board is now current. |
| `current` | This is the current board. |

## Boundaries

stdout `url` is the public hash link (`https://luluboard.app/#z:…`). Cloud mode
shows `#b:<id>` instead. CLI success or MCP write completes the skill; do not
open the URL, drive the viewer, or screenshot the layout unless the user
explicitly requests visual verification.
Mint without meta or style. On update, leave those lines unchanged.
`preview` does not write `~/.cache/board/history`.
