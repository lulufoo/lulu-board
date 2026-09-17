# Phase 2 Web Auth Sync

First-slice plan only: website sign-in and one latest cloud copy per board. No implementation in this document.

## Locks

✅ Verified (this conversation `/converge`, 2026-09-17):

| Item | Choice |
|---|---|
| Hosting | Cloudflare Worker static assets + Supabase Auth / Postgres |
| First slice | Website only. No CLI sync |
| Cloud History | One row per `b_…` id. Later save overwrites |
| Conflict | No detection. The save that runs wins |
| Sign-in | Google and GitHub only. Email / SMTP later |
| CLI session | Deferred to the CLI slice |

✅ Verified (earlier `/converge` in this conversation): unsigned open stays on the `#z:` hash. Domain is `luluboard.app`.

## Solution

✅ Verified (`scripts/web-build/build.mjs`): the public site is generated into `.cache/web/` as a static page. Persistence is `data-persist="hash"`. Unsigned boards live in `#z:` and never hit a backend.

✅ Verified (`skill/board/scripts/drawer_ctl/util.py`): BMD id is `b_` + 8 hex chars.

✅ Verified (repo search, 2026-09-17): the repo has no Supabase client, no Auth UI, and no `/b/` route.

✅ Verified ([Supabase API keys](https://supabase.com/docs/guides/api/api-keys), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)): the browser keeps the publishable/anon key plus the user JWT. Postgres RLS, not the site server, enforces owner-only access.

⚠️ Inferred: store the signed-in copy in one Postgres table, not Storage. BMD is small text and must be listed, keyed by id, and filtered by `owner_id`.

```text
boards
  owner_id   uuid not null      -- auth.users.id
  board_id   text not null      -- b_ + 8 hex
  title      text
  bmd        text not null
  updated_at timestamptz
  primary key (owner_id, board_id)
```

✅ Verified (`supabase/migrations/20260917160000_create_boards.sql`): RLS constrains select, insert, update, and delete to `owner_id = auth.uid()`.

⚠️ Inferred: first-slice cloud open uses `#b:<id>` on the same static page. `#z:` stays unsigned. A path route is unnecessary for this slice.

```text
unsigned:  https://luluboard.app/#z:…
signed:    https://luluboard.app/#b:b_29b9c39c
```

⚠️ Inferred: the site orchestrates only. The Cloudflare Worker serves static assets and holds no user data. The browser session stays in `supabase-js` localStorage. Local SKILL History stays in `~/.cache/board/history` and is not read by the website.

## Plan

1. Operator connects the existing `lulu-board` Cloudflare Worker to Git builds. Its `wrangler.toml` names `lulu-board` and uploads `.cache/web/`; the build command installs `scripts/board-build` dependencies before generating `.cache/web/`.
2. Operator creates a Free Supabase project and enables Google + GitHub. Redirect URL is `https://luluboard.app/`. The publishable key is frontend-only. The service key never ships in `.cache/web/`.
3. Add the `boards` table and owner-only RLS. The primary key is `(owner_id, board_id)`, allowing different accounts to retain copies with the same `b_…` id.
4. Add `supabase-js` to the public viewer. Sign in / Sign out / callback. Restore session on load. Product copy stays English.
5. When signed in, Save upserts the current board by `b_…`. History lists that user's rows by `updated_at`. Opening a row sets `#b:<id>` and loads `bmd`.
6. Keep `#z:` working with no Auth call. Unsigned History stays the SKILL cache tooltip, not the cloud list.
7. Add a strict CSP so XSS cannot read the browser session.
8. Stop. Email/SMTP, conflict UI, version snapshots, `/b/<id>`, and CLI device login are out of this slice.

## Out of scope

- Terminal login and `~/.cache/board/history` upload
- Email confirmation and custom SMTP
- Conflict prompts and board version history
- Sharing (phase 3)
- Deploy / push unless the user asks
