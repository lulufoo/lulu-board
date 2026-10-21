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

function matchTitleLine(line) {
  return /^%%\s*title\s*:?\s*(.*)$/i.exec(String(line || "").trim());
}

export function getTitle(source) {
  const lines = String(source || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const hit = matchTitleLine(lines[i]);
    if (hit) return String(hit[1] || "").replace(/^["']|["']$/g, "").trim();
  }
  return "";
}

export function updateTitle(source, title) {
  const name = String(title == null ? "" : title).replace(/[\r\n]/g, " ").trim();
  const lines = String(source == null ? "" : source).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let found = -1;
  for (let i = 0; i < lines.length; i++) {
    if (matchTitleLine(lines[i])) {
      found = i;
      break;
    }
  }
  if (!name) {
    if (found >= 0) lines.splice(found, 1);
    return { source: lines.join("\n") };
  }
  const next = "%% title " + name;
  if (found >= 0) {
    lines[found] = next;
    return { source: lines.join("\n") };
  }
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    const trim = String(lines[i] || "").trim();
    if (!trim || trim.indexOf("%%") === 0 || trim.charAt(0) === "#") continue;
    if (/^---/.test(trim)) continue;
    if (/^mindmap\b/i.test(trim)) {
      at = i;
      break;
    }
  }
  lines.splice(at, 0, next);
  return { source: lines.join("\n") };
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
