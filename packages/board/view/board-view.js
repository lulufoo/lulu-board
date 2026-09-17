/* Internal placed-node base. Not a Board protocol keyword. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function role(node) {
    if (!node) return null;
    if (node.role === 'item' || node.kind === 'item') return 'item';
    return 'box';
  }

  function isItem(node) { return role(node) === 'item'; }
  function isBox(node) { return role(node) === 'box'; }

  function intrinsicBoxMinWidth(box) {
    const title = String((box && box.title) || '').split(/\s+—\s+|\s*\([^()]*\)\s*$/)[0];
    const hasIcon = box && box.icon != null && box.icon !== '' && Number.isInteger(Number(box.icon));
    const iconPad = hasIcon ? 22 : 0;
    return Math.max(112, 42 + iconPad + Math.min(title.length, 34) * 6.4);
  }

  // Row/column flex need: max(width sum, first-to-last span) plus padding.
  // Summing widths alone misses board-slot gaps, so the last kid can sit past the frame.
  function flexContentNeed(kids, opts) {
    const row = !!(opts && opts.row);
    const padX = Number(opts && opts.padX) || 0;
    const padY = Number(opts && opts.padY) || 0;
    const titleH = Number(opts && opts.titleH) || 0;
    if (!kids || !kids.length) return null;
    let minMain = Infinity;
    let maxMain = -Infinity;
    let sum = 0;
    let cross = 0;
    kids.forEach((kid) => {
      const kw = Number(kid.offsetWidth) || 0;
      const kh = Number(kid.offsetHeight) || 0;
      const start = row ? (Number(kid.offsetLeft) || 0) : (Number(kid.offsetTop) || 0);
      const mainSize = row ? kw : kh;
      minMain = Math.min(minMain, start);
      maxMain = Math.max(maxMain, start + mainSize);
      sum += mainSize;
      if (!kid.isSlot) cross = Math.max(cross, row ? kh : kw);
    });
    const span = Math.max(sum, maxMain - minMain);
    return {
      w: Math.ceil((row ? span : cross) + padX),
      h: Math.ceil((row ? cross : span) + padY + titleH),
    };
  }

  function mark(node, viewRole) {
    if (node) node.role = viewRole;
    return node;
  }

  function topLevel(board) {
    if (board && Array.isArray(board.views)) return board.views;
    return (board && board.boxes) || [];
  }

  function topBoxes(board) {
    return topLevel(board).filter(isBox);
  }

  function topItems(board) {
    return topLevel(board).filter(isItem);
  }

  function adopt(board) {
    if (!board) return board;
    if (!Array.isArray(board.views)) board.views = ((board.boxes || []).slice());
    board.boxes = board.views.filter(isBox);
    return board;
  }

  function pushTop(board, node) {
    if (!board) return node;
    if (!Array.isArray(board.views)) board.views = ((board.boxes || []).slice());
    board.views.push(node);
    adopt(board);
    return node;
  }

  function removeTop(board, node) {
    if (!board || !node || !Array.isArray(board.views)) return false;
    const index = board.views.indexOf(node);
    if (index < 0) return false;
    board.views.splice(index, 1);
    adopt(board);
    return true;
  }

  class Node {
    constructor(data) {
      this.data = data || {};
    }
    get id() { return this.data.id || null; }
    roleName() { return 'view'; }
    typeName() { return ''; }
    mount() { throw new Error('Board view is abstract'); }
    applyFrame(el, frame) {
      if (!el || !frame || el.dataset.boardNested === '1') return;
      el.style.left = `${frame.x}px`;
      el.style.top = `${frame.y}px`;
      el.style.width = `${frame.w}px`;
    }
    intrinsicMinWidth() { return 48; }
    measureLive(el, base) {
      const fallbackW = (base && base.w) || 80;
      const fallbackH = (base && base.h) || 30;
      if (!el) return { w: fallbackW, h: fallbackH };
      const layoutW = el.offsetWidth || el.clientWidth || fallbackW;
      const layoutH = el.offsetHeight || el.clientHeight || fallbackH;
      // Halo is inset -8px and sits in scroll overflow. Do not feed it back.
      const halo = el.querySelector && el.querySelector(':scope > .board-layout-halo');
      if (halo) {
        return { w: Math.max(fallbackW, layoutW), h: Math.max(fallbackH, layoutH) };
      }
      const overflowX = Math.max(0, el.scrollWidth - el.clientWidth);
      const overflowY = Math.max(0, el.scrollHeight - el.clientHeight);
      return {
        w: Math.max(fallbackW, layoutW + overflowX),
        h: Math.max(fallbackH, layoutH + overflowY),
      };
    }
  }

  const boxCtors = Object.create(null);
  const itemCtors = Object.create(null);

  const Types = {
    registerBox(type, Ctor) { boxCtors[type] = Ctor; },
    registerItem(type, Ctor) { itemCtors[type] = Ctor; },
    box(type, data) {
      const key = String(type || 'card').toLowerCase();
      const Ctor = boxCtors[key] || boxCtors.card;
      if (!Ctor) throw new Error('Board box type is not registered: ' + key);
      return new Ctor(data);
    },
    item(type, data) {
      const key = String(type || 'chip').toLowerCase();
      const Ctor = itemCtors[key] || itemCtors.chip;
      if (!Ctor) throw new Error('Board item type is not registered: ' + key);
      return new Ctor(data);
    },
    wrap(node) {
      if (isItem(node)) return Types.item(node.type || 'chip', node);
      const raw = String((node && (node.type || node.kind)) || 'card').toLowerCase();
      const type = raw === 'container' ? 'container' : raw;
      return Types.box(type, node);
    },
  };

  return {
    role, isItem, isBox, mark, topLevel, topBoxes, topItems, adopt, pushTop, removeTop,
    intrinsicBoxMinWidth, flexContentNeed, Node, Types,
  };
});
