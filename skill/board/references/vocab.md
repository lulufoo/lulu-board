# Board protocol beta — vocabulary

A Board document has an envelope plus these layers:

| Layer | Syntax | Purpose |
|---|---|---|
| Envelope | `meta <base64>` | Stash; omit when minting; leave unchanged |
| Structure | `board`, `box`, `item` | Define nodes and containment |
| Style | `style <base64>` | Stash; omit when minting; leave unchanged |
| Relation | `A -> B`, `A <-> B` | Connect nodes semantically |
| Layout | `layout` | Position nodes (`arrange`, `flush`, `pin`) |

## Common syntax

- The first drawing statement is `board "<title>"`; one document contains one board.
- IDs match `[A-Za-z_][A-Za-z0-9_.-]*` and are unique across boxes and id’d items.
  These are node IDs inside BMD Source. They are not the Drawer BMD ID (`b_…`).
- Canonical output uses double-quoted strings. Write `\n` inside a string for a line break.
- Keywords and IDs are ASCII; labels may use any language.
- Blank lines and lines beginning with `#` or `//` are ignored.

## Structure

### Nodes

| Node | Syntax | Meaning |
|---|---|---|
| Board | `board "<title>"` | Document root and canvas title |
| Box | `box <id> [type <box-type>] [<n>] ["<title>"]` | Container; indentation defines nesting |
| Item | `item [<id>] [type <item-type>] [shape …] [cap off] <body>` | Leaf inside a box or at board level |

- Indent box children by two spaces.
- A box always has an ID. Give a board-level item an ID.
- `<n>` is an optional box-face icon from [icons.json](../common/icons.json).
- `layout` boxes have no title or icon.

### Box types

| Type | Meaning | Default |
|---|---|---|
| `card` | Visible content card | yes; omit `type card` |
| `container` | Transparent group with a dashed border | |
| `layout` | Invisible arrangement-only group | |

Use `container` for visible grouping and `layout` for arrangement without a frame.

### Item types

| Type | Body | Meaning | Default |
|---|---|---|---|
| `chip` | `[shape …] [cap off] "<markdown>"` | Framed leaf | yes; omit `type chip` |
| `text` | `[cap off] "<markdown>"` | Unframed text | |
| `note` | `[cap off] "<markdown>"` | Dog-eared note | |
| `icon` | `<n> ["<caption>"]` | Icon leaf from [icons.json](../common/icons.json) | |

`shape` is chip-only and chooses the frame.

- `rect` — default; omit `shape rect`
- `diamond` — rhombus

`cap` is chip/text/note only and chooses whether Drawer limits reading width.

- `on` — default; omit `cap on`
- `off` — no max-width

`chip`, `text`, and `note` share this markdown subset:

- headings (`#`–`###`), ordered and unordered lists, bold, italic, inline code, and `\n`

### icon `<n>`

`icon` takes `<n>` from [icons.json](../common/icons.json).

- pick `n` from `sections[].icons[]`
- `gloss` is the meaning; the section is the category
- write three digits (`1` becomes `001`)
- the first digit matches the parent section `digit`

## Relation

Use IDs as endpoints:

```text
<from> -> <to> [type solid|dashed] [title "<label>"]
<from> <-> <to> [type solid|dashed] [title "<label>"]
```

| Operator | Arrows | Default |
|---|---|---|
| `->` | End only | yes |
| `<->` | Both ends | |

| Type | Stroke | Default |
|---|---|---|
| `solid` | Solid | yes; omit `type solid` |
| `dashed` | Dashed | |

`title` is optional free text. Relations express meaning; they do not position
nodes.

## Layout

Put layout statements under one `layout` section. Layout is constraints:
`arrange` / `flush` relate nodes; `pin` binds two edges of nodes or of the
`parent` frame.

Every layout statement starts with a keyword. Keywords are lowercase; IDs are
uppercase by convention. Several ids that share a value may be listed in one
statement.

Without ids, `direction` / `align` / `justify` set the board itself. The board
defaults to `direction row` with gap 32 and padding 24: top-level boxes flow
left to right. A horizontal `arrange` or any `pin` turns that flow off; only
the stated constraints place nodes from then on.

### Inside a box

These properties arrange a box’s children.

```text
direction <box-id>, <box-id>… row|column
align <box-id>, <box-id>… start|center|stretch
justify <box-id>, <box-id>… start|center|stretch
```

| Property | Meaning | Default |
|---|---|---|
| `direction` | Children’s main axis | `column` |
| `align` | Children on the cross axis | `stretch` |
| `justify` | Children on the main axis | `start` |

`stretch` grows children to fill leftover space on that axis. Diamond chips
keep their intrinsic size.

Omit a statement when it only restates the default.

### On the board

These statements place top-level nodes relative to one another or to the board
frame. Draft with `arrange` and `flush`; pin only where an exact distance
carries meaning.

#### arrange

```text
arrange <id> after|before|left-of|right-of|above|below <id>[, <id>…]
```

Places one node beside the union of its targets, one board gap away.
`right-of` / `left-of` also align `top` with the target; `below` / `above`
with a single target also align `start`. `after` / `before` only order along
the axis.

#### flush

```text
flush <id>, <id>[, <id>…] start|end|top|bottom
```

Lines up nodes on a shared edge. Pair `top` with `bottom` on the same ids to
stretch them to the tallest.

#### pin

```text
pin <id>.<edge> to <id|parent>.<edge> [N]
```

Binds two edges. `edge` is `start`, `end`, `top`, or `bottom`; `parent` is the
board frame. `N` is the distance between the edges, negative allowed; omit it
when they meet.

Pin `start` and `top` to `parent` to place a node; add `end` or `bottom` to fix
its size. A pin wins over `arrange` on its axis. Dragging a node on the canvas
rewrites it as `parent` pins and drops its `arrange` lines.

## Protocol boundary

Author structure, relations, and layout. A `meta <base64>` or
`style <base64>` line is stash: omit when minting; leave it unchanged if
present; do not add, decode, or edit it.

Position and size live only in `layout`. Node-line `x` / `y` / size fields
and freehand drawing stay out of this protocol.
