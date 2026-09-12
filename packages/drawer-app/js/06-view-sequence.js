/* drawer-app/06-view-sequence.js — lines 2899-3336 of former inline module */
function pinClusterTitlesTopLeft(svg) {
  if (!svg) return;
  // Mermaid centers subgraph titles; pin each cluster-label to its rect top-left.
  const padX = 10, padY = 2;
  for (const cluster of svg.querySelectorAll('g.cluster')) {
    const rect = cluster.querySelector(':scope > rect');
    const label = cluster.querySelector(':scope > g.cluster-label');
    if (!rect || !label) continue;
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    label.setAttribute('transform', `translate(${x + padX}, ${y + padY})`);
    label.setAttribute('data-title-corner', '1');
    for (const el of label.querySelectorAll('div, p, span')) {
      el.style.textAlign = 'left';
      if (el.style.maxWidth) el.style.maxWidth = 'none';
    }
  }
}


function tuneSequenceFrames(svg) {
  if (!svg) return;
  // 1) Frame inner padding: grow outer edges away from content.
  // 2) Badge inner padding: size labelBox from measured text (Note-style).
  const FRAME_PAD = { altBottom: 36, loopLeft: 32, loopBottom: 36 };
  const BADGE_PAD = {
    alt:  { left: 10, right: 12, top: 10, bottom: 10 },
    loop: { left: 14, right: 12, top: 10, bottom: 10 },
    _:    { left: 10, right: 10, top: 8, bottom: 8 },
  };
  const near = (a, b) => Math.abs(a - b) < 0.75;
  const parents = new Set([...svg.querySelectorAll('line.loopLine')].map((l) => l.parentElement));
  for (const g of parents) {
    if (!g) continue;
    const lines = [...g.querySelectorAll(':scope > line.loopLine')];
    if (lines.length < 4) continue;

    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    for (const l of lines) {
      const a = Number(l.getAttribute('x1'));
      const b = Number(l.getAttribute('x2'));
      const c = Number(l.getAttribute('y1'));
      const d = Number(l.getAttribute('y2'));
      x1 = Math.min(x1, a, b);
      x2 = Math.max(x2, a, b);
      y1 = Math.min(y1, c, d);
      y2 = Math.max(y2, c, d);
    }
    if (!Number.isFinite(x1) || x2 - x1 < 40) continue;

    const poly = g.querySelector(':scope > polygon.labelBox');
    const labelText = g.querySelector(':scope > text.labelText');
    const kind = ((labelText && labelText.textContent) || '').trim().split(/\s+/)[0].toLowerCase();

    let padL = 0;
    let padB = 0;
    if (kind === 'alt') padB = FRAME_PAD.altBottom;
    if (kind === 'loop') {
      padL = FRAME_PAD.loopLeft;
      padB = FRAME_PAD.loopBottom;
    }

    const nx1 = x1 - padL;
    const ny2 = y2 + padB;
    if (padL || padB) {
      for (const l of lines) {
        let lx1 = Number(l.getAttribute('x1'));
        let lx2 = Number(l.getAttribute('x2'));
        let ly1 = Number(l.getAttribute('y1'));
        let ly2 = Number(l.getAttribute('y2'));
        if (padL) {
          if (near(lx1, x1)) lx1 = nx1;
          if (near(lx2, x1)) lx2 = nx1;
        }
        if (padB) {
          if (near(ly1, y2)) ly1 = ny2;
          if (near(ly2, y2)) ly2 = ny2;
        }
        l.setAttribute('x1', String(lx1));
        l.setAttribute('x2', String(lx2));
        l.setAttribute('y1', String(ly1));
        l.setAttribute('y2', String(ly2));
      }
      if (padL && poly) {
        const pts = (poly.getAttribute('points') || '').trim().split(/\s+/).map((pt) => {
          const [px, py] = pt.split(',').map(Number);
          return `${px - padL},${py}`;
        });
        poly.setAttribute('points', pts.join(' '));
      }
      if (padL && labelText) {
        labelText.setAttribute('x', String(Number(labelText.getAttribute('x')) - padL));
      }
      x1 = nx1;
      y2 = ny2;
    }

    const loopTexts = [...g.querySelectorAll(':scope > text.loopText')];
    const titleConds = [];
    const elseConds = [];
    for (const t of loopTexts) {
      const ty = Number(t.getAttribute('y'));
      const onTitleBar = Number.isFinite(ty) && Math.abs(ty - (y1 + 18)) < 28;
      if (onTitleBar) titleConds.push(t);
      else elseConds.push(t);
    }

    if (poly && labelText) {
      if (titleConds.length) {
        const kw = (labelText.textContent || '').trim().split(/\s+/)[0];
        const cond = titleConds.map((t) => (t.textContent || '').trim()).filter(Boolean).join(' ');
        const combined = cond ? `${kw} ${cond}` : kw;
        while (labelText.firstChild) labelText.removeChild(labelText.firstChild);
        labelText.textContent = combined;
        for (const t of titleConds) t.remove();
      }

      const bp = BADGE_PAD[kind] || BADGE_PAD._;
      labelText.setAttribute('text-anchor', 'start');
      labelText.setAttribute('dominant-baseline', 'hanging');
      labelText.setAttribute('alignment-baseline', 'hanging');
      // Park text, measure, then wrap polygon with real padding.
      labelText.setAttribute('x', String(x1 + bp.left));
      labelText.setAttribute('y', String(y1 + bp.top));

      let tb = { x: x1 + bp.left, y: y1 + bp.top, width: Math.max(40, (labelText.textContent || '').length * 7.2), height: 16 };
      try {
        const bb = labelText.getBBox();
        if (bb && bb.width > 0) tb = bb;
      } catch (_) {}

      // Hang baselines often sit above the y attr — nudge so top pad is real.
      const topGap = tb.y - y1;
      if (topGap < bp.top) {
        const dy = bp.top - topGap;
        labelText.setAttribute('y', String(Number(labelText.getAttribute('y')) + dy));
        tb = { x: tb.x, y: tb.y + dy, width: tb.width, height: tb.height };
        try {
          const bb2 = labelText.getBBox();
          if (bb2 && bb2.width > 0) tb = bb2;
        } catch (_) {}
      }

      const bx = x1;
      const by = y1;
      const bw = Math.ceil((tb.x - x1) + tb.width + bp.right);
      const bh = Math.ceil((tb.y - y1) + tb.height + bp.bottom);
      const notch = Math.min(8.4, bh * 0.4);
      poly.setAttribute(
        'points',
        `${bx},${by} ${bx + bw},${by} ${bx + bw},${by + bh - notch} ${bx + bw - notch},${by + bh} ${bx},${by + bh}`
      );
    }

    for (const t of elseConds) {
      t.setAttribute('text-anchor', 'start');
      t.setAttribute('x', String(x1 + 12));
      for (const span of t.querySelectorAll('tspan')) {
        span.setAttribute('x', String(x1 + 12));
      }
      t.setAttribute('data-loop-edge', '1');
    }
  }
}

