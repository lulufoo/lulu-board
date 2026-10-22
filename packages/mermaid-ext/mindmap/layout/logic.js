/**
 * Left-to-right logic tree.
 * Root on the left; children refine rightward; siblings stack with even gaps.
 */

function subtreeHeight(node, gapY) {
  if (!node.children || !node.children.length) return node.height;
  let sum = 0;
  node.children.forEach((c, i) => {
    sum += subtreeHeight(c, gapY);
    if (i) sum += gapY;
  });
  return Math.max(node.height, sum);
}

function place(node, x, yTop, gapX, gapY) {
  const h = subtreeHeight(node, gapY);
  node.x = x + node.width / 2;
  node.y = yTop + h / 2;
  if (!node.children || !node.children.length) return;
  let cy = yTop;
  const childX = x + node.width + gapX;
  node.children.forEach((child, i) => {
    const ch = subtreeHeight(child, gapY);
    if (i) cy += gapY;
    place(child, childX, cy, gapX, gapY);
    cy += ch;
  });
}

export function layoutLogic(root, opts) {
  const gapX = (opts && opts.gapX) || 72;
  const gapY = (opts && opts.gapY) || 20;
  const pad = (opts && opts.pad) || 36;
  if (!root) return { nodes: [], edges: [], width: 0, height: 0, pad, layout: "logic" };

  const h = subtreeHeight(root, gapY);
  place(root, pad, pad, gapX, gapY);

  const nodes = [];
  const edges = [];
  function walk(node, depth) {
    nodes.push(node);
    (node.children || []).forEach((child) => {
      edges.push({ from: node, to: child, depth, section: child.section });
      walk(child, depth + 1);
    });
  }
  walk(root, 0);

  let maxX = 0, maxY = 0;
  nodes.forEach((n) => {
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  });

  return {
    nodes,
    edges,
    width: Math.ceil(maxX + pad),
    height: Math.ceil(Math.max(maxY, h + pad) + pad),
    pad,
    layout: "logic",
  };
}
