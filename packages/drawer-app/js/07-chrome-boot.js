/* drawer-app/07-chrome-boot.js — lines 3337-3886 of former inline module */
function flashChrome(ms = 900) {
  const shell = $('#canvasShell') || document.querySelector('.canvas-shell');
  if (!shell) return;
  shell.classList.add('show-chrome');
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => shell.classList.remove('show-chrome'), ms);
}

stageEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const factor = Math.exp(-(e.deltaY * unit) * 0.0012);
  scale = Math.min(3, Math.max(0.2, scale * factor));
  applyTransform();
  flushDrawerUiSave();
  flashChrome();
}, { passive: false });


(function wireBoardTitlePin() {
  var pin = boardTitlePinEl();
  if (!pin || pin.dataset.wired === "1") return;
  pin.dataset.wired = "1";
  pin.addEventListener("pointerdown", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    event.stopPropagation();
    try {
      var board = BoardRender.parse(boardSourceEl.value);
      var root = previewEl.querySelector(".board-render");
      pickBoardElement(title, root || previewEl, board);
    } catch (err) {}
  });
  pin.addEventListener("click", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    if (consumeInspectClick("title:board")) inspectBoardSelection();
  });
  pin.addEventListener("dblclick", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    event.stopPropagation();
    inspectBoardSelection();
    if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); }
  });
})();

stageEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  // Pan only on blank stage/canvas — not boxes, items, title, edges, mermaid hits, or chrome.
  // Mindmap nodes are handled separately (press = select, drag = pan while keeping selection).
  if (e.target.closest && e.target.closest("#boardTitlePin, .board-title-node, .board-zone, .board-item, .board-edge, .board-edge-label, .board-slot.is-link, .board-inspector, .board-dock, .props-panel, .top-float, .zoom-float, .menu, .sheet, button, input, select, textarea, label, g.node, g.cluster, g.cluster-label, g.edgePath, g.edgeLabel, g.flowchart-link, path.flowchart-link, path.mermaid-edge-hit, g.mindmap-node, g.statediagram-state, g.statediagram-cluster, g.stateGroup, path.transition")) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && document.documentElement.dataset.mermaidMindmap === "1" && typeof MindmapEdit !== "undefined" && MindmapEdit.selectionFromDom && MindmapEdit.selectionFromDom(e.target)) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && typeof FlowchartEdit !== "undefined" && FlowchartEdit.selectionFromDom && FlowchartEdit.selectionFromDom(e.target, sourceEl && sourceEl.value)) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && document.documentElement.dataset.mermaidState === "1" && typeof StateEdit !== "undefined" && StateEdit.selectionFromDom && StateEdit.selectionFromDom(e.target, sourceEl && sourceEl.value)) return;
  // Clicks outside the content bbox land on the stage (preview is max-content) — whole stage is canvas.
  panBlankMindmap = false;
  if (document.documentElement.dataset.drawerMode === "board") {
    if (boardLinkMode) setBoardLinkMode(false);
    else clearBoardSelection();
  } else if (document.documentElement.dataset.drawerMode === "mermaid") {
    if (mermaidLinkMode) setMermaidLinkMode(false);
    else if (document.documentElement.dataset.mermaidMindmap === "1") {
      // Mindmap: defer blank deselect until pointerup — drag pan keeps selection.
      panBlankMindmap = true;
    } else {
      clearMermaidSelection();
    }
  } else if (currentDockTab()) {
    openDock("");
    try { MermaidInspect.clearPropsShown(); } catch (_e) {}
  }
  e.preventDefault();
  try { var sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (_) {}
  panning = true;
  panMoved = false;
  stageEl.classList.add('panning');
  panOrigin = { x: e.clientX - panX, y: e.clientY - panY, startX: e.clientX, startY: e.clientY };
  stageEl.setPointerCapture(e.pointerId);
});
stageEl.addEventListener('pointermove', (e) => {
  if (!panning || !panOrigin) return;
  if (!panMoved && panOrigin.startX != null) {
    var dx0 = e.clientX - panOrigin.startX;
    var dy0 = e.clientY - panOrigin.startY;
    if (dx0 * dx0 + dy0 * dy0 >= 25) panMoved = true;
  }
  panX = e.clientX - panOrigin.x;
  panY = e.clientY - panOrigin.y;
  applyTransform();
});
stageEl.addEventListener('pointerup', () => {
  var wasPanning = panning;
  var blankMm = panBlankMindmap;
  var moved = panMoved;
  panning = false; panOrigin = null; panBlankMindmap = false; panMoved = false;
  stageEl.classList.remove('panning');
  try { var sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (_) {}
  if (blankMm && !moved) clearMermaidSelection();
  if (wasPanning && moved) flushDrawerUiSave();
  else if (wasPanning && !blankMm) flushDrawerUiSave();
});
stageEl.addEventListener('selectstart', (e) => {
  if (panning) e.preventDefault();
});

sourceEl.addEventListener('input', () => {
  setTypeUI(sourceEl.value);
  scheduleRender();
  scheduleSave();
});
boardSourceEl.addEventListener('input', () => {
  if (typeof updateBoardChars === "function") updateBoardChars();
  scheduleBoardRender();
  scheduleBoardSave();
});

$('#btnRender').onclick = () => void renderDiagram({ fit: false });

$('#btnClear').onclick = () => {
  sourceEl.value = '';
  try { sessionStorage.removeItem(SVG_CACHE_KEY); } catch (_) {}
  showEmpty(); setTypeUI('', { clearTools: true }); setStatus('Cleared');
  scheduleSave();
};

if (boardIdEditor) {
  boardIdEditor.addEventListener("input", filterBoardIdEditor);
  boardIdEditor.addEventListener("change", commitBoardId);
  boardIdEditor.addEventListener("keydown", function(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitBoardId();
  });
}
if (boardIdCopy) boardIdCopy.addEventListener("click", function() {
  var value = boardIdEditor ? String(boardIdEditor.value || "").trim() : "";
  if (!value) return;
  copyText(value, "ID");
  markBoardIdCopied(true);
});
if (boardTypeEditor) boardTypeEditor.addEventListener("change", commitBoardType);
if (boardCapEditor) boardCapEditor.addEventListener("change", commitBoardCap);
if (boardShapeField) boardShapeField.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest("[data-shape]") : null;
  if (!btn || btn.disabled) return;
  commitBoardShape(btn.getAttribute("data-shape"));
});
if (boardArrowEditor) boardArrowEditor.addEventListener("change", commitBoardArrow);
if (boardArrowReverse) boardArrowReverse.addEventListener("click", commitBoardReverse);
if (boardDirEditor) boardDirEditor.addEventListener("change", commitBoardDir);
if (boardAlignEditor) boardAlignEditor.addEventListener("change", commitBoardAlign);
if (boardJustifyEditor) boardJustifyEditor.addEventListener("change", commitBoardJustify);
if (boardIconList) boardIconList.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest(".props-icon-btn") : null;
  if (!btn) return;
  var n = Number(btn.dataset.icon);
  if (selectedBoardNode && selectedBoardNode.kind === "box" && Number(boardIconPick) === n) {
    commitBoardIcon(null);
    return;
  }
  commitBoardIcon(n);
});
if (boardIconSec) boardIconSec.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest("[data-sec]") : null;
  if (!btn) return;
  var sec = btn.dataset.sec;
  if (boardIconSecId === sec) {
    var Icons = window.BoardIcons;
    var owner = Icons && Icons.sectionOf && boardIconPick != null ? Icons.sectionOf(boardIconPick) : "";
    boardIconSecId = "";
    fillBoardIconList();
    if (selectedBoardNode && selectedBoardNode.kind === "box" && owner === sec) commitBoardIcon(null);
    else markBoardIconPick(boardIconPick);
    return;
  }
  boardIconSecId = sec;
  fillBoardIconList();
  markBoardIconPick(boardIconPick);
});

