# skill/

Chat entries are `/board` and `/mermaid`. Each skill is a folder with
`SKILL.md`. Do not add `skill/SKILL.md`.

| Path | Role |
|---|---|
| `board/` | Self-contained `/board` skill |
| `mermaid/` | Self-contained `/mermaid` skill |

```bash
python3 board/scripts/drawer_control.py preview --kind board
python3 board/scripts/drawer_control.py status
python3 board/scripts/drawer_control.py assets
python3 mermaid/scripts/drawer_control.py preview --kind flowchart
python3 mermaid/scripts/drawer_control.py status
```

From `board/` or `mermaid/`, the same CLI is `python3 scripts/drawer_control.py`.

`preview` prints a `https://preview.luluvela.app/#z:…` URL from `{bmd, version}`. It
does not write local history.

`assets` (board) syncs `vocab.md` and `icons.json` from preview.luluvela.app into
`~/.cache/board/assets/`.

Rebuild the public viewer from the repo root: `node scripts/web-build/build.mjs`.
