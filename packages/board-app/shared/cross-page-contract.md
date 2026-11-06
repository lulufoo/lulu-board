# Cross-page contract

`workspace`, `landing` and `oauth` ship as separate outputs and never import each other (dependency-cruiser rule `board-app-surfaces-isolated`). A few literals still have to agree across them. Each literal is written out in every file that needs it, not shared by import. This file is the one list.

`checks/board-app/shared/cross-page-contract.test.js` fails when a literal below and a literal in a listed file drift apart. To change one, edit every listed place and this file in the same commit.

Paths below are relative to `packages/board-app/`.

## 1. Stored session key

| | |
| --- | --- |
| Literal | `/^sb-.+-auth-token$/` |
| Files | `workspace/src/core/early-head.js` (`SESSION_KEY_RE`), `landing/landing.js` (`SESSION_KEY_RE`) |

The Supabase client writes the session to `localStorage` under its default key `sb-<project-ref>-auth-token`. No page sets a custom `storageKey`. `workspace` (early-head) and `landing` only read it, to tell a signed-in visitor from a signed-out one before any client loads.

## 2. Sign-in handoff

| | |
| --- | --- |
| Literal | `lulu-board:open-sign-in` (a `sessionStorage` key) |
| Writer | `landing/landing.js` (`SIGN_IN_FLAG`), on click of an element with `data-open-sign-in` |
| Reader | `workspace/src/cloud/cloud-sync.js` (`cloudOpenSignInFromLanding`), once; it removes the key |
| Values | `menu` (open the sign-in menu), `github` (start GitHub sign-in) |

`landing/index.html` currently uses `menu` only. Behavior is covered by `checks/board-app/shared/06-landing-sign-in.test.js`.

## 3. Blank board address

| | |
| --- | --- |
| Literal | the `#z:…` token in the `Sign in` link of `landing/index.html` |
| Must equal | `BLANK_Z_HASH` in `workspace/src/core/early-head.js` |

The `Sign in` link opens a blank board in `workspace`, where the handoff in section 2 then runs.

## 4. Public URLs

| URL | Served from | Referenced by |
| --- | --- | --- |
| `/` | `workspace` | |
| `/?ws=1` | `workspace` | the `landing` call-to-action links; `early-head.js` (`isForcedWorkspace`) keeps this address on `workspace` |
| `/landing/` | `landing` | `early-head.js` (`LANDING_PATH`) |
| `/oauth/consent` | `oauth/consent` | the Supabase OAuth server's authorization path, set outside this repo and not verified by any check; `packages/board-cli/tests/fake_auth_server.py` redirects to it |

`html_handling = "auto-trailing-slash"` in `wrangler.toml` redirects `/landing` and `/oauth/consent` to their slash form. Folder names under `packages/board-app/` do not change these URLs. `scripts/build-site/build.mjs` maps `landing` to `.cache/web/landing` and `oauth/consent` to `.cache/web/oauth/consent`.

## 5. Vendor globals

`shared/vendor` and `scripts/build-shared/build.mjs` produce scripts that set these `window` globals. Pages read them by name.

| Global | Set by | Read by |
| --- | --- | --- |
| `LuluBoardSupabaseConfig` | `scripts/build-shared/build.mjs` | `workspace/src/cloud/cloud-sync.js`, `oauth/consent/consent.js` |
| `LuluBoardSupabase` | `shared/vendor/supabase-client.js` | `workspace/src/cloud/cloud-sync.js`, `oauth/consent/consent.js` |
| `LuluBoardSentryConfig` | `scripts/build-shared/build.mjs` | `shared/vendor/sentry-client.js` |
| `Sentry` | `shared/vendor/sentry-client.js` | `workspace/src/core/sentry-count.js`, `landing/landing.js` |

A page that loads a `-client.js` script loads the matching `-config.js` script first.
