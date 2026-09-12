# skill/ — install root

Install / publish **this folder only**.

| Path | Role |
|---|---|
| `SKILL.md` | Agent entry (Board + Mermaid) |
| `board/` `mermaid/` `drawer/` | Mode skills |
| `assets/` | Built Drawer viewer (`drawer.html` + `vendor/*.min.js`) |
| `scripts/` | Runtime CLI (`drawer_control.py` + helpers) |

```bash
python3 scripts/drawer_control.py preview --kind board
python3 scripts/drawer_control.py status
```

`preview` / `mount` sync `assets/` → `~/.cache/drawer`.

## Not in this folder

Dev monorepo (do not install): `packages/`, `scripts/*-build/`, `tests/`.  
Rebuild assets from repo root, e.g. `node scripts/drawer-app-build/build.mjs`.
