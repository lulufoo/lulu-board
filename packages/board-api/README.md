# lulu-board-api

Cloudflare Worker for owned-graph create (LB-532).

`GET /health` returns `ok`.

`POST /graphs` takes a Supabase user JWT and a JSON body:

```json
{ "bmd": "boxes \"Fresh\"\n", "diagram_id": "b_aabbccdd", "group_id": "g_11223344" }
```

`diagram_id` and `group_id` are optional. The Worker extracts `search_text` from `bmd` and calls `create_owned_graph` with that user JWT.

```bash
cd packages/board-api
npx wrangler dev
```

The public host is `https://api.luluboard.app`. `GET /health` and `POST /graphs` are served there. The route is `api.luluboard.app` in `wrangler.toml`, the same custom-domain pattern as `mcp.luluboard.app`.

`SUPABASE_PUBLISHABLE_KEY` is a Worker secret. `SUPABASE_URL` is in `wrangler.toml`.
