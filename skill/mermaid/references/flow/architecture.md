# architecture

Keyword: `architecture-beta` (detector also accepts `architecture`).
Invariant: groups, services, and side-to-side edges (`L`/`R`/`T`/`B`).
Titles in `[…]` are letters and spaces only — no `.` or `-` (`mermaid.ts` / `diagram-api` fail parse).

## minimal

```mermaid
architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service web(server)[Web] in api
  db:L -- R:web
```
