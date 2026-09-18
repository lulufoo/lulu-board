<p align="center">
  <img src="docs/readme/logo.png" width="160" alt="Lulu Drawer" />
</p>

<h1 align="center">Lulu Board</h1>

<p align="center"><b>Structured whiteboard. A way to collaborate visually with AI.</b></p>

<p align="center">
  <a href="https://luluboard.app/">luluboard.app</a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" align="absmiddle"></a>
</p>

---

One text protocol for boards — the AI agent writes it, Lulu Board draws it, you work on the canvas; both stay in sync. A local loop.

| Mode | Product | Source ID |
|---|---|---|
| Board | **Lulu Board** — structured whiteboard text | BMD (`b_…`) |

## Why

Diagrams go stale when only one side can edit them. Lulu Board keeps one text protocol as the source of truth: the agent writes it, you refine it on the canvas (or in Source), and both stay in sync.

## Quick start

Install the **Lulu Board** Cursor plugin (this public repo; plugin body is [`skill/`](./skill/)), then in chat:

```text
/board
```

The Drawer opens on a built-in template — the onboarding board — so you can see the loop right away:

<p align="center">
  <a href="./examples/board-onboarding/onboarding.bmd">
    <img src="./examples/board-onboarding/onboarding.png" alt="Board · Onboarding" width="720" />
  </a>
</p>

<p align="center"><strong>Onboarding</strong> — AI writes. Lulu Board draws. You work on the canvas.</p>

**Source** (`<>`) → **History** to browse the built-in templates. New files are stored there too.

## Draw from a prompt

Describe what you want after `/board`:

```text
/board Draw an Android MVI architecture diagram for me.
```

The agent authors the source and opens the Drawer. From there you can drag and edit on the canvas, change Source by hand, or ask again — same document, shared with the agent.

A signed-in owner can share a saved cloud board from the Share dock. The first audience is All, with View or Edit. Anyone with the `#s:` link can open the current board; Edit lets a signed-in visitor change that same row. ✅ Verified (`packages/drawer-app/js/06-cloud-share.js`, `lulu-dev-skills/docs/archive/lulu-board/supabase/migrations/20260918143300_share_access_role.sql`)

<p align="center">
  <a href="./examples/board-android-mvi/android-mvi-architecture.bmd">
    <img src="./examples/board-android-mvi/android-mvi-architecture.png" alt="Board · Android MVI" width="720" />
  </a>
</p>

<p align="center"><strong>Board · Android MVI</strong> — ask in chat, see it in Drawer, edit on canvas or in Source</p>

## MCP configuration

`/board` works without MCP: the agent opens an unsigned `#z:` link. To create and update the latest cloud board for your account, add the hosted MCP and Connect.

```json
{
  "mcpServers": {
    "lulu-board": {
      "url": "https://mcp.luluboard.app/mcp"
    }
  }
}
```

In Cursor, open **Settings → Tools & MCP**. Add that URL if `lulu-board` is not listed, then **Connect** and approve sign-in. After the `whoami` tool is listed, `/board` writes `https://luluboard.app/#b:…` instead of `#z:`. Installing the plugin is not Connect.

## Examples

Click a preview to open the source.

### Board

<table>
  <tr>
    <td valign="top" align="center">
      <a href="./examples/board-llm-architecture/llm-architecture.bmd">
        <img src="./examples/board-llm-architecture/llm-architecture.png" alt="Board · LLM Architecture" />
      </a>
      <p>
        <strong>LLM Architecture</strong><br />
        Agent stack from data through training
      </p>
    </td>
  </tr>
</table>

## Install

Ship **`skill/`** as the Cursor plugin body. Chat entry is `/board`.

```text
.cursor-plugin/marketplace.json   # repo marketplace; source: skill
skill/
  .cursor-plugin/plugin.json      # name: lulu-board; skills: board
  board/     # self-contained /board (SKILL.md, scripts/, templates/)
```

Do not ship `packages/`, `scripts/*-build/`, or `tests/`.

Local test: copy `skill/` to `~/.cursor/plugins/local/lulu-board` (do not symlink out of that folder), then Developer: Reload Window.

## Develop

```text
examples/    # README previews (source + PNG) → packed into skill/board/templates
packages/    # board, drawer-app
scripts/     # build tooling
skill/       # plugin root
tests/
.cache/web/  # generated public viewer (✅ Verified: scripts/web-build/build.mjs)
```

From the repo root:

```bash
node scripts/web-build/build.mjs
# or pack examples alone:
node scripts/examples-templates-build/build.mjs
```

## License

- Project: [MIT](./LICENSE)
- Vendored: [THIRD_PARTY.md](./THIRD_PARTY.md)
