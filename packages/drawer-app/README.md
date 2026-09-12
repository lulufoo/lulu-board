# drawer-app

Drawer shell source. Domain libs stay in `packages/board`, `packages/mermaid-ext/*`, `packages/mermaid-themes`.

```
packages/drawer-app/
  index.html          # DOM skeleton only
  css/
    01-base.css
    02-chrome.css
    03-diagram.css
  js/
    00-early-head.js
    00-early-hydrate.js
    00-mermaid-alias.js
    00-style-line.js
    01-shell-state.js
    02-board.js
    03-mermaid.js
    04-mindmap.js
    05-render-io.js
    06-view-sequence.js
    07-chrome-boot.js
```

Build:

```bash
node scripts/drawer-app-build/build.mjs
```

Writes `skill/assets/drawer.html` plus `skill/assets/vendor/drawer-app.{css,js}` and early/alias scripts. `drawer_control.py sync_assets` copies them into `~/.cache/drawer`.
