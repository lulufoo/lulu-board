# Viewer

Mermaid CLI preview. Loaded from `/mermaid` for `status` or kind.

## CLI

1. Use `$DRAWER_CTL` from the mermaid entry.
2. Extra verb: `status`.
3. Subcommand contract: `$DRAWER_CTL --help`.

## Kind

`--kind flowchart`

## Seed

1. `preview --kind flowchart` with no file and no stdin does not create a record.

## Write-back

| Concern | Rule |
|---|---|
| Cache | `preview` does not write `history/` |
| `--id` | leftover; ignored |
| Mint | any file or stdin is a new encode |

Pointer grammar: [pointers](../../references/pointers.md).
