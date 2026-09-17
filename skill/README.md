# skill/ — plugin root

Ship **this folder** as the Cursor plugin. Chat entry is `/board`.

The installable skill is **`board/`** only. It contains `SKILL.md`, `scripts/`, and `templates/`.

| Path | Role |
|---|---|
| `.cursor-plugin/plugin.json` | Plugin manifest (`name: lulu-board`; `skills: ["board"]`) |
| `board/` | Self-contained `/board` skill |

```bash
python3 board/scripts/drawer_control.py preview --kind board
python3 board/scripts/drawer_control.py status
```

From `board/`, the same CLI is `python3 scripts/drawer_control.py`.

`preview` writes local history under `~/.cache/board` and prints a `https://luluboard.app/#z:…` URL.

## Not in this folder

Do not ship `packages/`, `scripts/*-build/`, `tests/`, or `web/`.
Rebuild the public viewer from the repo root: `node scripts/web-build/build.mjs`.