(function(){
  if (boardDock) {
    boardDock.querySelectorAll("[data-dock]").forEach(function(btn) {
      btn.addEventListener("click", function() { toggleDock(btn.getAttribute("data-dock")); });
    });
  }
  try { openDock(""); } catch (_) {}
})();
boardTitleEditor.addEventListener("change", commitBoardTitle); boardTitleEditor.addEventListener("keydown", function(event) {
  if (event.key !== "Enter") return;
  if (boardTitleEditor.classList.contains("is-multiline") && !event.metaKey && !event.ctrlKey) return;
  event.preventDefault();
  commitBoardTitle();
});
const exportMenu = $('#exportMenu');
const exportBtn = $('#btnExportMenu');
function closeExportMenu() {
  exportMenu.classList.remove('open');
  exportBtn.setAttribute('aria-expanded', 'false');
}
exportBtn.onclick = (e) => {
  e.stopPropagation();
  const open = !exportMenu.classList.contains('open');
  exportMenu.classList.toggle('open', open);
  exportBtn.setAttribute('aria-expanded', String(open));
};
document.addEventListener('click', (e) => {
  if (!exportMenu.contains(e.target)) closeExportMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeExportMenu();
});
$('#btnCopySrc').onclick = () => { copyText(sourceEl.value, 'Source'); showCopyTip('Copied successfully'); closeExportMenu(); };

$('#btnZoomIn').onclick = () => { scale = Math.min(3, scale * 1.08); applyTransform(); flushDrawerUiSave(); };
$('#btnZoomOut').onclick = () => { scale = Math.max(0.2, scale / 1.08); applyTransform(); flushDrawerUiSave(); };
$('#btnZoomReset').onclick = () => { centerView(); };
window.addEventListener("resize", () => { applyTransform(); });
$('#btnFit').onclick = fitView;
/* $('#btnTheme') removed */

function syncModeBtn() {
  const board = document.documentElement.dataset.drawerMode === 'board';
  const tabM = $('#tabMermaid');
  const tabB = $('#tabBoard');
  if (tabM) tabM.setAttribute('aria-selected', String(!board));
  if (tabB) tabB.setAttribute('aria-selected', String(board));
}

// —— Canvas toolbar: diagram theme + export + UI theme (visible in Board & Mermaid) ——

