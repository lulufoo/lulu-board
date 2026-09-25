# skill/

Chat entry is `/board`. The skill is **`board/`**. It contains `SKILL.md`, `scripts/`, and `templates/`.

| Path | Role |
|---|---|
| `board/` | Self-contained `/board` skill |

```bash
python3 board/scripts/drawer_control.py preview --kind board
python3 board/scripts/drawer_control.py status
```

From `board/`, the same CLI is `python3 scripts/drawer_control.py`.

`preview` prints a `https://luluboard.app/#z:…` URL from `{bmd, version}`. It does not write local history.

Rebuild the public viewer from the repo root: `node scripts/web-build/build.mjs`.
