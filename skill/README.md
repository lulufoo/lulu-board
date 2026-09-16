# skill/ — plugin root

Ship **this folder** as the Cursor plugin. Chat entry is `/board`.

The installable skill is **`board/`** only. It contains `SKILL.md`, `scripts/`, and `assets/`.

| Path | Role |
|---|---|
| `.cursor-plugin/plugin.json` | Plugin manifest (`name: lulu-board`; `skills: ["board"]`) |
| `board/` | Self-contained `/board` skill |

```bash
python3 board/scripts/drawer_control.py preview --kind board
python3 board/scripts/drawer_control.py status
```

From `board/`, the same CLI is `python3 scripts/drawer_control.py`.

`preview` / `mount` sync `board/assets/` → `~/.cache/board`.

## Not in this folder

Do not ship `packages/`, `scripts/*-build/`, or `tests/`.
Rebuild from the repo root: `node scripts/drawer-app-build/build.mjs`.