const DIAGRAM_THEME_KEY = 'drawer.diagramTheme';
function currentDiagramTheme() {
  const legacy = localStorage.getItem('drawer.boardTheme');
  const v = localStorage.getItem(DIAGRAM_THEME_KEY) || legacy || 'default';
  if (window.BoardThemes && typeof BoardThemes.resolveId === 'function') return BoardThemes.resolveId(v);
  const allowed = ['default', 'classic', 'pastel', 'kami'];
  return allowed.includes(v) ? v : 'default';
}
function mermaidThemeForDiagram(theme) {
  // Unified diagram themes → Mermaid.js theme ids (keep original neutral as default)
  const id = (window.BoardThemes && typeof BoardThemes.resolveId === 'function') ? BoardThemes.resolveId(theme) : theme;
  if (id === 'pastel') return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral';
  if (id === 'classic') return 'base';
  return 'neutral';
}
function isFlowchartSource(text) {
  const t = String(diagramType(text) || '').toLowerCase();
  return t === 'flowchart' || t === 'graph';
}

/** State diagram: convert curved transition paths to orthogonal polylines (折线). */
function polishStateTransitions(svg) {
  if (!svg) return;
  var paths = svg.querySelectorAll('path.transition');
  if (!paths.length) return;
  function parseEnd(d) {
    // last explicit point: Lx,y or endpoint of final C (last two nums are end)
    var m = String(d || '').trim();
    if (!m) return null;
    var nums = m.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
    if (!nums || nums.length < 2) return null;
    return { x: Number(nums[nums.length - 2]), y: Number(nums[nums.length - 1]) };
  }
  function parseStart(d) {
    var m = /^M\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*,\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)/i.exec(String(d || '').trim());
    if (!m) return null;
    return { x: Number(m[1]), y: Number(m[2]) };
  }
  function orthoPath(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    if (Math.abs(dx) < 1.5) {
      return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;
    }
    if (Math.abs(dy) < 1.5) {
      return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;
    }
    // Prefer mid-Y elbow (H then V then H) when mostly horizontal travel; else mid-X.
    var r = 8; // corner radius
    if (Math.abs(dx) >= Math.abs(dy)) {
      var midY = a.y + dy * 0.5;
      var x1 = a.x;
      var y1 = a.y;
      var x2 = b.x;
      var y2 = b.y;
      var sx = dx > 0 ? 1 : -1;
      var sy = (midY >= y1) ? 1 : -1;
      var sy2 = (y2 >= midY) ? 1 : -1;
      // M → vertical toward midY (leave r) → arc → horizontal → arc → vertical to end
      var v1 = midY - sy * r;
      var h2 = x2 - sx * r;
      // keep simple sharp 折线 first (clearer than rounded for review)
      return 'M' + x1 + ',' + y1 + 'L' + x1 + ',' + midY + 'L' + x2 + ',' + midY + 'L' + x2 + ',' + y2;
    }
    var midX = a.x + dx * 0.5;
    return 'M' + a.x + ',' + a.y + 'L' + midX + ',' + a.y + 'L' + midX + ',' + b.y + 'L' + b.x + ',' + b.y;
  }
  Array.prototype.forEach.call(paths, function(p) {
    var d = p.getAttribute('d') || '';
    if (!d || d.indexOf('C') < 0) return; // already line-ish or empty
    var a = parseStart(d);
    var b = parseEnd(d);
    if (!a || !b) return;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return; // degenerate
    p.setAttribute('d', orthoPath(a, b));
  });
}


