/* Board colour rotation — the only colour rule.
   A theme is one list of fills. Children of one parent take colours from the list in order, one by one (rotation).
   A child's list index stays at least GAP away from its filled parent's index: parent x blocks x-1, x and x+1
   (linear, no wrap-around); blocked indexes are skipped, the rest keep rotating.
   container / layout are transparent: they use no index, and their children start a fresh group with no parent
   (so they may match the filled box outside the container). */

const GAP = 2;

function isItem(node) { return !!(node && (node.role === 'item' || node.kind === 'item')); }
function readType(node) { return String((node && (node.type || node.kind)) || (isItem(node) ? 'chip' : 'card')); }

// Which nodes carry their own fill. container / layout are transparent; note, text and icon keep their look.
function isFillable(node) {
  const t = readType(node);
  return isItem(node) ? (t === 'chip' || t === 'item') : (t === 'card' || t === 'box' || t === 'diamond');
}

// List indexes a child may take under a parent index (null = no parent, every index is allowed).
function listAllowed(size, parentIdx) {
  const out = [];
  for (let i = 0; i < size; i++) {
    if (parentIdx == null || Math.abs(i - parentIdx) >= GAP) out.push(i);
  }
  if (out.length) return out;
  // list too short to keep the gap: any index but the parent's own
  for (let i = 0; i < size; i++) if (i !== parentIdx) out.push(i);
  return out.length ? out : [0];
}

// Index for the k-th filled child of one parent (k counts from 0; rotation over the allowed indexes).
function pickIndex(size, parentIdx, k) {
  const list = listAllowed(Math.max(1, size | 0), parentIdx);
  return list[((k % list.length) + list.length) % list.length];
}

/**
 * Resolve the colour of every filled node: Map(node -> { idx, color }).
 * colors: the theme list of fills.
 */
function resolve(board, colors) {
  const out = new Map();
  const list = Array.isArray(colors) ? colors : [];
  if (!list.length) return out;
  function visitKids(parent, parentIdx) {
    const kids = Array.isArray(parent.kids) ? parent.kids : (parent.items || []).concat(parent.boxes || []);
    let k = 0;
    kids.forEach((kid) => {
      if (isFillable(kid)) {
        const idx = pickIndex(list.length, parentIdx, k++);
        out.set(kid, { idx, color: list[idx] });
        visitKids(kid, idx);
      } else {
        visitKids(kid, null);
      }
    });
  }
  visitKids({ kids: board.views || board.boxes || [] }, null);
  return out;
}

/**
 * Paint a mounted node with its colour. Rect fills go inline with !important (they must beat the per-type rules);
 * a diamond face is an SVG path, so it gets a CSS variable that 04-board-form.css reads.
 */
function paint(el, info, diamond) {
  if (!el || !info || !info.color) return;
  el.dataset.bfFill = String(info.idx);
  if (diamond) el.style.setProperty('--bf-fill', info.color);
  else el.style.setProperty('background', info.color, 'important');
}

export { GAP, isFillable, listAllowed, pickIndex, resolve, paint };
