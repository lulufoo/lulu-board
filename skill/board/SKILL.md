---
name: board
description: Create a structured visual board from a scene or system.
argument-hint: "[scene intent]"
---

# board

Define one diagram with the Board protocol and open it on the public viewer.
Done when a tool `url` is shown, or chat-only BMD Source is delivered.

## Identity

**BMD Source** is the `.bmd` body. The file has no identity.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

## References

Load the authoring contract before writing.

1. Keep this file at start.
2. Run `$DRAWER_CTL assets`. If it fails, stop and report.
3. Load vocab from `files["vocab.md"].path`; it is the authoring contract.
4. Load [demo.bmd](./templates/demo.bmd) only when a complete example helps.
5. When using an icon, load `files["icons.json"].path`.
6. Load [viewer](./references/viewer.md) for CLI `status` or preview kind.
7. Load [pointers](../references/pointers.md) when a viewer link is pasted.
8. Load [cloud](../references/cloud.md) in cloud mode.

## Mode

1. If the `whoami` MCP tool is listed, use **cloud mode**. Load cloud.md.
2. If it is missing, use **hash mode**. Do not mention MCP.
3. If `whoami` is listed but a tool call fails, stop and report. Do not fall back.
4. If the user pastes a viewer URL in hash mode, load pointers.md.

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

Follow [cloud](../references/cloud.md). Chat-only: one `board`-fenced block.

## Open wording

Say one line with the URL, from stdout `open` or MCP `url`:

| `open` | Say |
|---|---|
| `created` | The new board is now current. |
| `current` | This is the current board. |

## Boundaries

CLI stdout contract: `$DRAWER_CTL --help`.
CLI success or MCP write completes the skill; do not open the URL, drive the
viewer, or screenshot the layout unless the user explicitly requests visual
verification.
Mint without meta or style. On update, leave those lines unchanged.
`preview` does not write `~/.cache/board/history`.
