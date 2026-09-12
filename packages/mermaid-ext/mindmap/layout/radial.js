/**
 * Center-radiating balanced layout (Map).
 * Root center; main branches split left/right; subtrees stack with even gaps.
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

function placeSide(nodes, side, root, gapX, gapY) {
  const totalH = nodes.reduce((acc, n, i) => acc + subtreeHeight(n, gapY) + (i ? gapY : 0), 0);
  let y = root.y - totalH / 2;

  function place(node, x, yTop) {
    const h = subtreeHeight(node, gapY);
    node.x = x;
    node.y = yTop + h / 2;
    if (!node.children || !node.children.length) return;
    let cy = yTop;
    const childX = x + side * (node.width / 2 + gapX + node.children[0].width / 2);
    node.children.forEach((child, i) => {
      const ch = subtreeHeight(child, gapY);
      if (i) cy += gapY;
      place(child, childX, cy);
      cy += ch;
    });
  }

  nodes.forEach((node, i) => {
    const h = subtreeHeight(node, gapY);
    if (i) y += gapY;
    const x = root.x + side * (root.width / 2 + gapX + 36 + node.width / 2);
    place(node, x, y);
    y += h;
  });
}

export function layoutRadial(root, opts) {
  const gapX = (opts && opts.gapX) || 42;
  const gapY = (opts && opts.gapY) || 22;
  const pad = (opts && opts.pad) || 36;
  if (!root) return { nodes: [], edges: [], width: 0, height: 0, pad, layout: "radial" };

  root.x = 0;
  root.y = 0;

  const kids = root.children || [];
  // Balance: alternate into right/left for more even Map feel
  const right = [];
  const left = [];
  kids.forEach((k, i) => ((i % 2 === 0 ? right : left).push(k)));
  placeSide(right, 1, root, gapX, gapY);
  placeSide(left, -1, root, gapX, gapY);

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

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.width / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  });
  const ox = -minX + pad;
  const oy = -minY + pad;
  nodes.forEach((n) => {
    n.x += ox;
    n.y += oy;
  });

  return {
    nodes,
    edges,
    width: Math.ceil(maxX - minX + pad * 2),
    height: Math.ceil(maxY - minY + pad * 2),
    pad,
    layout: "radial",
  };
}
