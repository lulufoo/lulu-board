# Viewer

Boxes CLI preview. Loaded from `/boxes` for `status` or kind.

## CLI

1. Use `$DRAWER_CTL` from the boxes entry.
2. Extra verb: `status`.
3. Subcommand contract: `$DRAWER_CTL --help`.

## Kind

`--kind boxes`

## Seed

1. `preview --kind boxes` with no file and no stdin does not create a record.
2. `templates/demo.bmd` is not opened by preview.

## Write-back

| Concern | Rule |
|---|---|
| Cache | `preview` does not write `history/` |
| Leftover | Existing `history/*.bmd` files are not deleted |
| `--id` | leftover; ignored |
| Mint | any file or stdin is a new short url |

Pointer grammar: [pointers](../../references/pointers.md).