/** State diagram UI polish — outer shell + title divider; no inner nested box. */
function polishStateDiagram(svg) {
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';

  // Leaf state nodes: round label-container only (skip empty label rects).
  svg.querySelectorAll('g.node.statediagram-state > rect.basic.label-container, g.node.statediagram-state > rect.label-container').forEach(function(r) {
    try {
      r.setAttribute('rx', '8');
      r.setAttribute('ry', '8');
      r.style.strokeWidth = r.style.strokeWidth || '1.25px';
    } catch (_e) {}
  });

  // Composite clusters: keep outer rounded shell; drop inner box; title divider only.
  svg.querySelectorAll('g.statediagram-cluster, g.cluster').forEach(function(cluster) {
    try {
      var outer = cluster.querySelector('rect.outer') || cluster.querySelector('g > rect');
      var inner = cluster.querySelector('rect.inner');
      if (outer) {
        outer.setAttribute('rx', '10');
        outer.setAttribute('ry', '10');
        outer.style.strokeWidth = outer.style.strokeWidth || '1.25px';
      }
      if (inner) {
        // Hide nested content frame (was overlapping outer rounded box).
        inner.setAttribute('visibility', 'hidden');
        inner.style.display = 'none';
        // Divider under title row (inner.y is the title/content split).
        var x = parseFloat(inner.getAttribute('x') || (outer && outer.getAttribute('x')) || '0');
        var y = parseFloat(inner.getAttribute('y') || '0');
        var w = parseFloat(inner.getAttribute('width') || (outer && outer.getAttribute('width')) || '0');
        if (isFinite(x) && isFinite(y) && isFinite(w) && w > 0) {
          var old = cluster.querySelector('line.state-title-divider');
          if (old) old.remove();
          var line = document.createElementNS(NS, 'line');
          line.setAttribute('class', 'state-title-divider');
          line.setAttribute('x1', String(x));
          line.setAttribute('x2', String(x + w));
          line.setAttribute('y1', String(y));
          line.setAttribute('y2', String(y));
          // Insert after outer / before label if possible
          if (inner.parentNode) inner.parentNode.insertBefore(line, inner);
          else cluster.appendChild(line);
        }
      }
    } catch (_e) {}
  });

  // Leaf labels: no clip + vertical center inside the rounded box.
  svg.querySelectorAll('g.node.statediagram-state').forEach(function(node) {
    try {
      var box = node.querySelector('rect.basic.label-container, rect.label-container');
      var label = node.querySelector('g.label');
      var fo = node.querySelector('foreignObject');
      if (!box || !fo) return;
      fo.style.overflow = 'visible';
      var div = fo.querySelector('div');
      if (div) {
        div.style.overflow = 'visible';
        div.style.maxWidth = 'none';
        div.style.lineHeight = '1.25';
        div.style.verticalAlign = 'middle';
      }
      var p = fo.querySelector('p');
      if (p) {
        p.style.margin = '0';
        p.style.overflow = 'visible';
        p.style.lineHeight = '1.25';
      }
      var span = fo.querySelector('.nodeLabel, span, p');
      var needW = 0;
      var needH = 0;
      if (span && span.getBoundingClientRect) {
        var br = span.getBoundingClientRect();
        needW = Math.ceil(br.width) + 4;
        needH = Math.ceil(br.height) + 2;
      }
      var curW = parseFloat(fo.getAttribute('width') || '0');
      var curH = parseFloat(fo.getAttribute('height') || '0');
      if (isFinite(needW) && needW > curW + 1) {
        fo.setAttribute('width', String(needW));
        curW = needW;
      }
      if (isFinite(needH) && needH > curH + 1) {
        fo.setAttribute('height', String(needH));
        curH = needH;
      }
      var bw = parseFloat(box.getAttribute('width') || '0');
      var bh = parseFloat(box.getAttribute('height') || '0');
      var bx = parseFloat(box.getAttribute('x') || '0');
      var by = parseFloat(box.getAttribute('y') || '0');
      var padX = 16;
      var padY = 14;
      var nbw = Math.max(bw, curW + padX);
      var nbh = Math.max(bh, curH + padY);
      if (isFinite(nbw) && isFinite(nbh)) {
        box.setAttribute('width', String(nbw));
        box.setAttribute('height', String(nbh));
        box.setAttribute('x', String(-nbw / 2));
        box.setAttribute('y', String(-nbh / 2));
        if (label) {
          label.setAttribute('transform', 'translate(' + (-curW / 2) + ', ' + (-curH / 2) + ')');
        }
      }
    } catch (_e) {}
  });
  // Cluster title labels: overflow visible only
  svg.querySelectorAll('g.statediagram-cluster foreignObject, g.cluster-label foreignObject').forEach(function(fo) {
    try {
      fo.style.overflow = 'visible';
      var p = fo.querySelector('p');
      if (p) p.style.margin = '0';
    } catch (_e) {}
  });

  // Edge labels: transparent plate + light paint halo (no white box)
  svg.querySelectorAll('g.edgeLabel .labelBkg, g.edgeLabel rect').forEach(function(el) {
    try {
      el.setAttribute('fill', 'transparent');
      el.style.fill = 'transparent';
      el.style.fillOpacity = '0';
      el.style.background = 'transparent';
    } catch (_e) {}
  });
  svg.querySelectorAll('g.edgeLabel foreignObject div, g.edgeLabel foreignObject .labelBkg').forEach(function(el) {
    try {
      el.style.background = 'transparent';
      el.style.backgroundColor = 'transparent';
    } catch (_e) {}
  });
  svg.querySelectorAll('g.edgeLabel text, g.edgeLabel span, .edgeLabel foreignObject div').forEach(function(el) {
    try {
      el.style.paintOrder = 'stroke fill';
      el.style.stroke = 'rgba(255,255,255,0.85)';
      el.style.strokeWidth = '3px';
      el.style.strokeLinejoin = 'round';
    } catch (_e) {}
  });
  // Transition stroke weight
  svg.querySelectorAll('path.transition').forEach(function(p) {
    try {
      var sw = parseFloat(p.style.strokeWidth || p.getAttribute('stroke-width') || '1');
      if (!isFinite(sw) || sw < 1.15) p.style.strokeWidth = '1.35px';
    } catch (_e) {}
  });
  // Start / end markers stay crisp
  svg.querySelectorAll('g.state-start circle, .state-start circle').forEach(function(c) {
    try { c.style.strokeWidth = '0'; } catch (_e) {}
  });
}

