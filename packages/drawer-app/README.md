# drawer-app

Board-only Drawer shell. Domain lib stays in `packages/board`.

```
packages/drawer-app/
  index.html
  css/
    01-base.css
    02-chrome.css
    03-diagram.css
    04-source-lines.css
  js/
    00-early-head.js
    00-early-hydrate.js
    00-style-line.js
    00-document-meta.js
    00-canvas-view.js
    01-shell-state.js
    02-board.js
    05-render-io.js
    05-export-png.js
    07-chrome-boot.js
    08-source-lines.js
```

Build:

```bash
node scripts/drawer-app-build/build.mjs
```

✅ Verified (`scripts/drawer-app-build/build.mjs`, `scripts/web-build/build.mjs`): writes `.cache/web/vendor/drawer-app.{css,js}` plus early scripts and favicons. The public page is `.cache/web/index.html` from `node scripts/web-build/build.mjs`.
