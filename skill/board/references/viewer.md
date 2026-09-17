# Viewer

Public hash preview for Board. Loaded from `/board` only.

## CLI

1. Use `$DRAWER_CTL` from the board entry.
2. Extra verb: `status`.
3. Subcommand contract: `$DRAWER_CTL --help`.

## Write-back

| Concern | Rule |
|---|---|
| Write | `preview` encodes BMD to the public hash URL |
| Cache | `preview` does not write `history/` |
| Leftover | Existing `history/*.bmd` files are not deleted |
| `--id` | `--id` is BMD ID. Required on `get-source`. |
| Mint | Omit `--id` on `preview` only to mint |

## Pointers

1. CLI preview does not retarget local `current`.
2. The public page does not write CLI history.

## Seed

1. `preview --kind board` with no file and no stdin does not create a record.
2. `templates/demo.bmd` is not opened by preview.

## Open

stdout `open` is `created` | `current`.
stdout `url` is the public hash link on `https://luluboard.app/`, or the bare site when there is no source.
