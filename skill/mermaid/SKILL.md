---
name: mermaid
description: >-
  List supported Mermaid types, or draw one type and preview in drawer.
  Use when: /mermaid, mermaid, 画图, list mermaid types.
argument-hint: "[list | <topic or type>]"
---

# mermaid

List the catalog, or pick one type and author a diagram for drawer. Done when
the list is shown, or preview has run (or was skipped).

## Identity

**MMD ID** (`m_…`) is which diagram. **MMD Source** is the `.mmd` body. `--id` is
MMD ID. Omit `--id` only to mint. `title` is the label. `current` is the viewed
pointer.

## Script Macros

| Macro | CLI |
|---|---|
| `$DRAWER_CTL` | `python3 scripts/drawer_control.py` |

## Models

Load only what the current interface needs.

1. Keep this file at start.
2. **list** — load [catalog](./references/catalog.md) only.
3. **route** — after the type is chosen, load that one file from catalog.

## Interfaces

Two entries. Do not author during list.

1. **list** — slash `list`, or the ask is which types exist. Load catalog.
   Show the class table. Stop.
2. **route** — any draw ask. Pick exactly one catalog type. Load only that
   file. Author. Preview.

## Route

The catalog is the type boundary. The model picks the type.

1. A named type or alias wins.
2. Else pick the type that matches what must be visible.
3. Two fit → pick one; do not stop to ask.
4. None fit → ask one line, then stop.
5. Source already in hand and the ask is preview → drawer only.

## Author

After the type file is loaded.

1. Use one sample in that file (minimal default). Flowchart: one edge-meaning
   category. C4: one view level.
2. Replace labels; keep the sample's node and edge kinds.
3. Prefer ≤ ~12 primary elements unless the user asked for more.
4. **Before any Mermaid drawer action** (read, edit, preview, history restore,
   delete): run `$DRAWER_CTL status` and keep the live MMD ID (`id`) first.
   `title` is only the label. If the frontend switched diagrams, MMD ID
   changes — never assume the previous turn's diagram is still live. Then
   `$DRAWER_CTL get-source --kind mermaid --id <id>` when you need the MMD
   Source. `<id>` is the MMD ID from this session’s last preview or status.
5. `$DRAWER_CTL preview --id <id>` (stdin or `--file`) when updating that
   diagram. Omit `--id` only to mint. Show the URL and the MMD ID. No mermaid
   fence when drawer runs.
6. Chat-only / no preview: one mermaid fence.

## Done

Stop when the list was shown, preview has run (or was skipped), or Entry asked
and stopped.

## Boundaries

1. Types come from catalog only. Do not invent a diagram kind.
2. Samples stay in `references/`. Do not copy them here.
3. Preview rules live in sibling `drawer`. Not Board. Not Workbench whiteboard.
4. Always resolve the live diagram via `status` MMD ID before acting. Do not
   edit from memory of an earlier preview.
5. History restore must keep the snapshot's MMD ID / `title` and must **not**
   create a new archive snapshot (`X-Diagram-Archive: 0` / restore path).
6. Do not expect UI Source keystrokes to create history — only `$DRAWER_CTL
   preview` / `set-source` snapshot Mermaid.
7. Mint without `%% meta` or `%% style`. On update, leave those lines unchanged.
