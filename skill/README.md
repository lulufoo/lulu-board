# skill/ — plugin root

Ship **this folder** as the Cursor plugin. Chat entry is `/board`.

| Path | Role |
|---|---|
| `board/` | `/board` skill (`references/viewer.md` for preview) |
| `assets/` | Built viewer (`drawer.html` + `vendor/`) |
| `scripts/` | `drawer_control.py` |

```bash
python3 scripts/drawer_control.py preview --kind board
python3 scripts/drawer_control.py status
```

`preview` / `mount` sync `assets/` → `~/.cache/board`.

## Not in this folder

Do not ship `packages/`, `scripts/*-build/`, or `tests/`.
Rebuild from the repo root: `node scripts/drawer-app-build/build.mjs`.
