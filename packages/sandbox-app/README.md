# sandbox-app

The runner page that lets a Sketch run its own JavaScript without touching Board.

Board embeds `https://sandbox.luluboard.app/` in an iframe with
`sandbox="allow-scripts"` and no `allow-same-origin`. The page is served from its own
origin, and its response carries a `sandbox` CSP, so the document has an opaque origin: it
cannot read Board's storage, cookies, or DOM. This package holds only that page. The Worker
that serves it and its response headers live outside this package.

## Build

```
node scripts/build-sandbox/build.mjs
```

Writes `.cache/sandbox/`:

- `index.html`: the page, served at `/`. The whole sandbox domain is the runner. The runner
  logic and protocol are inline, so rendering waits for one request only.
- `capture-<hash>.js`: SnapDOM, the largest part. Only export needs it, so the page loads it
  after `load` (or on the first `capture`), never before rendering.
- `_headers`: the response headers below.

Both scripts are classic on purpose: an opaque-origin page loads a classic script without
CORS, but a module or a dynamic `import()` would need `Access-Control-Allow-Origin`.

## Response headers

`src/headers.js` is the one definition. The build writes it as `.cache/sandbox/_headers` for a
Workers static assets Worker; a Worker with its own code imports `runnerHeaders()` instead.

```
Content-Security-Policy: sandbox allow-scripts; connect-src 'none'; frame-ancestors https://luluboard.app; frame-src 'none'; object-src 'none'
```

Cache rules sit in the same file (`RUNNER_CACHE`): `/` is `max-age=60, stale-while-revalidate=86400`
so a new core reaches users within a minute and a repeat visit never waits; `/capture-*` is
`immutable` because the file name carries its hash.

The CSP applies to every path (`/*`), as a header. In a `<meta>` tag `sandbox` and
`frame-ancestors` do nothing. Checked in a browser against a local server: with the header,
a fragment's `fetch` and a script-created `iframe` never reach the network, and an
unlisted parent cannot embed the page. Without it both requests go out.

After deploying, check the live page with
`node scripts/verify-sandbox/verify.mjs [url]` (default `https://sandbox.luluboard.app/`).

Known gap: `connect-src` does not cover images. A fragment can still send data out with an
`<img>` GET. `script-src`, `img-src`, and `style-src` stay open on purpose.

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
