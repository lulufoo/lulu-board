import { normalizeTheme, themePalette } from "./themes.js";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionClass(section) {
  if (section == null || section < 0) return "section--1 section-root";
  return "section-" + (section % 11);
}

function pathAttr(node) {
  return (node.path || []).join(".");
}

function edgePath(from, to, layout) {
  const x1 = from.x;
  const y1 = from.y;
  const x2 = to.x;
  const y2 = to.y;
  if (layout === "logic") {
    const mx = x1 + (x2 - x1) * 0.55;
    return `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx1 = x1 + dx * 0.35;
  const cy1 = y1 + dy * 0.05;
  const cx2 = x1 + dx * 0.65;
  const cy2 = y2 - dy * 0.05;
  return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

function nodePaint(node, pal) {
  if (node.section == null || node.section < 0) {
    return Object.assign({ strokeWidth: 2 }, pal.root);
  }
  const sections = pal.sections || [];
  const paint = sections[node.section % Math.max(sections.length, 1)] || pal.root;
  return Object.assign({ strokeWidth: 1 }, paint);
}

function edgeWidth(depth) {
  if (depth <= 0) return 3.25;
  if (depth === 1) return 2.5;
  if (depth === 2) return 2;
  return 1.75;
}

function nodeShape(node, paint) {
  const w = node.width || 40;
  const h = node.height || 28;
  const x = -w / 2;
  const y = -h / 2;
  const rx = Math.min(h / 2, node.depth === 0 ? 18 : 16);
  return (
    `<rect class="node-bkg node-default" x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="${rx}" ry="${rx}" fill="${esc(paint.fill)}" stroke="${esc(paint.stroke)}" ` +
    `stroke-width="${paint.strokeWidth || 1}"></rect>`
  );
}

export function drawSvg(model, opts) {
  const id = (opts && opts.id) || "mindmap-ext";
  const layout = model.layout || "radial";
  const theme = normalizeTheme(opts && opts.theme);
  const pal = themePalette(theme);
  const { nodes, edges, width, height } = model;
  const edgeStroke = (pal.edges && pal.edges[0]) || "#7a5c3c";

  const edgeEls = edges
    .map((e) => {
      const sec = e.section == null || e.section < 0 ? -1 : e.section;
      const depth = Math.min(e.depth || 0, 5);
      return (
        `<path d="${edgePath(e.from, e.to, layout)}" class="edge section-edge-${sec} edge-depth-${depth}" ` +
        `fill="none" stroke="${esc(edgeStroke)}" stroke-width="${edgeWidth(depth)}" ` +
        `stroke-linecap="round" stroke-linejoin="round" />`
      );
    })
    .join("");

  const nodeEls = nodes
    .map((n) => {
      const paint = nodePaint(n, pal);
      const sec = sectionClass(n.section);
      const label = esc(n.label);
      const w = n.width || 40;
      const h = n.height || 28;
      const addR = 9;
      const gap = 8;
      const addX = w / 2 + gap + addR;
      const path = pathAttr(n);
      const isRoot = n.section == null || n.section < 0;
      const bodyHit = (
        `<rect class="mindmap-node-hit" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" ` +
        `fill="none" stroke="none" pointer-events="all"></rect>`
      );
      const zonePad = Math.max(4, (addR * 2 - h) / 2);
      const zoneX = w / 2;
      const zoneY = -h / 2 - zonePad;
      const zoneW = gap + addR * 2 + 4;
      const zoneH = h + zonePad * 2;
      const labelWeight = isRoot ? 650 : 600;
      const labelSize = isRoot ? 15 : 13;
      return (
        `<g class="mindmap-node ${sec}" data-id="${n.id}" data-path="${path}" transform="translate(${n.x}, ${n.y})">` +
        bodyHit +
        `${nodeShape(n, paint)}` +
        `<text class="mindmap-node-label" text-anchor="middle" dominant-baseline="middle" ` +
        `fill="${esc(paint.text)}" font-weight="${labelWeight}" font-size="${labelSize}">${label}</text>` +
        `<g class="mindmap-add-zone">` +
        `<rect class="mindmap-add-zone-hit" x="${zoneX}" y="${zoneY}" width="${zoneW}" height="${zoneH}" ` +
        `fill="none" stroke="none" pointer-events="all"></rect>` +
        `<g class="mindmap-add" data-add-parent="${path}" transform="translate(${addX}, 0)">` +
        `<circle class="mindmap-add-hit" r="${addR + 4}" fill="none" stroke="none" pointer-events="all"></circle>` +
        `<circle class="mindmap-add-bg" r="${addR}" fill="#db4c84" stroke="none" pointer-events="none"></circle>` +
        `<rect class="mindmap-add-bar" x="-5" y="-1.25" width="10" height="2.5" rx="1" fill="#fff" pointer-events="none"></rect>` +
        `<rect class="mindmap-add-bar" x="-1.25" y="-5" width="2.5" height="10" rx="1" fill="#fff" pointer-events="none"></rect>` +
        `</g></g></g>`
      );
    })
    .join("");

  return (
    `<svg id="${esc(id)}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="graphics-document document" aria-roledescription="mindmap" ` +
    `data-mindmap-layout="${layout}" data-mindmap-theme="${theme}" ` +
    `font-family="${esc(pal.fontFamily)}" font-size="13">` +
    `<g class="mindmap-edges">${edgeEls}</g><g class="mindmap-nodes">${nodeEls}</g></svg>`
  );
}