function isMindmapSource(text) {
  return String(diagramType(text) || '').toLowerCase() === 'mindmap';
}
function isSequenceSource(text) {
  return String(diagramType(text) || '').toLowerCase() === 'sequencediagram';
}
function isStateSource(text) {
  var t = String(diagramType(text) || '').toLowerCase();
  return t === 'statediagram' || t === 'statediagram-v2';
}
function mermaidSiteOptions(theme, text) {
  const id = (window.BoardThemes && typeof BoardThemes.resolveId === 'function')
    ? BoardThemes.resolveId(theme)
    : theme;
  const options = {
    startOnLoad: false,
    securityLevel: 'loose',
    flowchart: { useMaxWidth: false },
    sequence: {
      useMaxWidth: false,
      diagramMarginX: 48,
      diagramMarginY: 24,
      actorMargin: 64,
      boxMargin: 12,
      boxTextMargin: 6,
      noteMargin: 12,
      messageMargin: 40,
      mirrorActors: true,
      bottomMarginAdj: 8,
      rightAngles: false,
    },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false, padding: 16 },
    er: { useMaxWidth: false },
    mindmap: { useMaxWidth: false, padding: 18 },
  };
  // Flowchart / state: ELK orthogonal edges (Cursor Mermaid Preview parity).
  if (typeof isFlowchartSource === 'function' && isFlowchartSource(text)) {
    options.layout = 'elk';
  }
  if (typeof isStateSource === 'function' && isStateSource(text) && window.MermaidStateThemes) {
    const vars = Object.assign({}, MermaidStateThemes.variables(id), { background: 'transparent' });
    options.theme = 'base';
    options.fontFamily = vars.fontFamily || 'Inter, SF Pro Text, system-ui, sans-serif';
    options.themeVariables = vars;
    options.layout = 'elk';
    return options;
  }
  if (typeof isStateSource === 'function' && isStateSource(text)) {
    options.layout = 'elk';
  }
  if (isFlowchartSource(text) && window.MermaidFlowchartThemes) {
    const vars = Object.assign({}, MermaidFlowchartThemes.variables(id), { background: 'transparent' });
    options.theme = 'base';
    options.fontFamily = vars.fontFamily;
    options.themeVariables = vars;
    return options;
  }
  if (isSequenceSource(text) && window.MermaidSequenceThemes) {
    const vars = Object.assign({}, MermaidSequenceThemes.variables(id), { background: 'transparent' });
    options.theme = 'base';
    options.fontFamily = vars.fontFamily || 'Inter, SF Pro Text, system-ui, sans-serif';
    options.themeVariables = vars;
    return options;
  }
  // Mindmap: avoid Mermaid "neutral" washed edges on the grid — use default (colored sections).
  if (isMindmapSource(text)) {
    options.theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
    options.fontFamily = 'Inter, SF Pro Text, system-ui, sans-serif';
    options.themeVariables = { background: 'transparent' };
    return options;
  }
  options.theme = mermaidThemeForDiagram(id);
  options.fontFamily = 'Inter, SF Pro Text, system-ui, sans-serif';
  // All Mermaid diagram types: no solid diagram plate — sit on the shared grid canvas.
  options.themeVariables = Object.assign({}, options.themeVariables || {}, { background: 'transparent' });
  return options;
}
function applyMermaidSiteConfig(theme) {
  const t = theme || currentDiagramTheme();
  const text = sourceEl ? sourceEl.value : '';
  if (!window.mermaid || !window.mermaid.initialize) return;
  window.mermaid.initialize(mermaidSiteOptions(t, text));
}
function reinitMermaidForDiagramTheme(theme) {
  try { applyMermaidSiteConfig(theme); } catch (_) {}
}

