# sandbox-app

The runner page that lets a Sketch run its own JavaScript without touching Board.

Board embeds `https://sandbox.luluboard.app/runner` in an iframe with
`sandbox="allow-scripts"` and no `allow-same-origin`. The page is served from its own
origin, and its response carries a `sandbox` CSP, so the document has an opaque origin: it
cannot read Board's storage, cookies, or DOM. This package holds only that page. The Worker
that serves it and its response headers live outside this package.

## Build

```
node scripts/build-sandbox/build.mjs
```

Writes `.cache/sandbox/`:

- `runner.html`: the page, served at `/runner`.
- `runner-<hash>.js`: one classic script with the runner logic and SnapDOM. It is a classic
  script on purpose: an opaque-origin page loads a classic script without CORS, but a module
  would need `Access-Control-Allow-Origin`.

## Message contract

Source of truth: `src/protocol.js`. Board imports the same module, so names and validators
cannot drift.

Opaque-origin consequences, for both sides:

- Board sees `event.origin === "null"` for every runner message. Identify the runner with
  `event.source === frame.contentWindow`, not with an origin string.
- Board posts to the runner with `targetOrigin "*"`: an opaque origin cannot be named. Only
  the sketch fragment goes that way.
- The runner posts to its parent with `"*"` and ignores any message whose `event.source` is
  not `window.parent`. `frame-ancestors` decides who may embed the page.
- Fragment scripts run in the runner document and are untrusted. They can send junk or lie
  about size. Board must validate every message with the `parse*` functions and treat
  nothing as trusted.

| Direction | `type` | Fields | Meaning |
|---|---|---|---|
| runner to Board | `lulu-sandbox:ready` | none | Runner is loaded and listening. Board sends `render` after this. |
| Board to runner | `lulu-sandbox:render` | `html: string` | Mount one fragment as the body. Scripts in it run. Only the first `render` per runner load is used; Board mounts a fresh frame per sketch. |
| runner to Board | `lulu-sandbox:size` | `width, height` (CSS px) | Content size. Sent after mount and whenever it changes. Values outside `0 < n <= 32768` are rejected by `parseSize`. |
| Board to runner | `lulu-sandbox:capture` | `id: string` (1 to 64 chars), `scale: number` (`0 < scale <= 8`) | Ask for a transparent bitmap of the whole document. |
| runner to Board | `lulu-sandbox:captured` | `id`, `bitmap: ImageBitmap` | Reply to `capture`. The bitmap is transferred, not copied. |
| runner to Board | `lulu-sandbox:error` | `id: string or null`, `message: string` | `capture` failed or came before `render`. `message` is cut to 200 characters. |

Capture runs `snapdom.toCanvas(document.documentElement, { backgroundColor: null, dpr: 1, scale })`.
Background, bleed, crop, and saving stay in Board.
