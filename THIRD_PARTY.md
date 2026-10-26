# Third-party notices

## pele

- Package: `pele`
- Version: `1.7.0` (`third_party/pele/VERSION`; also in `pele.global.js` file header)
- Upstream: https://github.com/obsidianmd/pele
- License: MIT — see `third_party/pele/LICENSE`
- Runtime file: `third_party/pele/pele.global.js`

Board renders Mermaid 12.1.0 syntax through Pele. Do not load Mermaid.js.

## @zumer/snapdom

- Package: `@zumer/snapdom`
- Version: `2.24.18`
- Upstream: https://github.com/zumerlab/snapdom
- License: MIT — see `third_party/snapdom/LICENSE`
- Runtime file: `third_party/snapdom/snapdom.mjs`

## @supabase/supabase-js

- Package: `@supabase/supabase-js`
- Version: `^2.116.0` (root `package.json`)
- Upstream: https://github.com/supabase/supabase-js
- License: MIT
- Built into `.cache/web/vendor/supabase-client.js`

## @sentry/browser

- Package: `@sentry/browser`
- Version: `^11.9.0` (root `package.json`)
- Upstream: https://github.com/getsentry/sentry-javascript
- License: MIT
- Built into `.cache/web/vendor/sentry-client.js`

## Fonts on the landing page

- Instrument Serif (latin, 400) — https://github.com/Instrument/instrument-serif — SIL OFL 1.1, see `packages/site/landing/fonts/OFL-instrument-serif.txt`
- Inter (latin, variable) — https://github.com/rsms/inter — SIL OFL 1.1, see `packages/site/landing/fonts/OFL-inter.txt`

Both were taken from the `@fontsource/instrument-serif` and `@fontsource-variable/inter` npm packages (5.3.0).

## Own layers

- `packages/boxes/` — Lulu Board renderer
- `packages/drawer-app/` — Drawer shell UI

These are part of this project and covered by the root `LICENSE` (MIT).
