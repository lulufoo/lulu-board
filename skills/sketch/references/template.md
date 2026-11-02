# Template

## Fragment

The fragment is the diagram.
The diagram is one 16:9 slide. Keep it landscape.

1. Contains `<style>` and markup.
2. Excludes `<!doctype>`, `<html>`, `<head>`, and `<body>`.
3. Excludes `<iframe>`, `<object>`, `<embed>`, and `<link>`. Board removes them before mounting. Put CSS in `<style>`.

## Environment

Fit the Board environment.

### Theme

The sketch follows the Board theme.

1. Use the reference variables, or choose colors that sit with them, so the sketch fits the Board environment.
2. The variables are Board's Light and Dark, in the block below.
3. `diagram` has two themes, selected with `html[data-appearance="dark"]`.
4. The runner sets `data-appearance` on `<html>` before inserting the fragment. When it is absent, the variables are Light. A script reads `document.documentElement.dataset.appearance`.

### Click

A sketch that reacts to clicks must work in both modes.

1. `data-sketch-mode` on `<html>` is `canvas` or `present`; absent means `canvas`. The runner sets it before mounting. On each switch it sets it again and fires `lulu-sketch-mode` on `document`.
2. In `canvas`, no click arrives. Show all content without one. A sequence that steps on click plays on its own.
3. In `present`, clicks arrive and add to what `canvas` shows. Show click cues (buttons, hints, `cursor: pointer`) only here.
4. On `lulu-sketch-mode`, update the sketch to the new mode. Leaving `present` clears every click state.

## Board

Write from this block. Replace the part between the markers.

```html
<style>
  :root {
    /* product */
    --board-brand: #db4c84;
    /* workspace ground */
    --board-ground: #fff;
    /* ground dot */
    --board-dot: #dfe7ea;
    /* ink */
    --board-ink: #4a3524;
    /* fill */
    --board-fill: #f3ede2;
  }

  html[data-appearance="dark"] {
    --board-brand: #db4c84;
    --board-ground: #14110e;
    --board-dot: #29241f;
    --board-ink: #f7efe4;
    --board-fill: #322a22;
  }
</style>

<!-- diagram: replace from here -->
<style>
  .diagram {
    width: 360px;
  }

  html[data-appearance="dark"] .diagram {
  }
</style>
<div class="diagram"></div>
<!-- diagram: replace through here -->
```
