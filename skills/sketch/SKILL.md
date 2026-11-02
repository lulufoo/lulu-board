---
name: sketch
description: Draw one Sketch on the public viewer.
argument-hint: "[picture intent]"
---

# sketch

Write one Sketch source and open it on the public viewer.
Done when the returned short `url` is shown.

## Script Macros

| Macro | CLI |
|---|---|
| `$SKETCH_CTL` | `python3 scripts/sketch_control.py` |

## Source

Three lines. Payloads have no braces.

1. First line is `sketch "<title>"`. The quotes hold the title. Always write a short title that names the diagram.
2. `style`, then one base64 token, is the camera and appearance. On an update, leave that line unchanged. Omit it when minting.
3. `content`, then one base64 token, is the fragment.

## Template

Write from the template.

1. Load [template.md](./references/template.md) and write from it.
2. Excludes `<iframe>`, `<object>`, `<embed>`, and `<link>`. Board removes them before mounting.

## Render Environment

The viewer mounts the fragment in its own document. Write for this environment.

1. The fragment renders in a sandboxed `iframe`. Board and the fragment cannot reach each other's CSS or scripts. Scripts run when the sketch mounts. `fetch`, `XMLHttpRequest`, and `WebSocket` are blocked.
2. Board supplies `html` and `body` with zero margin and a transparent background. `:root`, `html`, and `body` selectors act on that document. A background on `body` paints the picture only, and a background on `html` is ignored. To color the picture, set the background on `body` or on the root element.
3. The frame takes no pointer input. Scripts get no pointer events, so click handlers and `:hover` do nothing. The canvas pans and zooms over it.
4. No network. Put every style, shape, glyph, and script in the fragment.

## 沙箱安全

Sandbox security for the runner at `https://sandbox.luluboard.app/`. These are the bounds the code enforces.

1. Cross-origin iframe, opaque origin. Board creates the frame in `packages/drawer-app/src/kinds/sketch.js` and sets `sandbox` to `allow-scripts` only. Keep `allow-same-origin` off that attribute. The frame origin is opaque, and `postMessage` reports it as the string `"null"`, so scripts in the frame cannot read Board's storage, cookies, or DOM. Adding `allow-same-origin` on a page that can change its own sandbox attribute is an escape.
2. CSP on the sandbox host. `runnerCsp` in `packages/sandbox-app/src/headers.js` is the one definition. The build writes it to `.cache/sandbox/_headers`, and a Worker imports `runnerHeaders()`. `RUNNER_PATHS` is `/*`, so every path on that host gets the header, including `capture-*.js`. `sandbox` and `frame-ancestors` have to be response headers; a `<meta>` CSP ignores them. The header value is `sandbox allow-scripts; connect-src 'none'; frame-ancestors https://luluboard.app; frame-src 'none'; object-src 'none'`. `connect-src 'none'` blocks `fetch`, `XMLHttpRequest`, `WebSocket`, and beacon. `frame-src 'none'` and `object-src 'none'` block nested documents and plugins. `frame-ancestors` allows `https://luluboard.app`. `script-src`, `img-src`, and `style-src` stay unset so sketch scripts and styles run. An `<img>` GET can still send data out.
3. postMessage protocol. Types are `lulu-sandbox:*` in `SANDBOX_MSG` (`packages/sandbox-app/src/protocol.js`): `ready`, `render`, `appearance`, `size`, `capture`, `captured`, `error`. Board accepts a message only when `event.source` is that frame's `contentWindow` and `event.origin` is `"null"`. The runner (`packages/sandbox-app/src/runner.js`) accepts a message only when `event.source` is `window.parent`. Each payload then goes through its `parse*` function, and a failed check is dropped: `parseReady`; `parseRender` (`html` is a string, and appearance other than `"dark"` is `"light"`); `parseAppearance` (`"light"` or `"dark"` only); `parseSize` (`0 < width, height <= 32768`, then a whole-pixel `bleed` from 1 to 12 that still leaves a picture, otherwise `0`); `parseCapture` (`id` length 1 to 64, `0 < scale <= 8`); `parseCaptured` (same `id` rule, bitmap edges under the same size cap); `parseError` (`message` cut to 200 characters, a bad `id` becomes `null`). Both sides post with `targetOrigin "*"`, because an opaque origin cannot be named. Fragment scripts are untrusted and can lie about size.
4. Content strip. Before mount, `sketchFragmentRoot` removes every `iframe`, `object`, `embed`, and `link` in the fragment. Script elements stay, because they are meant to run inside the opaque origin. The strip is a content guard: a script can still create those elements after mount, and the runner CSP is what blocks the nested document or plugin.
5. Capture script. `packages/sandbox-app/src/capture.js` imports SnapDOM and sets `window.LuluSnapdom`. `scripts/build-sandbox/build.mjs` inlines the runner core into `index.html` and writes SnapDOM as a separate `capture-<hash>.js`. `main.js` loads that classic script on demand (`loadCapture`) for `snapdom.toCanvas`, and starts the load after the page `load` event. A classic script loads on an opaque origin without CORS.
6. Timeouts. `RUNNER_TIMEOUT_MS` is `10000`: Board stops waiting when the runner has not reported a size in 10s. `CAPTURE_TIMEOUT_MS` is `30000`: a capture rejects after 30s.

## Performance

The frame is resized by its content and exported as one still image. Write for that.

1. Draw a still picture. Add animation only when the user asks for it.
2. Animate only `transform` and `opacity`. A change in size resizes the frame on every step.
3. Avoid `filter`, `backdrop-filter`, and large blurred shadows. They are slow to paint.
4. Run no endless loop. Keep script work short: the viewer gives up after 10s when the sketch does not report a size.
5. Keep the element count low.

## Show

1. Pipe the source to `$SKETCH_CTL preview --kind sketch`, or pass `--file`.
2. Show only the CLI stdout `url` and stop.
3. To change, edit the source and preview again. That creates a new short url.
4. To keep, use `#b:`.
