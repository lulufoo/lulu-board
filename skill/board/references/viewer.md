# Viewer

Local loopback preview for Board. Loaded from `/board` only.

## CLI

1. Use `$DRAWER_CTL` from the board entry.
2. Extra verbs: `mount`, `status`, `stop`.
3. Subcommand contract: `$DRAWER_CTL --help`.

## Write-back

| Concern | Rule |
|---|---|
| Write | `preview`, not `set-source` |
| `--id` | `--id` is BMD ID. Required on `get-source`. |
| Mint | Omit `--id` on `preview` / `set-source` only to mint |

## Pointers

| Term | Meaning |
|---|---|
| `history/*.bmd` | Record list (+ `.json` sidecar) |
| `current` | Viewed pointer, not identity |

1. History click retargets `current`.
2. UI Source writes through `current` and does not create records.

## Seed

1. If `history` has no `*.bmd`, seed `assets/templates/board/*.bmd` and point `current` at onboarding.
2. `templates/demo.bmd` is not seeded.
3. `preview --kind board` with no file and no stdin does not create a record.

## Open

stdout `open` is `seeded` | `created` | `current`.
