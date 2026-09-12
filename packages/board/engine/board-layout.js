/* Independent Board constraint layoutter (Compose ConstraintLayout-inspired v0). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const View = (typeof globalThis !== 'undefined' && globalThis.BoardView) || null;
  const topViews = (board) => {
    if (View && View.topLevel) return View.topLevel(board);
    if (board && Array.isArray(board.views)) return board.views;
    return (board && board.boxes) || [];
  };

  class BoardLayoutError extends Error {
    constructor(message) { super(`Board layout: ${message}`); this.name = 'BoardLayoutError'; }
  }
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const findBoxById = (nodes, id) => {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      const hit = findBoxById(n.boxes, id);
      if (hit) return hit;
    }
    return null;
  };
  const shapeType = (box) => {
    const t = String((box && (box.type || box.kind)) || 'card').toLowerCase();
    if (t === 'container' || t === 'layout') return t;
    return t;
  };
  const propsFor = (board, id) => {
    const base = id === 'board' ? board.layout.board : (board.layout.boxes[id] || {});
    const box = id !== 'board' ? findBoxById(board.boxes, id) : null;
    const kind = box ? shapeType(box) : '';
    const isLayout = kind === 'layout';
    const isContainer = kind === 'container';
    return Object.assign(
      { direction: 'column', gap: 16, padding: 16, align: 'stretch' },
      id === 'board' ? { direction: 'row', gap: 32, padding: 24, align: 'stretch' } : {},
      // layout = pure arrangement (no inset). container = group frame and needs inset.
      isLayout ? { padding: 0 } : {},
      isContainer ? { padding: 16, paddingY: 28, paddingX: 30 } : {},
      base
    );
  };
  const allBoxes = (board) => {
    const out = [];
    const visit = (box) => { out.push(box); (box.boxes || []).forEach(visit); };
    (board.boxes || []).forEach(visit);
    return out;
  };
  const edgeOf = (frame, edge, axis) => {
    if (!frame) return NaN;
    if (axis === 'x') return edge === 'start' ? frame.x : edge === 'end' ? frame.x + frame.w : frame.x + frame.w / 2;
    return edge === 'top' ? frame.y : edge === 'bottom' ? frame.y + frame.h : frame.y + frame.h / 2;
  };
  const axisFor = (edge) => edge === 'start' || edge === 'end' || edge === 'left' || edge === 'right' ? 'x' : 'y';
  const normalizeEdge = (edge) => edge === 'left' ? 'start' : edge === 'right' ? 'end' : edge;
  const alignEdgeSets = (board, edge) => (
    ((board.layout && board.layout.aligns) || [])
      .filter((align) => normalizeEdge(align.edge) === edge)
      .map((align) => (align.ids || []).filter(Boolean))
  );

  // Same ids on opposite edges (top+bottom or start+end) stretch to the group's max.
  function dualAlignGroups(board, frames, edgeA, edgeB) {
    const parent = new Map();
    const find = (id) => {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
      return parent.get(id);
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    alignEdgeSets(board, edgeA).forEach((setA) => {
      alignEdgeSets(board, edgeB).forEach((setB) => {
        const inter = setA.filter((id) => setB.includes(id) && frames.has(id));
        for (let i = 1; i < inter.length; i += 1) union(inter[0], inter[i]);
      });
    });
    const groups = new Map();
    parent.forEach((_, id) => {
      const root = find(id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(id);
    });
    return [...groups.values()].filter((ids) => ids.length >= 2);
  }

  function equalizeDualAlignSize(board, frames, axis) {
    const edgeA = axis === 'y' ? 'top' : 'start';
    const edgeB = axis === 'y' ? 'bottom' : 'end';
    const dim = axis === 'y' ? 'h' : 'w';
    dualAlignGroups(board, frames, edgeA, edgeB).forEach((ids) => {
      const max = Math.max(...ids.map((id) => frames.get(id)[dim] || 0));
      if (!(max > 0)) return;
      ids.forEach((id) => { frames.get(id)[dim] = max; });
    });
  }

function intrinsicMinWidth(box) {
  return View.intrinsicBoxMinWidth(box);
}

function measureMap(board, measured = {}) {
  const map = new Map();
  allBoxes(board).forEach((box) => {
    const value = measured instanceof Map ? measured.get(box.id) : measured[box.id];
    let w = finite(value && (value.w == null ? value.width : value.w), 160);
    let h = finite(value && (value.h == null ? value.height : value.h), 80);
    // Measurements can be min-content widths when the article is shrink-to-fit.
    w = Math.max(intrinsicMinWidth(box), w);
    map.set(box.id, { w: Math.max(1, w), h: Math.max(1, h) });
  });
  topViews(board).forEach((node) => {
    if (!View || !View.isItem(node) || !node.id) return;
    const value = measured instanceof Map ? measured.get(node.id) : measured[node.id];
    const text = String(node.text || "");
    let w = finite(value && (value.w == null ? value.width : value.w), 80);
    let h = finite(value && (value.h == null ? value.height : value.h), 30);
    const minW = View && View.Types
      ? View.Types.wrap(node).intrinsicMinWidth()
      : (48 + Math.min(text.length, 24) * 6.4);
    w = Math.max(w, minW);
    h = Math.max(h, 28);
    if (node.shape === 'diamond') {
      w = Math.max(112, w);
      h = w / 1.4;
    }
    map.set(node.id, { w: Math.max(1, w), h: Math.max(1, h) });
  });
  return map;
}

  function adaptiveMetrics(board, sizes, options = {}) {
    const boardProps = propsFor(board, "board");
    if (options.adaptive === false) return { gap: finite(options.gap, finite(boardProps.gap, 32)), padding: finite(options.padding, finite(boardProps.padding, 24)), density: 1 };
    const boxes = allBoxes(board);
    const items = boxes.reduce((count, box) => count + (box.items || []).length, 0);
    const chars = boxes.reduce((count, box) => count + String(box.title || "").length + (box.items || []).reduce((n, item) => n + String(item.text || "").length, 0), 0);
    const density = clamp(0.94 + items * 0.006 + chars / 2600, 0.94, 1.07);
    return {
      gap: finite(options.gap, finite(boardProps.gap, 32)) * density,
      padding: finite(options.padding, finite(boardProps.padding, 24)) * clamp(0.96 + (density - 1) * 0.45, 0.94, 1.035),
      density,
    };
  }

  function compiler(board, options = {}) {
    const places = (board.layout && board.layout.places) || [];
    const constraints = [];
    const barriers = (board.layout && board.layout.barriers) || [];
    const add = (source, sourceEdge, target, targetEdge, gap = 0, mode = 'exact', line) => {
      constraints.push({ source, sourceEdge: normalizeEdge(sourceEdge), target, targetEdge: normalizeEdge(targetEdge), gap: finite(gap), mode, line });
    };
    const boardProps = propsFor(board, 'board');
    const gap = finite(options.gap, finite(boardProps.gap, 32));
    const padding = finite(options.padding, finite(boardProps.padding, 24));

    const topLevelIds = new Set(topViews(board).map((node) => node.id).filter(Boolean));
    ((board.layout && board.layout.constraints) || []).forEach((c) => {
      // Nested boxes use parent flex; board-level parent anchors only apply to top-level boxes.
      if (c.source && !topLevelIds.has(c.source)) return;
      add(c.source, c.sourceEdge, c.target, c.targetEdge, c.gap, c.mode || 'exact', c.line);
    });
    barriers.forEach((barrier) => constraints.push({ type: 'barrier', id: barrier.id, edge: normalizeEdge(barrier.edge), refs: barrier.refs.slice(), line: barrier.line }));

    places.forEach((place) => {
      const source = place.source;
      place.targets.forEach((target) => {
        switch (place.relation) {
          case 'after': case 'right-of': add(source, 'start', target, 'end', gap, 'max', place.line); break;
          case 'before': case 'left-of': add(source, 'end', target, 'start', -gap, 'min', place.line); break;
          case 'below': add(source, 'top', target, 'bottom', gap, 'max', place.line); break;
          case 'above': add(source, 'bottom', target, 'top', -gap, 'min', place.line); break;
        }
        if (place.relation === 'right-of' || place.relation === 'left-of') add(source, 'top', target, 'top', 0, 'exact', place.line);
        if ((place.relation === 'below' || place.relation === 'above') && place.targets.length === 1) add(source, 'start', target, 'start', 0, 'exact', place.line);
      });
    });

    // Multiple vertical targets become a barrier (the union's bottom/top).
    places.filter((p) => ['below', 'above'].includes(p.relation) && p.targets.length > 1).forEach((place) => {
      const id = `__barrier_${place.source}_${place.line || constraints.length}`;
      const edge = place.relation === 'below' ? 'bottom' : 'top';
      constraints.push({ type: 'barrier', id, edge, refs: place.targets.slice(), line: place.line });
      constraints.push({ source: place.source, sourceEdge: place.relation === 'below' ? 'top' : 'bottom', target: id, targetEdge: edge, gap, mode: place.relation === 'below' ? 'max' : 'min', line: place.line });
    });

    ((board.layout && board.layout.aligns) || []).forEach((align) => {
      const ids = (align.ids || []).filter((id) => topLevelIds.has(id));
      if (ids.length < 2) return;
      const edge = normalizeEdge(align.edge);
      const ref = ids[0];
      ids.slice(1).forEach((id) => add(id, edge, ref, edge, 0, 'exact', align.line));
    });

    const top = board.boxes || [];
    if (!places.some((p) => !['below', 'above'].includes(p.relation)) && !(board.layout && board.layout.constraints && board.layout.constraints.length) && boardProps.direction === 'row') {
      top.forEach((box, index) => {
        if (index === 0) add(box.id, 'start', 'parent', 'start', padding, 'exact');
        else add(box.id, 'start', top[index - 1].id, 'end', gap, 'max');
      });
    }
    return { constraints, barriers: constraints.filter((c) => c.type === 'barrier'), props: boardProps };
  }

  function graphFor(compiled) {
    const graph = new Map();
    const edge = (from, to) => {
      if (from === 'parent' || to === 'parent' || from === to) return;
      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from).add(to);
    };
    compiled.constraints.forEach((c) => {
      if (c.type === 'barrier') c.refs.forEach((ref) => edge(ref, c.id));
      else edge(c.target, c.source);
    });
    return graph;
  }

  function topologicalOrder(ids, graph) {
    const visiting = new Set(), visited = new Set(), order = [];
    function visit(id, path) {
      if (visiting.has(id)) throw new BoardLayoutError(`constraint cycle: ${path.concat(id).join(' -> ')}`);
      if (visited.has(id)) return;
      visiting.add(id);
      (graph.get(id) || []).forEach((next) => visit(next, path.concat(id)));
      visiting.delete(id); visited.add(id); order.push(id);
    }
    ids.forEach((id) => visit(id, []));
    return order.reverse();
  }

  function solve(board, measured = {}, options = {}) {
    const sizes = measureMap(board, measured);
    const metrics = adaptiveMetrics(board, sizes, options);
    const solveOptions = Object.assign({}, options, metrics);
    const compiled = compiler(board, solveOptions);
    const props = compiled.props;
    const padding = metrics.padding;
    const gap = metrics.gap;
    const parentW = Math.max(1, finite(options.width, 1200));
    // Nested boxes are laid out by parent flex in the renderer, not the board constraint solver.
    const ids = topViews(board).map((node) => node.id).filter(Boolean);
    const frames = new Map();
    ids.forEach((id) => { const s = sizes.get(id); frames.set(id, { id, x: padding, y: padding, w: s.w, h: s.h }); });
    equalizeDualAlignSize(board, frames, 'y');
    const parent = { id: 'parent', x: 0, y: 0, w: parentW, h: finite(options.height, 0) };
    const pseudo = new Map();
    const graph = graphFor(compiled);
    const order = topologicalOrder(ids.concat(compiled.barriers.map((b) => b.id)), graph);
    const incoming = new Map();
    compiled.constraints.forEach((c) => {
      if (c.type !== 'barrier') {
        if (!incoming.has(c.source)) incoming.set(c.source, []);
        incoming.get(c.source).push(c);
      }
    });
    const anchor = (id, edge, axis) => {
      if (id === 'parent') return edgeOf(parent, edge, axis);
      if (pseudo.has(id)) return pseudo.get(id).value;
      return edgeOf(frames.get(id), edge, axis);
    };
    order.forEach((id) => {
      const barrier = compiled.barriers.find((b) => b.id === id);
      if (barrier) {
        const axis = axisFor(barrier.edge);
        const values = barrier.refs.map((ref) => anchor(ref, barrier.edge, axis)).filter(Number.isFinite);
        if (values.length !== barrier.refs.length) throw new BoardLayoutError(`barrier ${id} references unresolved box`);
        pseudo.set(id, { value: barrier.edge === 'top' ? Math.min(...values) : Math.max(...values), axis });
        return;
      }
      const frame = frames.get(id), cs = incoming.get(id) || [];
      ['x', 'y'].forEach((axis) => {
        const relevant = cs.filter((c) => axisFor(c.sourceEdge) === axis);
        if (!relevant.length) return;
        const candidates = relevant.map((c) => {
          const target = anchor(c.target, c.targetEdge, axis);
          if (!Number.isFinite(target)) throw new BoardLayoutError(`unresolved ${c.target}.${c.targetEdge} for ${c.source}`);
          const sourceOffset = axis === 'x' ? (c.sourceEdge === 'start' ? 0 : c.sourceEdge === 'end' ? frame.w : frame.w / 2) : (c.sourceEdge === 'top' ? 0 : c.sourceEdge === 'bottom' ? frame.h : frame.h / 2);
          return { c, value: target + c.gap - sourceOffset };
        });
        const exact = candidates.filter((item) => item.c.mode === 'exact');
        const chosen = exact.length ? exact[0].value : candidates.reduce((value, item) => item.c.mode === 'min' ? Math.min(value, item.value) : Math.max(value, item.value), candidates[0].value);
        if (axis === 'x') frame.x = chosen; else frame.y = chosen;
      });
    });

    // Parent start+end means stretch across the parent content width/height.
    const finalConstraints = compiled.constraints.filter((c) => c.type !== 'barrier');
    ids.forEach((id) => {
      const frame = frames.get(id), cs = finalConstraints.filter((c) => c.source === id);
      const startX = cs.find((c) => c.sourceEdge === 'start');
      const endX = cs.find((c) => c.sourceEdge === 'end');
      if (startX && endX) { const left = anchor(startX.target, startX.targetEdge, 'x'); const right = anchor(endX.target, endX.targetEdge, 'x'); frame.x = left + startX.gap; frame.w = Math.max(sizes.get(id).w, right + endX.gap - frame.x); }
      const startY = cs.find((c) => c.sourceEdge === 'top' && c.target === 'parent');
      const endY = cs.find((c) => c.sourceEdge === 'bottom' && c.target === 'parent');
      if (startY && endY && parent.h > 0) { frame.y = padding + startY.gap; frame.h = Math.max(1, parent.h - frame.y + endY.gap); }
    });

    // Final CSS remeasurement can make a box taller/wider than the original
    // constraint solve. Keep the engine's AABB contract intact by separating
    // only genuinely intersecting top-level boxes; this is deterministic and
    // preserves the solved horizontal routes.
    const collisionGap = Math.max(12, gap * 0.5);
    const collidable = ids;
    for (let pass = 0; pass < collidable.length; pass += 1) {
      let moved = false;
      for (let i = 0; i < collidable.length; i += 1) {
        for (let j = i + 1; j < collidable.length; j += 1) {
          const a = frames.get(collidable[i]), b = frames.get(collidable[j]);
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const lower = a.y <= b.y ? b : a;
          const upper = lower === b ? a : b;
          const nextY = upper.y + upper.h + collisionGap;
          if (lower.y < nextY) { lower.y = nextY; moved = true; }
        }
      }
      if (!moved) break;
    }

    const naturalRight = Math.max(padding, ...ids.map((id) => {
      const frame = frames.get(id);
      return frame.x + frame.w;
    }));
    const fittedWidth = Math.max(padding * 2, Math.ceil(naturalRight + padding));
    if (options.fit !== false && !options._fitted && Math.abs(fittedWidth - parentW) > 1) {
      return solve(board, measured, Object.assign({}, options, { width: fittedWidth, _fitted: true }));
    }
    const bottom = Math.max(padding, ...ids.map((id) => frames.get(id).y + frames.get(id).h));
    const height = Math.ceil(bottom + padding);
    parent.h = height;
    frames.forEach((f) => ['x', 'y', 'w', 'h'].forEach((key) => {
      if (!Number.isFinite(f[key])) throw new BoardLayoutError(`non-finite frame for ${f.id}`);
      f[key] = Math.round(f[key] * 100) / 100;
    }));
    return { frames, constraints: compiled.constraints, graph, width: Math.ceil(parentW), height, parent: { ...parent }, barriers: compiled.barriers, metrics };
  }

  function layout(board, measured, options) {
    const compiled = compiler(board, options || {});
    return Object.assign({ compiled }, solve(board, measured, options || {}));
  }

  return { compile: compiler, solve, layout, BoardLayoutError };
});
