# lulu-board-api

Bare Cloudflare Worker scaffold (LB-531). Health only; no business logic yet.

```bash
cd packages/board-api
npx wrangler dev
# then: curl http://127.0.0.1:8787/health
```

Deploy / Builds wiring is done in the Cloudflare dashboard (same pattern as `lulu-board-mcp`).
