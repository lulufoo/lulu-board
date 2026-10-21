# Viewer

Public hash preview for Mermaid. Loaded from `/mermaid` only.

## CLI

1. Use `$DRAWER_CTL` from the mermaid entry.
2. Extra verb: `status`.
3. Subcommand contract: `$DRAWER_CTL --help`.

## Write-back

| Concern | Rule |
|---|---|
| Write | `preview` encodes `{bmd, version}` to the public hash URL |
| Cache | `preview` does not write `history/` |
| `--id` | leftover; ignored |
| Mint | any file or stdin is a new encode |
| Kind | `--kind flowchart` |

## Pointers

1. CLI preview does not retarget local `current`.
2. The public page does not write CLI history.
3. Hash mode emits `#z:`. Cloud mode emits `#b:<id>` after MCP `create_vela` or `save_vela`.
4. CLI preview never mints `#b:`.

## Seed

1. `preview --kind flowchart` with no file and no stdin does not create a record.

## Open

stdout `open` is `created` | `current`.
stdout `url` is the public hash link on `https://luluboard.app/`, or the bare site when there is no source.