const ITEM_CAP_KEY = 'drawer.boardItemCap';
const ITEM_CAP_MIN = 8;
const ITEM_CAP_MAX = 24;
const ITEM_CAP_DEFAULT = 16;
let boardItemCapTimer = 0;
function paintStyleRange(el) {
  if (!el) return;
  var min = Number(el.min);
  var max = Number(el.max);
  var val = Number(el.value);
  var span = max - min;
  el.style.setProperty('--cap-fill', (span === 0 ? 0 : ((val - min) / span) * 100) + '%');
}
function currentBoardItemCap() {
  const raw = localStorage.getItem(ITEM_CAP_KEY);
  if (raw == null || raw === '') return ITEM_CAP_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return ITEM_CAP_DEFAULT;
  return Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, Math.round(n)));
}
function applyBoardItemCap(rem, rerender, persist) {
  const n = rem == null
    ? currentBoardItemCap()
    : Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, Math.round(Number(rem) || ITEM_CAP_DEFAULT)));
  localStorage.setItem(ITEM_CAP_KEY, String(n));
  const css = n + 'rem';
  document.documentElement.style.setProperty('--board-item-cap', css);
  if (boardItemCapSlider) boardItemCapSlider.value = String(n);
  paintStyleRange(boardItemCapSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ item_cap: n });
  if (rerender && document.documentElement.dataset.drawerMode === 'board'
    && typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) {
    renderBoard({ fit: false });
  }
}
function applyBoardThemeToPreview() {
  const t = (typeof currentDiagramTheme === 'function') ? currentDiagramTheme() : (localStorage.getItem('drawer.diagramTheme') || 'default');
  document.querySelectorAll('.board-render').forEach((el) => {
    if (window.BoardThemes && typeof BoardThemes.applyTo === 'function') BoardThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
}
function persistMermaidStyle(patch) {
  if (!sourceEl || !sourceEl.value.trim()) return;
  if (document.documentElement.dataset.drawerMode === 'board') return;
  if (typeof DrawerStyleLine === 'undefined' || typeof BoardRender === 'undefined') return;
  if (typeof BoardRender.encodeStylePayload !== 'function' || typeof BoardRender.decodeStylePayload !== 'function') return;
  try {
    var doc = splitDocument(sourceEl.value);
    var styled = DrawerStyleLine.splitRendererStyle(doc.body);
    var token = DrawerStyleLine.applyMermaidStylePatch(
      styled.token,
      patch || {},
      BoardRender.encodeStylePayload,
      BoardRender.decodeStylePayload
    );
    var next = joinDocument(doc.meta, DrawerStyleLine.joinRendererStyle(token, styled.body));
    if (next !== sourceEl.value) {
      sourceEl.value = next;
      if (typeof setTypeUI === 'function') setTypeUI(next);
      if (typeof scheduleSave === 'function') scheduleSave();
    }
  } catch (_e) {}
}
function applyMermaidDocumentStyle(body) {
  var styled = (typeof DrawerStyleLine !== 'undefined')
    ? DrawerStyleLine.splitRendererStyle(body)
    : { token: '', body: body };
  var theme = 'default';
  if (styled.token && typeof BoardRender !== 'undefined' && typeof BoardRender.decodeStylePayload === 'function') {
    var raw = BoardRender.decodeStylePayload(styled.token);
    if (window.BoardThemes && typeof BoardThemes.resolveId === 'function') theme = BoardThemes.resolveId(raw && raw.theme);
    else if (raw && ['default', 'classic', 'pastel', 'kami'].includes(raw.theme)) theme = raw.theme;
  }
  if (typeof applyDiagramTheme === 'function') applyDiagramTheme(theme, { persist: false, skipRender: true });
  else if (typeof applyMermaidSiteConfig === 'function') applyMermaidSiteConfig(theme);
  return styled.body;
}
function applyDiagramTheme(theme, opts) {
  const t = (window.BoardThemes && typeof BoardThemes.resolveId === 'function')
    ? BoardThemes.resolveId(theme)
    : ((['default', 'classic', 'pastel', 'kami'].includes(theme) ? theme : 'default'));
  localStorage.setItem(DIAGRAM_THEME_KEY, t);
  localStorage.setItem('drawer.boardTheme', t); // back-compat
  document.querySelectorAll('#diagramThemeMenu .theme-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.theme === t);
  });
  document.documentElement.dataset.diagramTheme = t;
  document.querySelectorAll('.board-render').forEach((el) => {
    if (window.BoardThemes && typeof BoardThemes.applyTo === 'function') BoardThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
  reinitMermaidForDiagramTheme(t);
  const mode = document.documentElement.dataset.drawerMode || 'mermaid';
  if (opts && opts.persist && mode === 'board' && typeof persistBoardStyle === 'function') {
    persistBoardStyle({ theme: t });
  }
  if (opts && opts.persist && mode !== 'board' && typeof persistMermaidStyle === 'function') {
    persistMermaidStyle({ theme: t });
  }
  if (opts && opts.skipRender) return;
  if (mode === 'board') {
    // Keep current zoom/pan when switching theme.
    // Skip while source is empty (init runs before bootstrapBoard).
    if (typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) renderBoard({ fit: false });
  } else if (typeof renderDiagram === 'function' && sourceEl && sourceEl.value.trim()) {
    // Never render empty source on init — that called setTypeUI('') and hid Mermaid edit tools (toolbar flash).
    void renderDiagram({ fit: false });
  }
}
const btnDiagramTheme = $('#btnDiagramTheme');
const diagramThemeMenu = $('#diagramThemeMenu');

// Keep dropdown panels from covering the left Lulu Drawer sheet
function placeMenuPanel(wrap) {
  if (!wrap) return;
  const panel = wrap.querySelector('.menu-panel');
  const sheet = $('#sheet');
  if (!panel || !sheet) return;
  panel.style.left = '0px';
  panel.style.right = 'auto';
  requestAnimationFrame(() => {
    const pr = panel.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    const app = $('#app');
    const sheetOpen = app && !app.classList.contains('sheet-collapsed') && getComputedStyle(sheet).display !== 'none';
    if (sheetOpen && pr.left < sr.right + 4) {
      const dx = Math.ceil(sr.right + 4 - pr.left);
      panel.style.left = dx + 'px';
    }
    // also keep inside viewport right edge
    const pr2 = panel.getBoundingClientRect();
    if (pr2.right > window.innerWidth - 8) {
      const shift = Math.ceil(pr2.right - (window.innerWidth - 8));
      const cur = parseFloat(panel.style.left || '0') || 0;
      panel.style.left = (cur - shift) + 'px';
    }
  });
}

function closeDiagramThemeMenu() {
  /* Theme lives in Style dock — no popup. */
}

document.querySelectorAll("#mindmapLayoutSeg [data-mindmap-layout]").forEach(function(btn) {
  btn.addEventListener("click", function() {
    setMindmapLayout(btn.getAttribute("data-mindmap-layout"));
  });
});
try { syncMindmapLayoutSeg(); syncStyleLayoutSections(); } catch (_e) {}

document.querySelectorAll('#diagramThemeMenu .theme-item').forEach((btn) => {
  btn.addEventListener('click', () => { applyDiagramTheme(btn.dataset.theme, { persist: true }); });
});
const _themeMo = new MutationObserver(() => {
  const t = currentDiagramTheme();
  document.querySelectorAll('.board-render').forEach((el) => { el.dataset.boardTheme = t; });
});
const _themeStage = $('#preview');
if (_themeStage) _themeMo.observe(_themeStage, { childList: true, subtree: true });
applyDiagramTheme(currentDiagramTheme());
applyBoardItemCap();
if (boardItemCapSlider) {
  boardItemCapSlider.addEventListener('input', function() {
    applyBoardItemCap(boardItemCapSlider.value, false, false);
    clearTimeout(boardItemCapTimer);
    boardItemCapTimer = setTimeout(function() { applyBoardItemCap(boardItemCapSlider.value, true, true); }, 160);
  });
}
let boardFontSizeTimer = 0;
function applyBoardTypeStep(raw, persist, rerender) {
  const n = (window.BoardTypeScale && typeof BoardTypeScale.clampStep === 'function')
    ? BoardTypeScale.clampStep(raw)
    : Math.min(3, Math.max(-3, Math.round(Number(raw) || 0)));
  document.documentElement.dataset.boardTypeStep = String(n);
  if (boardFontSizeSlider) boardFontSizeSlider.value = String(n);
  paintStyleRange(boardFontSizeSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ type_step: n });
  if (rerender && document.documentElement.dataset.drawerMode === 'board'
    && typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) {
    renderBoard({ fit: false });
  }
}
if (boardFontSizeSlider) {
  boardFontSizeSlider.addEventListener('input', function() {
    applyBoardTypeStep(boardFontSizeSlider.value, false, false);
    clearTimeout(boardFontSizeTimer);
    boardFontSizeTimer = setTimeout(function() { applyBoardTypeStep(boardFontSizeSlider.value, true, true); }, 160);
  });
}


const canvasExportMenu = $('#canvasExportMenu');
const canvasExportBtn = $('#btnCanvasExport');
function closeCanvasExport() {
  if (canvasExportMenu) canvasExportMenu.classList.remove('open');
  if (canvasExportBtn) canvasExportBtn.setAttribute('aria-expanded', 'false');
}
if (canvasExportBtn && canvasExportMenu) {
  canvasExportBtn.onclick = (e) => {
    e.stopPropagation();
    const open = !canvasExportMenu.classList.contains('open');
    document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
    canvasExportMenu.classList.toggle('open', open);
    canvasExportBtn.setAttribute('aria-expanded', String(open));
    if (open) placeMenuPanel(canvasExportMenu);
  };
  document.addEventListener('click', (e) => {
    if (!canvasExportMenu.contains(e.target)) closeCanvasExport();
  });
}
function activeSourceText() {
  const mode = document.documentElement.dataset.drawerMode || 'mermaid';
  if (mode === 'board') return boardSourceEl ? boardSourceEl.value : '';
  return sourceEl ? sourceEl.value : '';
}
function activeSourcePath() {
  const mode = document.documentElement.dataset.drawerMode || 'mermaid';
  if (mode === 'board') return (typeof liveBoardPath === 'string' && liveBoardPath) ? liveBoardPath : '';
  if (typeof liveDiagramPath === 'string' && liveDiagramPath) return liveDiagramPath;
  if (typeof liveArchive === 'string' && liveArchive.startsWith('/')) return liveArchive;
  return '';
}
async function copyActiveSourcePath() {
  let path = activeSourcePath();
  if (!path) {
    try {
      const mode = document.documentElement.dataset.drawerMode || 'mermaid';
      const url = mode === 'board' ? './board.meta.json?ts=' + Date.now() : './diagram.meta.json?ts=' + Date.now();
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const meta = await res.json();
        if (mode === 'board' && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(meta);
        else if (typeof applyLiveMeta === 'function') applyLiveMeta(meta);
        path = activeSourcePath();
      }
    } catch (_e) {}
  }
  if (!path) { showCopyTip('No file path'); return; }
  await copyText(path, 'Path');
}
$('#btnSourceCopyId') && ($('#btnSourceCopyId').onclick = () => {
  var id = typeof liveRecordId === "function" ? liveRecordId() : "";
  if (!id) { showCopyTip("No ID"); return; }
  void copyText(id, "ID");
});
$('#btnSourceCopy') && ($('#btnSourceCopy').onclick = () => {
  void copyText(activeSourceText(), "Source");
});
$('#btnCanvasCopySrc') && ($('#btnCanvasCopySrc').onclick = () => { void copyActiveSourcePath(); closeCanvasExport(); });
/* UI light/dark toggle removed for now */

function syncSheetCssVar() {
  const sheet = $('#sheet');
  if (!sheet) return;
  const w = sheet.getBoundingClientRect().width;
  if (w > 0) document.documentElement.style.setProperty('--sheet-w', w + 'px');
}
syncSheetCssVar();
window.addEventListener('resize', syncSheetCssVar);

function setSheetCollapsed(collapsed, persist) {
  var app = $('#app');
  if (!app) return;
  app.classList.toggle('sheet-collapsed', !!collapsed);
  requestAnimationFrame(syncSheetCssVar);
  if (persist !== false) saveDrawerUi({ sheetCollapsed: !!collapsed });
}
function toggleSheetCollapsed() {
  setSheetCollapsed(true);
}
function toggleSourceEntry() {
  toggleDock('source');
}
syncModeBtn();
if ($('#tabMermaid')) $('#tabMermaid').onclick = () => setMode('mermaid');
if ($('#tabBoard')) $('#tabBoard').onclick = () => setMode('board');

window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (document.documentElement.dataset.drawerMode === 'board') renderBoard();
    else void renderDiagram();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    e.preventDefault();
    toggleSourceEntry();
  }
});


