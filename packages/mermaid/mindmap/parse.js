/** Parse Mermaid mindmap indent syntax → tree AST (SSOT shape for layouts). */

import { attachPaths } from "./source.js";

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function detectShape(raw) {
  const t = String(raw || "").trim();
  if (/^\(\((.+)\)\)$/.test(t)) return { shape: "circle", label: RegExp.$1.trim() };
  if (/^\((.+)\)$/.test(t)) return { shape: "rounded", label: RegExp.$1.trim() };
  if (/^\[(.+)\]$/.test(t)) return { shape: "rect", label: RegExp.$1.trim() };
  if (/^\{(.+)\}$/.test(t)) return { shape: "hex", label: RegExp.$1.trim() };
  if (/^\)(.+)\($/.test(t)) return { shape: "cloud", label: RegExp.$1.trim() };
  if (/^\](.+)\[$/.test(t)) return { shape: "bang", label: RegExp.$1.trim() };
  let m = t.match(/^([A-Za-z0-9_-]+)\(\((.+)\)\)$/);
  if (m) return { shape: "circle", label: m[2].trim(), idHint: m[1] };
  m = t.match(/^([A-Za-z0-9_-]+)\[(.+)\]$/);
  if (m) return { shape: "rect", label: m[2].trim(), idHint: m[1] };
  m = t.match(/^([A-Za-z0-9_-]+)\((.+)\)$/);
  if (m) return { shape: "rounded", label: m[2].trim(), idHint: m[1] };
  return { shape: "default", label: t };
}

/**
 * @returns {{ root: object, errors: string[] }}
 */
export function parseMindmap(source) {
  const errors = [];
  const lines = stripBom(source).split(/\r?\n/);
  let started = false;
  const stack = [];
  let root = null;
  let nextId = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("%%")) continue;
    if (!started) {
      if (/^\s*mindmap\b/i.test(raw)) {
        started = true;
        continue;
      }
      continue;
    }
    const indent = raw.match(/^\s*/)[0].length;
    const body = raw.trim();
    if (!body) continue;
    const meta = detectShape(body);
    const node = {
      id: nextId++,
      label: meta.label,
      shape: meta.shape,
      idHint: meta.idHint || null,
      children: [],
      depth: 0,
      section: -1,
    };
    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    if (!stack.length) {
      if (root) {
        errors.push("Multiple roots; treating as sibling under synthetic root");
        root.children.push(node);
        node.depth = 1;
        stack.push({ indent, node });
        continue;
      }
      root = node;
      node.depth = 0;
      node.section = -1;
      stack.push({ indent, node });
      continue;
    }
    const parent = stack[stack.length - 1].node;
    parent.children.push(node);
    node.depth = parent.depth + 1;
    stack.push({ indent, node });
  }

  if (!started) errors.push("Missing mindmap header");
  if (!root) errors.push("Empty mindmap");

  if (root) {
    root.children.forEach((child, index) => {
      const assign = (n, section) => {
        n.section = section;
        (n.children || []).forEach((c) => assign(c, section));
      };
      assign(child, index);
    });
    attachPaths(root);
  }

  return { root, errors };
}
