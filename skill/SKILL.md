---
name: lulu-draw-skills
description: >-
  Lulu Draw: Lulu Board and Lulu Mermaid in the local Drawer.
---

# Lulu Draw Skills

This directory is the **skill install root**. Install / publish **only** this folder.

| Mode | Product | ID | Source | Skill |
|---|---|---|---|---|
| Board | **Lulu Board** | BMD ID (`b_…`) | BMD Source | `board/` |
| Mermaid | **Lulu Mermaid** | MMD ID (`m_…`) | MMD Source | `mermaid/` |

CLI: `$DRAWER_CTL` → `python3 scripts/drawer_control.py` (see `drawer/`).

Runtime assets: `assets/` (built from the monorepo; synced to `~/.cache/drawer` on preview).

**Lulu Board** — human + AI co-author the same minimal text protocol for simple-flow whiteboards.  
**Lulu Mermaid** — Mermaid diagrams in the same Drawer loop.
