# skill/

Chat entry is `/board`. The skill is **`board/`**. It contains `SKILL.md`, `scripts/`, and `templates/`.

| Path | Role |
|---|---|
| `board/` | Self-contained `/board` skill |

```bash
python3 board/scripts/drawer_control.py preview --kind board
python3 board/scripts/drawer_control.py status
python3 board/scripts/drawer_control.py assets
```

From `board/`, the same CLI is `python3 scripts/drawer_control.py`.

`preview` prints a `https://luluboard.app/#z:…` URL from `{bmd, version}`. It does not write local history.

`assets` syncs `vocab.md` and `icons.json` into `~/.cache/board/assets/`. Each run it hashes the local copies (md5) and compares them with `https://luluboard.app/skill-assets/manifest.json`; missing or mismatched files are re-downloaded and verified before replacing. Offline, it uses the cache. The source of both files is `packages/drawer-app/skill-assets/` in the repo.

Rebuild the public viewer from the repo root: `node scripts/web-build/build.mjs`.
