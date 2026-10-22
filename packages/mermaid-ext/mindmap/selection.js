/** Hit-test mindmap SVG topics. Identity is the tree path, not the label. */

import { topicKey } from "./source.js";

function parsePathAttr(raw) {
  if (raw == null || raw === "") return [];
  const parts = String(raw).split(".").filter((p) => p !== "");
  const path = parts.map(Number);
  if (path.some((n) => !Number.isFinite(n))) return null;
  return path;
}

export function selectionFromDom(target) {
  if (!target || !target.closest) return null;
  const g = target.closest("g.mindmap-node");
  if (!g) return null;
  const path = parsePathAttr(g.getAttribute("data-path"));
  if (!path) return null;
  const idAttr = g.getAttribute("data-id");
  const id = idAttr == null || idAttr === "" ? null : Number(idAttr);
  const labelEl = g.querySelector("text");
  const label = labelEl ? labelEl.textContent : "";
  return {
    kind: "topic",
    id: Number.isFinite(id) ? id : null,
    path,
    key: topicKey(path),
    label,
    isRoot: path.length === 0,
    dom: g,
  };
}