function setMode(mode, opts) {
  opts = opts || {};
  const mermaid = mode === 'mermaid';
  const next = mermaid ? 'mermaid' : 'board';
  if (!opts.restore && document.documentElement.dataset.drawerMode === next) return;
  var prevMode = document.documentElement.dataset.drawerMode || "";
  if (mermaid && prevMode === "board" && typeof flushBoardSave === "function") void flushBoardSave();
  var panelM = $('#panelMermaid');
  if (panelM) panelM.classList.toggle('active', mermaid);
  var panelBoard = $('#panelBoard');
  if (panelBoard) panelBoard.classList.toggle('active', !mermaid);
  document.documentElement.dataset.drawerMode = mermaid ? 'mermaid' : 'board';
  if (opts.persist !== false) saveDrawerUi({ mode: mermaid ? 'mermaid' : 'board' });
  syncModeBtn();
  try {
    if (mermaid) setTypeUI(sourceEl && sourceEl.value);
    else setTypeUI(boardSourceEl && boardSourceEl.value);
  } catch (_e) {}
  if (!mermaid) closeExportMenu();
  if (mermaid) {
    pinBoardTitle();
    if (!opts.restore) openDock("");
    // User switch → fit once; refresh restore → keep saved zoom/pan (Board parity)
    if (opts.restore) _drawerUiRestoreLock = true;
    var skipRender = !!(opts.restore && previewEl && previewEl.querySelector("svg"));
    var renderP = skipRender
      ? Promise.resolve()
      : Promise.resolve(renderDiagram({
          fit: opts.restore ? false : (opts.fit !== false),
          restoreView: !!opts.restore,
        }));
    void renderP.then(function() {
      if (opts.restore) {
        try {
          var ui = loadDrawerUi();
          scale = ui.scale; panX = ui.panX; panY = ui.panY;
        } catch (_e) {}
      }
      applyTransform();
      // Reveal canvas only after transform is applied (kills left-flash on refresh).
      requestAnimationFrame(function () {
        clearDrawerBoot();
        if (opts.restore) {
          requestAnimationFrame(function() { _drawerUiRestoreLock = false; });
        }
      });
    }).catch(function() {
      clearDrawerBoot();
      if (opts.restore) _drawerUiRestoreLock = false;
    });
    setStatus('Mermaid mode');
  } else {
    // User switch → fit once; refresh restore → same boardViewId and on-stage, else fit
    if (opts.restore) _drawerUiRestoreLock = true;
    var hasBoard = !!(previewEl && previewEl.querySelector(".board-render"));
    var skipBoard = !!(opts.restore && hasBoard);
    if (!skipBoard) {
      renderBoard({ fit: opts.restore ? false : (opts.fit !== false), restoreView: !!opts.restore });
      if (typeof refreshBoardHistory === 'function') void refreshBoardHistory();
    } else {
      applyRestoredBoardView();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { clearDrawerBoot(); });
      });
    }
    if (!opts.restore) openDock("");
    if (opts.restore) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { _drawerUiRestoreLock = false; });
      });
    }
    syncBoardLinkRouteButton();
    setStatus('Board mode');
  }
}

