---
name: board
description: Create a structured visual board from a scene or system.
argument-hint: "[scene intent]"
---

# board

Define one diagram with the Board protocol and open it on the public viewer.
Done when a tool `url` is shown, or chat-only BMD Source is delivered.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

## References

Load what the current write needs.

1. Run `$DRAWER_CTL assets`. If it fails, stop and report.
2. Load vocab from `files["vocab.md"].path`.
3. Load [demo.bmd](./templates/demo.bmd) only when a complete example helps.
4. When using an icon, load `files["icons.json"].path`.
5. Load [viewer](./references/viewer.md) for CLI `status` or preview kind.

## Author

What to write.

1. **BMD Source** is the `.bmd` body. The file has no identity.
2. Author one BMD Source string that follows vocab.
3. Mint without style. On update, leave those lines unchanged.

## Mode

Pick hash or cloud.

1. If the `whoami` MCP tool is listed, use **cloud mode**. Load [cloud](../references/cloud.md).
2. If it is missing, use **hash mode**. Do not mention MCP.
3. If `whoami` is listed but a tool call fails, stop and report. Do not fall back.
4. If the user pastes a viewer URL in hash mode, load [pointers](../references/pointers.md).

## Hash flow

Publish unsigned.

1. Use the public viewer unless the user explicitly requests chat-only output.
2. After any preview, Keep `url` first, then `open`. Show the URL and stop.
3. No scene to draw (and not an update): run `$DRAWER_CTL preview --kind board`
   with no `--file` and no stdin body.
4. For an update, edit this session’s last BMD Source text. If none yet, run
   step 3 first.
5. For the public viewer, run `$DRAWER_CTL preview --kind board` with stdin or
   `--file`. If it reports a DSL error, correct the BMD Source and rerun.
6. For chat-only output, return one `board`-fenced block and stop.

## Cloud flow

Publish owned.

Follow [cloud](../references/cloud.md). Chat-only: one `board`-fenced block.

## Open wording

Say one line with the URL, from stdout `open` or MCP `url`:

| `open` | Say |
|---|---|
| `created` | The new board is now current. |
| `current` | This is the current board. |

## Boundaries

1. CLI stdout contract: `$DRAWER_CTL --help`.
2. CLI success or MCP write completes the skill; do not open the URL, drive the
   viewer, or screenshot the layout unless the user explicitly requests visual
   verification.