function clearSequenceFrameActorOverlap(svg) {
  if (!svg) return;
  // If any alt/loop bottom edge cuts through bottom participant boxes, push
  // those actors (and their labels) down and extend vertical lifelines.
  let frameBottom = -Infinity;
  for (const l of svg.querySelectorAll('line.loopLine')) {
    frameBottom = Math.max(frameBottom, Number(l.getAttribute('y1')), Number(l.getAttribute('y2')));
  }
  if (!Number.isFinite(frameBottom)) return;

  const bottoms = [...svg.querySelectorAll('rect.actor-bottom')];
  if (!bottoms.length) return;
  let actorTop = Infinity;
  for (const r of bottoms) actorTop = Math.min(actorTop, Number(r.getAttribute('y')));
  if (!Number.isFinite(actorTop)) return;

  const gap = 12;
  const need = frameBottom + gap;
  if (actorTop >= need) return;
  const shift = need - actorTop;

  const bump = (el, attrs) => {
    for (const a of attrs) {
      const v = Number(el.getAttribute(a));
      if (Number.isFinite(v)) el.setAttribute(a, String(v + shift));
    }
  };

  for (const r of bottoms) bump(r, ['y']);
  // Labels sitting on bottom actors (same vertical band).
  for (const t of svg.querySelectorAll('text.actor, text.actor-box')) {
    const y = Number(t.getAttribute('y'));
    if (Number.isFinite(y) && y >= actorTop - 4) bump(t, ['y']);
  }
  // Extend vertical lifelines that end at/near the old actor top.
  for (const l of svg.querySelectorAll('line')) {
    const cls = l.getAttribute('class') || '';
    if (cls.includes('loopLine')) continue;
    const y1 = Number(l.getAttribute('y1'));
    const y2 = Number(l.getAttribute('y2'));
    if (![y1, y2].every(Number.isFinite)) continue;
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    // Lifeline: tall vertical line ending near bottom actors.
    if (Math.abs(Number(l.getAttribute('x1')) - Number(l.getAttribute('x2'))) < 0.75 && hi >= actorTop - 30) {
      if (y2 >= y1) l.setAttribute('y2', String(y2 + shift));
      else l.setAttribute('y1', String(y1 + shift));
    }
  }
}

