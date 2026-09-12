/** Measure node label sizes for layout. */

const FONT = '600 13px Inter, "SF Pro Text", system-ui, sans-serif';
const FONT_ROOT = '650 15px Inter, "SF Pro Text", system-ui, sans-serif';

function canvasMeasure(text, font) {
  if (typeof document === "undefined") {
    return Math.max(48, String(text || "").length * 8.2);
  }
  const c = canvasMeasure._c || (canvasMeasure._c = document.createElement("canvas"));
  const ctx = c.getContext("2d");
  ctx.font = font || FONT;
  return ctx.measureText(String(text || "")).width;
}

export function measureTree(root, opts) {
  const padX = (opts && opts.padX) || 20;
  const padY = (opts && opts.padY) || 12;
  const minW = (opts && opts.minW) || 64;
  const lineH = (opts && opts.lineH) || 18;
  const rootPadX = (opts && opts.rootPadX) || 32;
  const rootPadY = (opts && opts.rootPadY) || 18;
  const rootMinW = (opts && opts.rootMinW) || 128;
  const rootLineH = (opts && opts.rootLineH) || 24;

  function walk(node) {
    const isRoot = node.depth === 0;
    const tw = canvasMeasure(node.label, isRoot ? FONT_ROOT : FONT);
    let w = Math.max(isRoot ? rootMinW : minW, tw + (isRoot ? rootPadX : padX) * 2);
    let h = (isRoot ? rootLineH : lineH) + (isRoot ? rootPadY : padY) * 2;
    if (isRoot) {
      w = Math.max(w, 128);
      h = Math.max(h, 56);
    }
    node.width = w;
    node.height = h;
    (node.children || []).forEach(walk);
  }
  if (root) walk(root);
  return root;
}