setSyncUI('ok');
(function applyDrawerUiChrome() {
  var ui = loadDrawerUi();
  setSheetCollapsed(!!ui.sheetCollapsed, false);
})();
applyTransform();
restoreCachedSvg(); // mermaid-only; board skips so refresh does not flash Mermaid SVG
function restoreDrawerMode() {
  var ui = loadDrawerUi();
  var urlMode = new URLSearchParams(location.search).get("mode");
  var mode = (urlMode === "board" || urlMode === "mermaid") ? urlMode : (ui.mode || "mermaid");
  if (urlMode === "board" || urlMode === "mermaid") saveDrawerUi({ mode: urlMode });
  document.documentElement.dataset.drawerMode = mode;
  setMode(mode, { restore: true, persist: false });
  // Restore dock after mode chrome is applied (avoid open→close flash on refresh).
  try {
    var tab = ui.dockTab || "";
    if (tab === "export" || tab === "style" || tab === "source" || tab === "props" || (tab === "layout" && mode === "board")) {
      openDock(tab);
    }
  } catch (_e) {}
}
if (document.documentElement.dataset.drawerMode === "board") {
  await bootstrapBoard();
  restoreDrawerMode();
  void bootstrap();
} else {
  await bootstrap();
  await bootstrapBoard();
  restoreDrawerMode();
}
setInterval(() => { void loadPolled(); void loadBoardPolled(); }, 1500);

/* Mermaid history list */
(function wireMermaidHistory() {
  var btn = document.getElementById('btnHistoryRefresh');
  if (btn) btn.addEventListener('click', function() { void refreshMermaidHistory(); });
  // Fill as soon as possible (no 400ms empty→full height jump).
  void refreshMermaidHistory();
})();

/* Board history list */
(function wireBoardHistory() {
  var btn = document.getElementById('btnBoardHistoryRefresh');
  if (btn) btn.addEventListener('click', function() { void refreshBoardHistory(); });
  void refreshBoardHistory();
})();

