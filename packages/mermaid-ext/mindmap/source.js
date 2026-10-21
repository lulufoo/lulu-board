/** Serialize mindmap AST back to Mermaid mindmap source. */

function formatNodeLine(node) {
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

export function attachPaths(root) {
  if (!root) return root;
  (function walkPath(n, path) {
    n.path = path.slice();
    (n.children || []).forEach((c, i) => walkPath(c, path.concat(i)));
  })(root, []);
  return root;
}

export function topicKey(path) {
  return "topic:" + (path || []).join(".");
}

export function findNodeById(root, id) {
  if (!root) return null;
  const want = Number(id);
  let found = null;
  (function walkId(n) {
    if (found) return;
    if (n.id === want) found = n;
    else (n.children || []).forEach(walkId);
  })(root);
  return found;
}

export function findNodeByPath(root, path) {
  if (!root || !Array.isArray(path)) return null;
  let n = root;
  for (let i = 0; i < path.length; i += 1) {
    n = (n.children || [])[path[i]];
    if (!n) return null;
  }
  return n;
}

function parsePath(ref) {
  if (Array.isArray(ref)) return ref.map(Number);
  if (ref === "" || ref === "/") return [];
  if (typeof ref === "string" && /^\d+(\.\d+)*$/.test(ref) && ref.indexOf(".") >= 0) {
    return ref.split(".").map(Number);
  }
  return null;
}

export function findNodeByRef(root, ref) {
  if (!root) return null;
  if (ref == null || ref === "") return root;
  const path = parsePath(ref);
  if (path) return findNodeByPath(root, path);
  return findNodeById(root, ref);
}

export function findParent(root, id) {
  const want = Number(id);
  let parent = null;
  (function walkParent(n) {
    if (parent) return;
    (n.children || []).forEach((c) => {
      if (c.id === want) parent = n;
      else walkParent(c);
    });
  })(root);
  return parent;
}

export function reassignIds(root) {
  let next = 0;
  (function walkIds(n, depth) {
    n.id = next++;
    n.depth = depth;
    (n.children || []).forEach((c) => walkIds(c, depth + 1));
  })(root, 0);
  if (root) {
    root.section = -1;
    (root.children || []).forEach((child, index) => {
      (function assign(n, section) {
        n.section = section;
        (n.children || []).forEach((c) => assign(c, section));
      })(child, index);
    });
    attachPaths(root);
  }
  return root;
}
