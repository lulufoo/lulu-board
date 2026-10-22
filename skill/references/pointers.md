# Pointers

Shared viewer-link grammar for Board and Mermaid. Load when a pasted link
must be read, or when pointer kind changes the next action.

| Prefix | Meaning | Who assembles |
|---|---|---|
| `#z:` | Unsigned source envelope | CLI `preview` |
| `#b:` | Owned cloud row | MCP return `url` |
| `#s:` | Share pointer | Browser share; MCP does not write it this round |

`preview` encodes `{bmd, version}` into `#z:`. CLI preview never mints `#b:`.

## `#b:`

Shape: `https://<host>/#b:<diagram_id>`.

`<diagram_id>` is `b_` plus 8 lowercase hex. That token is MCP `diagram_id`.

From a pasted cloud link: take the token after `#b:`. Pass it as `diagram_id`.

## `#z:`

CLI `preview` returns the full URL. Show that `url`. Do not `create_diagram` or
`save_diagram`.

## `#s:`

Shape: `https://<host>/#s:<share_id>`. Format only this round.
