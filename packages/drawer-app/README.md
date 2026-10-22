# drawer-app

All-kinds vela host. The opened document is a diagram; Board (Z) is one kind. The Z engine stays in `packages/board`.

```
packages/drawer-app/
  index.html
  css/
    01-base.css
    02-chrome.css
    03-diagram.css
    04-board-form.css
    04-source-lines.css
    05-share.css
    06-group-tabs.css
    06-sign-in.css
    07-cloud-chrome.css
    08-workspace-shell.css
    09-create-kind-dialog.css
    09-share-dialog.css
    09-shell-tabs.css
    09-shortcuts.css
    09-source-style.css
  js/
    00-early-head.js
    00-early-hydrate.js
    00-style-line.js
    00-document-meta.js
    00-cloud-route.js
    00-hash-persist.js
    00-canvas-view.js
    00-flowchart-type-scale.js
    00-pele-theme.js
    01-shell-state.js
    01-canvas-interaction.js
    02-vela.js
    02-board.js
    03-flowchart.js
    03-flowchart-shapes.js
    05-render-io.js
    05-export-png.js
    06-confirm.js
    06-cloud-sync.js
    06-cloud-share.js
    06-cloud-shares.js
    06-cloud-groups.js
    06-cloud-group-tabs.js
    06-cloud-group-order.js
    06-cloud-search.js
    06-cloud-pull.js
    06-cloud-delete.js
    07-chrome-boot.js
    08-source-lines.js
    09-create-kind-dialog.js
    09-share-dialog.js
    09-shell-drawer.js
    09-shell-tabs.js
    09-shortcuts.js
    10-source-style.js
```

Build:

```bash
node scripts/drawer-app-build/build.mjs
```

Writes `.cache/web/vendor/drawer-app.{css,js}` plus early scripts and favicons. The public page is `.cache/web/index.html` from `node scripts/web-build/build.mjs`.