function lowerSequenceFramesBehindActors(svg) {
  if (!svg) return;
  const actors = svg.querySelector('g > rect.actor, rect.actor');
  // Insert each loop-frame group before the first actor rect's parent group or first actor.
  let anchor = null;
  for (const el of svg.querySelectorAll('rect.actor, text.actor')) {
    anchor = el;
    break;
  }
  if (!anchor) return;
  const parents = new Set([...svg.querySelectorAll('line.loopLine')].map((l) => l.parentElement));
  for (const g of parents) {
    if (!g || !g.parentNode) continue;
    // Move frame group earlier in DOM so actors/messages paint above the borders.
    g.parentNode.insertBefore(g, g.parentNode.firstChild);
  }
}


function polishSequenceActors(svg) {
  if (!svg) return;
  const theme = (document.documentElement.dataset.diagramTheme || 'default').toLowerCase();
  const r = theme === 'kami' ? 3 : 8;
  for (const rect of svg.querySelectorAll('rect.actor')) {
    rect.setAttribute('rx', String(r));
    rect.setAttribute('ry', String(r));
  }
}

function styleSequenceLoopLines(svg) {
  if (!svg) return;
  let solid = '#8a8a8e';
  let dashed = '#5c5c60';
  try {
    const tid = (typeof currentDiagramTheme === 'function')
      ? currentDiagramTheme()
      : (document.documentElement.dataset.diagramTheme || 'default');
    if (window.MermaidSequenceThemes && typeof MermaidSequenceThemes.frameColors === 'function') {
      const f = MermaidSequenceThemes.frameColors(tid);
      if (f && f.solid) solid = f.solid;
      if (f && f.dashed) dashed = f.dashed;
    }
  } catch (_e) {}
  for (const l of svg.querySelectorAll('line.loopLine')) {
    const dash = l.style.strokeDasharray || l.getAttribute('stroke-dasharray') || '';
    const color = dash && dash !== 'none' ? dashed : solid;
    l.setAttribute('stroke', color);
    l.style.stroke = color;
  }
}

function styleSequenceNotes(svg) {
  if (!svg) return;
  // Sticky note: size box from real text bounds + L/R padding, then dog-ear.
  const fold = 14;
  const padX = 14; // half of prior 28
  for (const rect of [...svg.querySelectorAll('rect.note')]) {
    const g = rect.parentElement;
    if (!g || rect.getAttribute('data-dogear') === '1') continue;
    const y = Number(rect.getAttribute('y'));
    const h = Number(rect.getAttribute('height'));
    if (![y, h].every(Number.isFinite) || h < fold * 2) continue;

    const texts = [...g.querySelectorAll('text.noteText')];
    let minX = Infinity;
    let maxX = -Infinity;
    for (const t of texts) {
      try {
        const bb = t.getBBox();
        if (bb && bb.width > 0) {
          minX = Math.min(minX, bb.x);
          maxX = Math.max(maxX, bb.x + bb.width);
          continue;
        }
      } catch (_) {}
      // fallback if getBBox fails
      const tx = Number(t.getAttribute('x'));
      const approx = ((t.textContent || '').length * 7.2);
      const anchor = t.getAttribute('text-anchor') || 'middle';
      if (anchor === 'middle') {
        minX = Math.min(minX, tx - approx / 2);
        maxX = Math.max(maxX, tx + approx / 2);
      } else {
        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx + approx);
      }
    }
    // If measurement failed, fall back to Mermaid rect + fixed pad.
    let x;
    let w;
    if (Number.isFinite(minX) && maxX > minX) {
      x = minX - padX;
      w = (maxX - minX) + padX * 2;
    } else {
      const x0 = Number(rect.getAttribute('x'));
      const w0 = Number(rect.getAttribute('width'));
      if (![x0, w0].every(Number.isFinite)) continue;
      x = x0 - padX;
      w = w0 + padX * 2;
    }
    if (w < fold * 2) continue;

    const fill = rect.getAttribute('fill') || '#EDF2AE';
    const stroke = rect.getAttribute('stroke') || '#666';
    const cls = rect.getAttribute('class') || 'note';

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('class', cls);
    body.setAttribute('data-dogear', '1');
    body.setAttribute('fill', fill);
    body.setAttribute('stroke', stroke);
    body.setAttribute('stroke-width', rect.getAttribute('stroke-width') || '1');
    body.setAttribute(
      'd',
      `M ${x} ${y} L ${x + w - fold} ${y} L ${x + w} ${y + fold} L ${x + w} ${y + h} L ${x} ${y + h} Z`
    );

    const ear = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ear.setAttribute('class', 'noteDogear');
    ear.setAttribute('fill', shadeHex(fill, -0.18));
    ear.setAttribute('stroke', stroke);
    ear.setAttribute('stroke-width', '1');
    ear.setAttribute(
      'd',
      `M ${x + w - fold} ${y} L ${x + w} ${y + fold} L ${x + w - fold} ${y + fold} Z`
    );

    const crease = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    crease.setAttribute('class', 'noteDogearCrease');
    crease.setAttribute('fill', 'none');
    crease.setAttribute('stroke', stroke);
    crease.setAttribute('stroke-opacity', '0.45');
    crease.setAttribute('stroke-width', '1');
    crease.setAttribute('d', `M ${x + w - fold} ${y} L ${x + w - fold} ${y + fold} L ${x + w} ${y + fold}`);

    g.insertBefore(body, rect);
    g.insertBefore(ear, rect);
    g.insertBefore(crease, rect);
    rect.remove();
  }
}

