# sandbox-app

The runner page that lets a Sketch run its own JavaScript without touching Board.

Board embeds `https://sandbox.luluboard.app/` in an iframe with
`sandbox="allow-scripts"` and no `allow-same-origin`. A packed Tauri Mac webview
(`tauri://localhost`) may embed it too; that origin is not a Spark identity.
The page is served from its own origin, and its response carries a `sandbox` CSP,
so the document has an opaque origin: it cannot read Board's storage, cookies, or
DOM. This package holds only that page. The Worker that serves it and its
response headers live outside this package.

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
Content-Security-Policy: sandbox allow-scripts; connect-src 'none'; frame-ancestors https://luluboard.app tauri://localhost; frame-src 'none'; object-src 'none'
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

Link clicks: the runner cancels the default action of a click on `<a href>` and `<area href>`, so a click cannot
navigate the frame away. The click still reaches the fragment's own handlers. This guards the picture, not the
sandbox: a script can still set `location.href`.

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
| Board to runner | `lulu-sandbox:render` | `html: string`, `appearance: "light"` or `"dark"` | Mount one fragment as the body. Scripts in it run. The runner writes `appearance` onto `<html data-appearance>` before inserting the fragment. A missing or other value is `light`. Only the first `render` per runner load is used; Board mounts a fresh frame per sketch. |
| Board to runner | `lulu-sandbox:appearance` | `appearance: "light"` or `"dark"` | Theme change on the frame already showing this fragment. The runner writes `data-appearance` and dispatches `lulu-appearance`. It does not insert HTML again. Any other value is ignored, and the current theme stays. A message before `render` is ignored. |
| runner to Board | `lulu-sandbox:size` | `width, height` (CSS px), `bleed` (whole px, optional) | Frame size. Sent after mount and whenever it changes. `bleed` is the transparent room the runner keeps on every side inside the frame, so the picture is `(width - 2 * bleed)` by `(height - 2 * bleed)`. A message with no `bleed` means the frame is the picture. `width` and `height` outside `0 < n <= 32768` are rejected by `parseSize`. A `bleed` that is not a whole number from 1 to 12, or that leaves no picture, is read as 0. |
| Board to runner | `lulu-sandbox:capture` | `id: string` (1 to 64 chars), `scale: number` (`0 < scale <= 8`) | Ask for a transparent bitmap of the whole document. |
| runner to Board | `lulu-sandbox:captured` | `id`, `bitmap: ImageBitmap` | Reply to `capture`. The bitmap is transferred, not copied. |
| runner to Board | `lulu-sandbox:error` | `id: string or null`, `message: string` | `capture` failed or came before `render`. `message` is cut to 200 characters. |
| Board to runner | `lulu-sandbox:pick` | `id: string` (1 to 64 chars), `x, y` (frame CSS px, bleed included, `abs(n) <= 32768`) | Ask which piece of text is under a point. Ignored before `render`. |
| runner to Board | `lulu-sandbox:picked` | `id`, `target: string or null` | Reply to `pick`. `target` is the id of the top-most element under the point that Board stamped, or `null` for no text there. A `target` that is not an element-index path (`"1.0.3"`) is read as `null`. |
| Board to runner | `lulu-sandbox:select` | `target: string or null`, `ring: { color: "#rrggbb", width, offset }` (px, 0 to 16) | Show one piece of text as selected, or none (`target: null`, no `ring`). A message with a bad `target` or `ring` is dropped and the old selection stays. A `target` the page no longer has clears the old one. Ignored before `render`. |
| Board to runner | `lulu-sandbox:text` | `target: string`, `text: string` (at most 100000 UTF-16 units) | Show new text in one piece of text without mounting the fragment again. Each line is a text node, with a `<br>` between lines; the text never becomes markup. The runner then reports `size` again. Ignored before `render`. |

The bleed is padding that the runner sets inline on `<html>`, so a fragment's own reset cannot remove it. A
shadow or ring that spills past the picture then stays inside the frame. The bleed stays transparent: a browser
paints a page's `body` background over the whole page unless `<html>` has a background of its own, so the runner
gives `<html>` an invisible background image and forces its background color to transparent, both with
`!important`. A `body` background in the fragment then covers the picture only. A background set on `html`
itself is ignored, because it would paint the whole page, bleed included. A fragment sized by the viewport
(`min-height: 100vh`, `width: 100vw`) follows the frame, and the frame follows the size message, so the padding
would grow it on every round. The runner detects that the frame already has its last size while the page asks for
exactly `2 * bleed` more, removes the padding, and reports `bleed: 0`.

Capture runs `snapdom.toCanvas(document.documentElement, { backgroundColor: null, dpr: 1, scale })`, so the
bitmap includes the bleed. Background, export bleed, crop, and saving stay in Board.

Picking text. Board stamps `data-lulu-id` (an element-index path such as `1.0.3`) on each leaf element that holds
only text, and sends that stamped fragment as `html`. The ids live in the fragment Board sends, not in the source it
saves. Board does not trust an id the runner returns: it looks the id up in its own parse of the source and shows the
text it finds there, and a lookup that finds nothing is a click on blank. Selection is one `data-lulu-selected`
attribute and one injected `outline` rule in `<head>`, so the fragment's own markup is not changed. A capture removes
the attribute first and puts it back when the capture ends, whether it succeeded or failed, so an export never
contains the ring. A fragment can forge a stamp, which only moves a click to another piece of text, and the same
lookup in Board rejects an id that is not in the source.
