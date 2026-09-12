/** Hit-test mindmap SVG topics. */

export function selectionFromDom(target) {
  if (!target || !target.closest) return null;
  const g = target.closest("g.mindmap-node");
  if (!g) return null;
  const idAttr = g.getAttribute("data-id");
  if (idAttr == null || idAttr === "") return null;
  const id = Number(idAttr);
  if (!Number.isFinite(id)) return null;
  const labelEl = g.querySelector("text");
  const label = labelEl ? labelEl.textContent : "";
  return {
    kind: "topic",
    id,
    key: "topic:" + id,
    label,
    dom: g,
  };
}
