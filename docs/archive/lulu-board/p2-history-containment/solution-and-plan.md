# P2 History Containment

## Solution

✅ Verified (`packages/board/box/board-box.js`): `fitNested()` calculates an 888px minimum width for the History row after its link slots grow.

✅ Verified (browser measurement, 2026-09-17): the History frame is reset to 833px by sibling equalization, leaving its final child 25px outside the frame.

⚠️ Inferred: preserve a nested box's content-width floor while equalizing siblings, then fit nested boxes from leaves to roots before applying root frames.

✅ Verified (browser measurement, 2026-09-17): `P2_CHECK` has a 0px flex width in its row parent, so its 136px diamond overlay is covered by the following outcomes layout.

⚠️ Inferred: only use the stretched host treatment when a column parent's cross-axis stretches the diamond width; a row parent's stretch applies to height and must retain the diamond's measured width.

✅ Verified (browser measurement, 2026-09-17): `P2_CURRENT` has 30px left padding and 62px right empty space after sibling width equalization.

✅ Verified (browser measurement, 2026-09-17): `justify stretch` expands the row's max-content cards and overflows `P2_CURRENT` by 54px.

⚠️ Inferred: use a `between` justification mode to distribute only surplus row space, preserving card widths and equal outer padding.

⚠️ Inferred: add a developer-only local renderer that binds to `127.0.0.1`, serves `web/`, and optionally opens a hash-encoded BMD.

## Plan

⚠️ Inferred: retain the measured content floor during equalization and run containment in post-order so parent boxes see their fitted children.

⚠️ Inferred: add a regression test for the floor preservation and verify the target board in a rebuilt local viewer.

⚠️ Inferred: distinguish row and column parent directions when applying a nested diamond's width.

⚠️ Inferred: add `justify P2_CURRENT between`, then verify equal side padding in the rebuilt viewer.

⚠️ Inferred: expose local renderer options through `--help` and close its server on process termination.
