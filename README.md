<p align="center">
  <img src="docs/readme/logo.png" width="160" alt="Lulu Drawer" />
</p>

<h1 align="center">Lulu Board</h1>

<p align="center"><b>One text protocol. AI agent writes it. Lulu Board draws it. You work on the canvas.</b></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
</p>

---

One text protocol for boards — the AI agent writes it, Lulu Board draws it, you work on the canvas; both stay in sync. A local loop.

| Mode | Product | Source ID |
|---|---|---|
| Board | **Lulu Board** — structured whiteboard text | BMD (`b_…`) |

## Why

Diagrams go stale when only one side can edit them. Lulu Board keeps one text protocol as the source of truth: the agent writes it, you refine it on the canvas (or in Source), and both stay in sync.

## Quick start

Install **only** the [`skill/`](./skill/) folder (not this whole repo) into your agent skills path, then in chat:

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

<p align="center">
  <a href="./examples/board-android-mvi/android-mvi-architecture.bmd">
    <img src="./examples/board-android-mvi/android-mvi-architecture.png" alt="Board · Android MVI" width="720" />
  </a>
</p>

<p align="center"><strong>Board · Android MVI</strong> — ask in chat, see it in Drawer, edit on canvas or in Source</p>

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

Ship **`skill/`** only:

```text
skill/
  SKILL.md                 # agent entry
  board/                   # /board skill (+ references/viewer.md)
  assets/                  # viewer + History templates
  scripts/                 # drawer_control CLI
```

Do not install the monorepo root. `packages/`, `scripts/*-build/`, and `tests/` are for development.

## Develop

```text
examples/    # README previews (source + PNG) → packed into skill/assets/templates
packages/    # board, drawer-app
scripts/     # build tooling
skill/       # install root
tests/
```

From the repo root:

```bash
node scripts/drawer-app-build/build.mjs
node scripts/board-build/build.mjs
# or pack examples alone:
node scripts/examples-templates-build/build.mjs
```

## License

- Project: [MIT](./LICENSE)
- Vendored: [THIRD_PARTY.md](./THIRD_PARTY.md)
