---
name: drawer
description: >-
  Start or control the local Board viewer (content-addressed SSOT with
  document meta id and version).
argument-hint: "[Board source path or intent]"
---

# drawer

Drawer is a local loopback viewer for Board.

| Mode | ID | Source | Renderer |
|---|---|---|---|
| Board | BMD ID (`b_…`) | BMD Source | Board |

Diagram themes are `default` / `classic` / `pastel` / `kami`.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

Build / fetch tooling lives in the **dev monorepo** (`scripts/*-build`), not in this installable skill.

## Commands

```bash
$DRAWER_CTL preview --kind board --file path/to/board.bmd
$DRAWER_CTL preview --kind board
$DRAWER_CTL preview --kind board --id b_…
$DRAWER_CTL get-source --kind board --id b_…
$DRAWER_CTL set-source --kind board --id b_…
$DRAWER_CTL mount
$DRAWER_CTL status
$DRAWER_CTL stop
```

| `--kind` | Live store | Preview |
|---|---|---|
| `board` | `board.bmd` | `?mode=board` |

| Concern | Value |
|---|---|
| Write-back | `preview`, not `set-source` |
| Board source | BMD Source (`board.bmd`). |
| Stash | Omit on mint; do not change on update. |
| Board directives | `board`, `box`, `item`, `->` (relations), `layout` (`direction` / `align` / `justify` / `arrange` / `flush` / `pin`) |
| Board vocab | `../board/references/vocab.md` |
| Records | First identity is BMD ID. Source is the body. `current` is the viewed pointer only. CLI: `--id` is that ID (required on `get-source`; omit on `preview` / `set-source` only to mint). History click retargets `current`. |

## Board identity + current pointer

Board DSL: write `A -> B`, `arrange A below B`, `pin A.top to parent.top N`.

`history/*.bmd` (+ `.json` sidecar) are the **record list** (each is an editable SSOT).
**BMD ID** (`b_…`) is which board. **BMD Source** is the body. `board.meta.json` holds:

| Term | Meaning |
|---|---|
| BMD ID | Which board (`b_…`). First identity. `--id` is this. |
| BMD Source | The `.bmd` body. |
| `current` | Viewed pointer, not identity |
| `title` | Human label |
| `version` | Document version in the stash `meta` line |

On start, if `history` has no `*.bmd`, Drawer seeds every packed
flat file under `../assets/templates/board/*.bmd` (from repo `examples/board-*`, no PNGs)
and points `current` at onboarding.
AI-only `board/templates/demo.bmd` is not seeded.
`preview --kind board` with no file and no stdin body does not create a
record. With a body, omit `--id` to mint; pass `--id` (BMD ID) to update that
record. stdout `open` is `seeded` | `created` | `current`. JSON `id` is BMD ID.

`board.bmd` may be a convenience symlink to `current`; readers/writers must honor `meta.current`.
UI Source edits write through the current record and do **not** create records. History click
only retargets `current`. Source dock uses `/board-history.json` and `DELETE /api/board-history/<file>`.

| Board edit | Does |
|---|---|
| Select | titles; box shell; ⌘/Ctrl-click box tree; nested siblings (arrows); types (`solid` / `dashed` on links) |
| Add / delete | Delete follows selection: shell dissolves; tree removes descendants; item removes itself |
| Link | source, then target |
| Drag | top-level move (drag / arrows); nested reorder |
| Layout | Trunk / Stagger |
| Props | Board-only |