function shadeHex(hex, delta) {
  // delta in [-1,1]; negative = darker. Falls back to a muted yellow-gray.
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#c9c98a';
  const n = parseInt(m[1], 16);
  const ch = (i) => {
    let v = (n >> (8 * (2 - i))) & 255;
    v = Math.max(0, Math.min(255, Math.round(v + delta * 255)));
    return v;
  };
  return `#${[ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function fixSvgIntrinsic(svg) {
  if (!svg) return;
  // Kill width="100%" / max-width stretching (common on sequenceDiagram).
  // Prefer Mermaid viewBox pixel size; fall back to getBBox.
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    svg.setAttribute('width', String(Math.ceil(vb[2])));
    svg.setAttribute('height', String(Math.ceil(vb[3])));
  } else {
    try {
      const bb = svg.getBBox();
      if (bb && bb.width && bb.height) {
        const pad = 8;
        svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
        svg.setAttribute('width', String(Math.ceil(bb.width + pad * 2)));
        svg.setAttribute('height', String(Math.ceil(bb.height + pad * 2)));
      }
    } catch (_) {}
  }
  svg.style.width = 'auto';
  svg.style.height = 'auto';
  svg.style.maxWidth = 'none';
}

function centerView() {
  if (document.documentElement.dataset.drawerMode === 'board') { fitBoardView(); flushDrawerUiSave(); return; }
  // Default adaptive size vs canvas: keep the larger side in [50%, 90%].
  // Too big → shrink to 90%; too small → grow to 50%; else keep intrinsic (1).
  scale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
  requestAnimationFrame(() => {
    const content = previewEl.querySelector('svg, .board-render');
    if (!content) return;
    const wrap = stageEl.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    if (!box.width || !box.height || !wrap.width || !wrap.height) return;
    const rawW = box.width / (scale || 1);
    const rawH = box.height / (scale || 1);
    const dominant = Math.max(rawW / wrap.width, rawH / wrap.height);
    if (dominant > 0.9) scale = 0.9 / dominant;
    else if (dominant < 0.5) scale = 0.5 / dominant;
    else scale = 1;
    scale = Math.max(0.2, Math.min(3, scale));
    applyTransform();
    requestAnimationFrame(() => {
      const box2 = content.getBoundingClientRect();
      panX += (wrap.left + wrap.width / 2) - (box2.left + box2.width / 2);
      panY += (wrap.top + wrap.height / 2) - (box2.top + box2.height / 2);
      applyTransform();
    });
  });
}
function pinTopLeft() { centerView(); } // compat alias
function fitView() {
  if (document.documentElement.dataset.drawerMode === 'board') { fitBoardView(); return; }
  const content = previewEl.querySelector('svg, .board-render');
  if (!content) return;
  const wrap = stageEl.getBoundingClientRect();
  const box = content.getBoundingClientRect();
  const rawW = box.width / (scale || 1);
  const rawH = box.height / (scale || 1);
  if (!rawW || !rawH) return;
  scale = Math.max(0.2, Math.min((wrap.width - 96) / rawW, (wrap.height - 120) / rawH, 2.5));
  panX = 48; panY = 72;
  applyTransform();
}

// resize sheet
(() => {
  const handle = $('#resize');
  let drag = false;
  handle.addEventListener('pointerdown', (e) => {
    drag = true; handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return; syncSheetCssVar();
    const x = Math.min(560, Math.max(280, e.clientX));
    document.documentElement.style.setProperty('--side', x + 'px');
  });
  handle.addEventListener('pointerup', () => { drag = false; });
})();


let chromeTimer = null;
