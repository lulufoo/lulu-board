/** Serialize mindmap AST back to Mermaid mindmap source. */

function formatNodeLine(node) {
  // Shape syntax removed from Drawer mindmaps — plain labels only.
  const label = String(node.label || "Topic").replace(/\n/g, " ");
  return label;
}

function walk(node, depth, lines) {
  const indent = "  ".repeat(depth);
  lines.push(indent + formatNodeLine(node));
  (node.children || []).forEach((c) => walk(c, depth + 1, lines));
}

export function serializeMindmap(root) {
  if (!root) return "mindmap\n";
  const lines = ["mindmap"];
  walk(root, 1, lines);
  return lines.join("\n") + "\n";
}

export function findNodeById(root, id) {
  if (!root) return null;
  const want = Number(id);
  let found = null;
  (function walk(n) {
    if (found) return;
    if (n.id === want) found = n;
    else (n.children || []).forEach(walk);
  })(root);
  return found;
}

export function findParent(root, id) {
  const want = Number(id);
  let parent = null;
  (function walk(n) {
    if (parent) return;
    (n.children || []).forEach((c) => {
      if (c.id === want) parent = n;
      else walk(c);
    });
  })(root);
  return parent;
}

export function reassignIds(root) {
  let next = 0;
  (function walk(n, depth) {
    n.id = next++;
    n.depth = depth;
    (n.children || []).forEach((c) => walk(c, depth + 1));
  })(root, 0);
  if (root) {
    root.section = -1;
    (root.children || []).forEach((child, index) => {
      (function assign(n, section) {
        n.section = section;
        (n.children || []).forEach((c) => assign(c, section));
      })(child, index);
    });
  }
  return root;
}
