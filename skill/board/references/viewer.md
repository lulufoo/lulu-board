# Viewer

Local loopback viewer for Board. Loaded from `/board` only. Not a slash skill.

Use `$DRAWER_CTL` from the board entry. Extra verbs: `mount`, `status`, `stop`.
Subcommand contract: `$DRAWER_CTL --help`.

Write-back is `preview`, not `set-source`. `--id` is BMD ID. Required on
`get-source`. Omit on `preview` / `set-source` only to mint.

`history/*.bmd` (+ `.json` sidecar) are the record list. `current` is the viewed
pointer, not identity. History click retargets `current`. UI Source writes
through `current` and does not create records.

On start, if `history` has no `*.bmd`, the viewer seeds packed templates under
`../assets/templates/board/*.bmd` and points `current` at onboarding.
`board/templates/demo.bmd` is not seeded.

`preview --kind board` with no file and no stdin does not create a record.
stdout `open` is `seeded` | `created` | `current`.
