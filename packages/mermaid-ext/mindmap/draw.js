import { normalizeTheme, themePalette } from "./themes.js";
/** Draw laid-out mindmap tree to SVG (Drawer-compatible classes). */

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

/** Smooth cubic between node centers, biased by layout. */
function edgePath(from, to, layout) {
  const x1 = from.x;
  const y1 = from.y;
  const x2 = to.x;
  const y2 = to.y;
  if (layout === "logic") {
    const mx = x1 + (x2 - x1) * 0.55;
    return `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  // radial: soft curve
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx1 = x1 + dx * 0.35;
  const cy1 = y1 + dy * 0.05;
  const cx2 = x1 + dx * 0.65;
  const cy2 = y2 - dy * 0.05;
  return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

function nodeShape(node) {
  // Shape UI removed: every node is a soft pill; Topic size comes from measure (depth 0).
  const w = node.width || 40;
  const h = node.height || 28;
  const x = -w / 2;
  const y = -h / 2;
  const cls = "node-bkg node-default";
  const rx = Math.min(h / 2, node.depth === 0 ? 18 : 16);
  return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}"></rect>`;
}


export function drawSvg(model, opts) {
  const id = (opts && opts.id) || "mindmap-ext";
  const layout = model.layout || "radial";
  const theme = normalizeTheme(opts && opts.theme);
  const pal = themePalette(theme);
  const { nodes, edges, width, height } = model;

  const edgeEls = edges
    .map((e) => {
      const sec = e.section == null || e.section < 0 ? -1 : e.section;
      const depth = Math.min(e.depth || 0, 5);
      return `<path d="${edgePath(e.from, e.to, layout)}" class="edge section-edge-${sec} edge-depth-${depth}" />`;
    })
    .join("");

  const nodeEls = nodes
    .map((n) => {
      const sec = sectionClass(n.section);
      const label = esc(n.label);
      const w = n.width || 40;
      const h = n.height || 28;
      const addR = 9;
      const gap = 8;
      const addX = w / 2 + gap + addR;
      // Body hit: node only (select). Add-zone: OUTSIDE node, to the right (gap + plus) — not on the node itself.
      const bodyHit = `<rect class="mindmap-node-hit" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"></rect>`;
      const zonePad = Math.max(4, (addR * 2 - h) / 2);
      const zoneX = w / 2; // start at node right edge (outside body)
      const zoneY = -h / 2 - zonePad;
      const zoneW = gap + addR * 2 + 4;
      const zoneH = h + zonePad * 2;
      return (
        `<g class="mindmap-node ${sec}" data-id="${n.id}" transform="translate(${n.x}, ${n.y})">` +
        bodyHit +
        `${nodeShape(n)}` +
        `<text class="mindmap-node-label" text-anchor="middle" dominant-baseline="middle">${label}</text>` +
        `<g class="mindmap-add-zone">` +
        `<rect class="mindmap-add-zone-hit" x="${zoneX}" y="${zoneY}" width="${zoneW}" height="${zoneH}"></rect>` +
        `<g class="mindmap-add" data-add-parent="${n.id}" transform="translate(${addX}, 0)">` +
        `<circle class="mindmap-add-hit" r="${addR + 4}"></circle>` +
        `<circle class="mindmap-add-bg" r="${addR}"></circle>` +
        `<rect class="mindmap-add-bar" x="-5" y="-1.25" width="10" height="2.5" rx="1"></rect>` +
        `<rect class="mindmap-add-bar" x="-1.25" y="-5" width="2.5" height="10" rx="1"></rect>` +
        `</g></g></g>`
      );
    })
    .join("");

  // Emit section-0..10 (matches sectionClass % 11) by cycling pack swatches.
  const secCss = Array.from({ length: 11 }, (_, idx) => {
    const s = pal.sections[idx % Math.max(pal.sections.length, 1)] || pal.sections[0];
    if (!s) return "";
    return (
      `#${id} .section-${idx} .node-bkg{fill:${s.fill};stroke:${s.stroke};stroke-width:1;}` +
      `#${id} .section-${idx} text{fill:${s.text};font-weight:600;}`
    );
  }).join("");
  // edges[0] → section-edge--1; edges[1..] → section-edge-0.. ; cycle for 0..10
  const edgeRoot = (pal.edges && pal.edges[0]) || "#6b7280";
  const edgeRest = (pal.edges && pal.edges.length > 1) ? pal.edges.slice(1) : [edgeRoot];
  const edgeCss =
    `#${id} .section-edge--1{stroke:${edgeRoot};}` +
    Array.from({ length: 11 }, (_, idx) => {
      const c = edgeRest[idx % edgeRest.length];
      return `#${id} .section-edge-${idx}{stroke:${c};}`;
    }).join("");
  const style =
    `#${id}{font-family:${pal.fontFamily};font-size:13px;}` +
    `#${id} .edge{fill:none;stroke-linecap:round;stroke-linejoin:round;}` +
    `#${id} .edge-depth-0{stroke-width:3.25;}` +
    `#${id} .edge-depth-1{stroke-width:2.5;}` +
    `#${id} .edge-depth-2{stroke-width:2;}` +
    `#${id} .edge-depth-3,#${id} .edge-depth-4,#${id} .edge-depth-5{stroke-width:1.75;}` +
    `#${id} .section-root .node-bkg{fill:${pal.root.fill};stroke:${pal.root.stroke};stroke-width:1;}` +
    `#${id} .section-root text{fill:${pal.root.text};font-weight:650;font-size:15px;}` +
    secCss +
    edgeCss +
    `#${id} .mindmap-node{cursor:pointer;}` +
    `#${id} .mindmap-node.mermaid-selection .node-bkg{stroke:#2563eb;stroke-width:2.25;}` +
    `#${id} .mindmap-node-hit{fill:transparent;stroke:none;pointer-events:all;}` +
    `#${id} .mindmap-add-zone-hit{fill:transparent;stroke:none;pointer-events:all;}` +
    `#${id} .mindmap-add{opacity:0;pointer-events:none;cursor:pointer;transition:opacity 0ms linear 0ms;}` +
    `#${id} .mindmap-add-zone:hover .mindmap-add{opacity:1;pointer-events:auto;transition:opacity 0ms linear 100ms;}` +
    `#${id} .mindmap-add-zone.is-suppressed .mindmap-add,#${id} .mindmap-add-zone.is-suppressed:hover .mindmap-add{opacity:0!important;pointer-events:none!important;transition:opacity 0ms linear 0ms!important;}` +
    `#${id} .mindmap-add-hit{fill:transparent;stroke:none;pointer-events:all;}` +
    `#${id} .mindmap-add-bg{fill:#2563eb;stroke:none;pointer-events:none;}` +
    `#${id} .mindmap-add-bar{fill:#fff;pointer-events:none;}` +
    `#${id} .mindmap-add-zone:hover .mindmap-add:hover .mindmap-add-bg{fill:#1d4ed8;}` +
    `#${id} text{paint-order:stroke;stroke:transparent;}`;

  return `<svg id="${esc(id)}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="graphics-document document" aria-roledescription="mindmap" data-mindmap-layout="${layout}" data-mindmap-theme="${theme}"><style>${style}</style><g class="mindmap-edges">${edgeEls}</g><g class="mindmap-nodes">${nodeEls}</g></svg>`;
}
