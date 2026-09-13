/* Board protocol beta HTML/CSS renderer. Source for board.min.js. No Mermaid. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const Layout = root.BoardLayout || (typeof require === 'function' ? require('./board-layout') : null);
  const Route = root.BoardRoute || (typeof require === 'function' ? require('./board-route') : null);
  const Arrow = root.BoardRouteArrow || (typeof require === 'function' ? require('./board-route/arrow') : null);
  const View = root.BoardView || (typeof require === 'function' ? require('../view/board-view') : null);
  const Icons = root.BoardIcons || (typeof require === 'function' ? require('../item/icons.js') : null);
  const Themes = root.BoardThemes || null;

  const IDENT = /^[A-Za-z_][\w.-]*$/;
  const DIRECTIONS = new Set(['row', 'column']);
  const RELATIONS = new Set(['after', 'before', 'left-of', 'right-of', 'above', 'below']);
  const ALIGN = new Set(['start', 'center', 'stretch']);
  const JUSTIFY = new Set(['start', 'center', 'stretch']);
  const BOX_TYPES = new Set(['card', 'container', 'layout']);
  const ITEM_TYPES = new Set(['chip', 'text', 'note', 'icon']);
  const CHIP_SHAPES = new Set(['rect', 'diamond']);
  const ITEM_CAPS = new Set(['on', 'off']);
  const LINK_TYPES = new Set(['solid', 'dashed']);
  const STYLE_THEMES = new Set(['default', 'classic', 'pastel', 'kami']);
  const STYLE_ROUTES = new Set(['trunk', 'stagger', 'straight']);
  const STYLE_DEFAULTS = { theme: 'default', item_cap: 16, link_route: 'stagger', type_step: 0 };
  const STYLE_CAP_MIN = 8;
  const STYLE_CAP_MAX = 24;
  const STYLE_TYPE_MIN = -3;
  const STYLE_TYPE_MAX = 3;
  function normalizeBoxType(raw, lineNo) {
    const key = String(raw || 'card').toLowerCase();
    if (key === 'diamond') return 'diamond';
    if (BOX_TYPES.has(key)) return key;
    fail(`unknown box type '${raw}'`, lineNo);
  }
  function normalizeChipShape(raw, lineNo) {
    const key = String(raw || 'rect').toLowerCase();
    if (CHIP_SHAPES.has(key)) return key;
    fail(`chip shape must be rect or diamond`, lineNo);
  }
  function normalizeItemCap(raw, lineNo) {
    const key = String(raw || 'on').toLowerCase();
    if (ITEM_CAPS.has(key)) return key;
    fail('cap must be on or off', lineNo);
  }
  function encodeStylePayload(obj) {
    const json = JSON.stringify(obj || {});
    if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(json)));
  }
  function decodeStylePayload(b64) {
    try {
      const raw = String(b64 || '').replace(/\s+/g, '');
      if (!raw) return {};
      const json = typeof Buffer !== 'undefined'
        ? Buffer.from(raw, 'base64').toString('utf8')
        : decodeURIComponent(escape(atob(raw)));
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      return data;
    } catch (_) {
      return {};
    }
  }
  function clampItemCap(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return STYLE_DEFAULTS.item_cap;
    return Math.min(STYLE_CAP_MAX, Math.max(STYLE_CAP_MIN, n));
  }
  function clampTypeStep(value) {
    const Scale = root.BoardTypeScale;
    if (Scale && typeof Scale.clampStep === 'function') return Scale.clampStep(value);
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return STYLE_DEFAULTS.type_step;
    return Math.min(STYLE_TYPE_MAX, Math.max(STYLE_TYPE_MIN, n));
  }
  function authoredViewport(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const scale = Number(raw.scale);
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (!Number.isFinite(scale) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      scale: Math.min(3, Math.max(0.2, scale)),
      x: Math.round(x),
      y: Math.round(y),
    };
  }
  function authoredStyle(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};
    if (STYLE_THEMES.has(src.theme) && src.theme !== STYLE_DEFAULTS.theme) out.theme = src.theme;
    if (src.item_cap != null && src.item_cap !== '') {
      const n = clampItemCap(src.item_cap);
      if (n !== STYLE_DEFAULTS.item_cap) out.item_cap = n;
    }
    if (STYLE_ROUTES.has(src.link_route) && src.link_route !== STYLE_DEFAULTS.link_route) out.link_route = src.link_route;
    if (src.type_step != null && src.type_step !== '') {
      const n = clampTypeStep(src.type_step);
      if (n !== STYLE_DEFAULTS.type_step) out.type_step = n;
    }
    const viewport = authoredViewport(src.viewport || src.view);
    if (viewport) out.viewport = viewport;
    Object.keys(src).forEach((key) => {
      if (key === 'theme' || key === 'item_cap' || key === 'link_route' || key === 'type_step' || key === 'view' || key === 'viewport') return;
      if (src[key] == null) return;
      out[key] = src[key];
    });
    return out;
  }
  function resolveStyle(board) {
    const src = board && board.style && typeof board.style === 'object' && !Array.isArray(board.style)
      ? board.style
      : {};
    return {
      theme: STYLE_THEMES.has(src.theme) ? src.theme : STYLE_DEFAULTS.theme,
      item_cap: src.item_cap == null || src.item_cap === '' ? STYLE_DEFAULTS.item_cap : clampItemCap(src.item_cap),
      link_route: STYLE_ROUTES.has(src.link_route) ? src.link_route : STYLE_DEFAULTS.link_route,
      type_step: src.type_step == null || src.type_step === '' ? STYLE_DEFAULTS.type_step : clampTypeStep(src.type_step),
    };
  }
  function writeStyleLine(raw) {
    const authored = authoredStyle(raw);
    if (!Object.keys(authored).length) return '';
    return 'style ' + encodeStylePayload(authored);
  }
  function parseStyleLine(line, board) {
    const token = String(line || '').replace(/^style\s+/i, '').trim();
    board.style = decodeStylePayload(token);
  }
  function applyDocumentStyle(board, doc) {
    const next = resolveStyle(board);
    setLinkRouteStyle(next.link_route);
    const rootDoc = doc || (typeof document !== 'undefined' ? document : null);
    if (rootDoc && rootDoc.documentElement) {
      rootDoc.documentElement.style.setProperty('--board-item-cap', next.item_cap + 'rem');
      rootDoc.documentElement.dataset.diagramTheme = next.theme;
      rootDoc.documentElement.dataset.boardTypeStep = String(next.type_step);
    }
    return next;
  }
  function updateStyle(source, patch) {
    const board = parse(source);
    const next = Object.assign({}, board.style || {});
    Object.keys(patch || {}).forEach((key) => {
      if (patch[key] == null) delete next[key];
      else next[key] = patch[key];
    });
    board.style = next;
    return serialize(board);
  }
  function isItemNode(node) {
    return !!(node && (node.role === 'item' || node.kind === 'item'));
  }
  function ensureKids(box) {
    if (!box) return [];
    if (!Array.isArray(box.kids)) box.kids = (box.items || []).concat(box.boxes || []);
    return box.kids;
  }
  function syncKids(box) {
    const kids = ensureKids(box);
    box.items = kids.filter(isItemNode);
    box.boxes = kids.filter((node) => !isItemNode(node));
    return kids;
  }
  function appendKid(box, node) {
    ensureKids(box).push(node);
    syncKids(box);
  }
  function removeKid(box, node) {
    const kids = ensureKids(box);
    const index = kids.indexOf(node);
    if (index >= 0) kids.splice(index, 1);
    syncKids(box);
  }
  function normalizeItemType(raw, lineNo) {
    const key = String(raw || 'chip').toLowerCase();
    if (ITEM_TYPES.has(key)) return key;
    fail(`unknown item type '${raw}'`, lineNo);
  }
  function normalizeLinkType(raw, lineNo) {
    const key = String(raw == null || raw === '' ? 'solid' : raw).toLowerCase();
    if (LINK_TYPES.has(key)) return key;
    fail(`unknown link type '${raw}'`, lineNo);
  }
  function shapeType(box) { return normalizeBoxType((box && (box.type || box.kind)) || 'card'); }

  class BoardParseError extends Error {
    constructor(message, lineNo) {
      super(`Board beta${lineNo ? ` line ${lineNo}` : ''}: ${message}`);
      this.name = 'BoardParseError';
      this.line = lineNo || 0;
    }
  }

  function unquote(value) {
    const text = String(value || '').trim();
    if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
      try { return JSON.parse(text); } catch (_) { return text.slice(1, -1); }
    }
    return text;
  }
  function linkTitle(link) {
    return String((link && (link.title != null ? link.title : link.label)) || '').trim();
  }
  function linkType(link) {
    const key = String((link && link.type) || 'solid').toLowerCase();
    return key === 'dashed' ? 'dashed' : 'solid';
  }
  function linkArrow(link) {
    const key = String((link && link.arrow) || 'forward').toLowerCase();
    return key === 'both' ? 'both' : 'forward';
  }
  function normalizeLinkArrow(raw, lineNo) {
    const key = String(raw == null || raw === '' ? 'forward' : raw).toLowerCase();
    if (key === 'forward' || key === '->') return 'forward';
    if (key === 'both' || key === '<->') return 'both';
    fail(`unknown link arrow '${raw}'`, lineNo);
  }
  function parseLink(line, lineNo) {
    // Board beta: no `link` keyword — write `DEEP -> OUTCOME` or `A <-> B`.
    if (/^link\b/.test(line)) fail('`link` keyword removed; write `<from> -> <to>` or `<from> <-> <to>`', lineNo);
    const match = /^([^\s]+)\s*(<->|->)\s+([^\s:]+)(.*)$/.exec(line);
    if (!match) fail('expected `<from> -> <to>` or `<from> <-> <to> [type solid|dashed] [title "..."]`', lineNo);
    const from = id(match[1], lineNo, 'link endpoint');
    const arrow = match[2] === '<->' ? 'both' : 'forward';
    const to = id(match[3], lineNo, 'link endpoint');
    let rest = String(match[4] || '').trim();
    let title = '';
    let type = 'solid';
    if (rest.charAt(0) === ':') {
      title = unquote(rest.slice(1).trim());
      return { from, to, title, type, arrow, line: lineNo };
    }
    const tokens = splitTokens(rest);
    for (let i = 0; i < tokens.length;) {
      const key = String(tokens[i] || '').toLowerCase();
      if (key === 'type') {
        type = normalizeLinkType(tokens[i + 1], lineNo);
        i += 2;
      } else if (key === 'title') {
        if (!tokens[i + 1]) fail('link title is required', lineNo);
        title = unquote(tokens[i + 1]);
        i += 2;
      } else {
        fail(`unknown link property '${tokens[i]}'`, lineNo);
      }
    }
    return { from, to, title, type, arrow, line: lineNo };
  }

  function fail(message, lineNo) { throw new BoardParseError(message, lineNo); }
  function requireKnownIcon(n, lineNo) {
    if (!Icons || typeof Icons.glyph !== 'function') fail('icon catalog missing', lineNo);
    if (!Icons.glyph(n)) fail('unknown icon ' + n, lineNo);
  }
  function number(value, label, lineNo) {
    const n = Number(value);
    if (!Number.isFinite(n)) fail(`${label} must be a number`, lineNo);
    return n;
  }
  function id(value, lineNo, label = 'id') {
    if (!IDENT.test(value || '')) fail(`invalid ${label} '${value || ''}'`, lineNo);
    return value;
  }
  function splitTokens(text) {
    const out = [];
    const re = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s]+/g;
    let match;
    while ((match = re.exec(text))) out.push(match[0]);
    return out;
  }
  function parseTitle(raw, lineNo) {
    const text = String(raw || '').trim();
    if (!text) fail('board title is required', lineNo);
    return unquote(text);
  }
  function parseIconNumber(token, lineNo) {
    const raw = unquote(token);
    if (!/^\d+$/.test(raw)) fail('icon n must be an integer', lineNo);
    const icon = Number(raw);
    requireKnownIcon(icon, lineNo);
    return icon;
  }
  function parseBox(line, lineNo) {
    const raw = line.replace(/^box\s+/, '').trim();
    const form = 'expected `box <id> [type <type>] [<n>] ["<title>"]`';
    if (!raw) fail(form, lineNo);
    const tokens = splitTokens(raw);
    const first = tokens[0];
    if (!first || /^["']/.test(first) || /^(title|type|kind)$/i.test(first)) fail(form, lineNo);
    const boxId = id(first, lineNo, 'box id');
    let i = 1;
    let typeRaw = 'card';
    let title = '';
    let icon = null;
    if (i < tokens.length && /^type$/i.test(tokens[i])) {
      if (!tokens[i + 1]) fail('box type is required', lineNo);
      typeRaw = tokens[i + 1];
      i += 2;
    }
    if (i < tokens.length && !/^["']/.test(tokens[i]) && /^\d+$/.test(unquote(tokens[i]))) {
      icon = parseIconNumber(tokens[i], lineNo);
      i += 1;
    }
    if (i < tokens.length && /^["']/.test(tokens[i])) {
      title = unquote(tokens[i]);
      i += 1;
    }
    if (i < tokens.length) fail(`unexpected box token '${tokens[i]}'`, lineNo);
    const boxType = normalizeBoxType(typeRaw, lineNo);
    return { type: boxType, kind: boxType, id: boxId, title: title, icon: icon, boxes: [], items: [], kids: [], parent: null };
  }
  function looksLikeItemId(token, next) {
    if (!token || /^["']/.test(token)) return false;
    if (/^(type|kind|shape|cap)$/i.test(token)) return false;
    if (!IDENT.test(token)) return false;
    if (next == null) return false;
    return /^(type|shape|cap)$/i.test(next) || /^["']/.test(next);
  }
  function parseIconItem(tokens, itemId, raw, lineNo) {
    if (!tokens.length) fail('icon n is required', lineNo);
    const icon = parseIconNumber(tokens[0], lineNo);
    let text = '';
    let index = 1;
    if (index < tokens.length) {
      if (!/^["']/.test(tokens[index])) fail('icon caption must be quoted', lineNo);
      text = unquote(tokens[index]);
      index += 1;
    }
    if (index < tokens.length) fail(`unexpected icon token '${tokens[index]}'`, lineNo);
    return { kind: 'item', type: 'icon', id: itemId, icon, text, raw, parent: null, line: lineNo };
  }
  function parseItem(line, lineNo) {
    const raw = line.replace(/^item\s+/i, '').trim();
    if (!raw) fail('item text is required', lineNo);
    const tokens = splitTokens(raw);
    if (tokens.indexOf('!') >= 0) fail("unexpected item token '!'", lineNo);
    let i = 0;
    let itemId = null;
    let itemType = 'chip';
    if (looksLikeItemId(tokens[i], tokens[i + 1])) {
      itemId = id(tokens[i], lineNo, 'item id');
      i += 1;
    }
    if (i < tokens.length && /^kind$/i.test(tokens[i])) fail('use `type`, not `kind`', lineNo);
    if (i < tokens.length && /^type$/i.test(tokens[i])) {
      if (!tokens[i + 1]) fail('item type is required', lineNo);
      itemType = normalizeItemType(tokens[i + 1], lineNo);
      i += 2;
    }
    let shape = 'rect';
    let cap = 'on';
    while (i < tokens.length) {
      if (/^shape$/i.test(tokens[i])) {
        if (!tokens[i + 1]) fail('chip shape is required', lineNo);
        shape = normalizeChipShape(tokens[i + 1], lineNo);
        i += 2;
        continue;
      }
      if (/^cap$/i.test(tokens[i])) {
        if (!tokens[i + 1]) fail('cap is required', lineNo);
        cap = normalizeItemCap(tokens[i + 1], lineNo);
        i += 2;
        continue;
      }
      break;
    }
    if (shape !== 'rect' && itemType !== 'chip') fail('shape is only valid on chip', lineNo);
    if (cap === 'off' && itemType === 'icon') fail('cap is only valid on chip, text, or note', lineNo);
    const rest = tokens.slice(i);
    if (itemType === 'icon') return parseIconItem(rest, itemId, raw, lineNo);
    if (!rest.length) fail('item text is required', lineNo);
    if (rest.length > 1) fail(`unexpected item token '${rest[1]}'`, lineNo);
    const item = { kind: 'item', type: itemType, id: itemId, text: unquote(rest[0]), raw, parent: null, line: lineNo };
    if (itemType === 'chip' && shape !== 'rect') item.shape = shape;
    if (cap === 'off') item.cap = 'off';
    return item;
  }
  function parseLayoutProps(tokens, lineNo, start = 0) {
    const props = {};
    for (let i = start; i < tokens.length;) {
      const key = tokens[i].toLowerCase();
      if (key === 'direction' || key === 'dir') {
        const value = (tokens[i + 1] || '').toLowerCase();
        if (!DIRECTIONS.has(value)) fail('direction must be row or column', lineNo);
        props.direction = value; i += 2;
      } else if (key === 'gap' || key === 'padding') {
        // Removed from the authoring protocol. Skip so old files still parse.
        if (tokens[i + 1]) i += 2;
        else i += 1;
      } else if (key === 'align') {
        const value = (tokens[i + 1] || '').toLowerCase();
        if (!ALIGN.has(value)) fail('align must be start, center, or stretch', lineNo);
        props.align = value; i += 2;
      } else if (key === 'justify') {
        const value = (tokens[i + 1] || '').toLowerCase();
        if (!JUSTIFY.has(value)) fail('justify must be start, center, or stretch', lineNo);
        props.justify = value; i += 2;
      } else {
        fail(`unknown layout property '${tokens[i]}'`, lineNo);
      }
    }
    return props;
  }
  function merge(target, source) { Object.keys(source || {}).forEach((key) => { target[key] = source[key]; }); return target; }
  function stripComma(value) { return String(value || '').replace(/,$/, ''); }

  function parse(text) {
    const source = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    const lines = source.split('\n');    const board = { kind: 'board', title: '', views: [], boxes: [], links: [], layout: { board: {}, boxes: {}, places: [], aligns: [], constraints: [], barriers: [] } };
    const byId = new Map();
    let sawBoard = false;
    let inLayout = false;
    let currentBox = null;
    let currentIndent = -1;
    const itemRecords = [];

    lines.forEach((raw, index) => {
      const lineNo = index + 1;
      if (!raw.trim() || /^\s*(#|\/\/)/.test(raw)) return;
      const indent = (raw.match(/^\s*/) || [''])[0].replace(/\t/g, '  ').length;
      const line = raw.trim();
      if (!sawBoard) {
        if (!/^board\s+/i.test(line)) fail('first statement must be `board <title>`', lineNo);
        board.title = parseTitle(line.replace(/^board\s+/i, ''), lineNo);
        sawBoard = true;
        return;
      }
      if (/^style(?:\s+|$)/i.test(line)) {
        inLayout = false;
        currentBox = null;
        parseStyleLine(line, board);
        return;
      }
      if (/^layout\s*$/i.test(line)) { inLayout = true; currentBox = null; return; }
      if (/^board\s+/i.test(line)) fail('only one board statement is allowed', lineNo);
      if (inLayout) {
        // `A -> B` ends the layout block (board beta has no `link` keyword).
        if (indent === 0 && (/^(box|item)\b/.test(line) || /^\S+\s*(<->|->)\s+\S+/.test(line))) inLayout = false;
        else {
          parseLayoutLine(line, lineNo, board);
          return;
        }
      }
      if (/^box\s+/.test(line)) {
        const box = parseBox(line, lineNo);
        if (byId.has(box.id)) fail(`duplicate id '${box.id}'`, lineNo);
        byId.set(box.id, box);
        while (currentBox && indent <= currentIndent) { currentBox = currentBox.parent; currentIndent = currentBox ? currentBox._indent : -1; }
        if (currentBox) { box.parent = currentBox; appendKid(currentBox, box); }
        else board.views.push(View ? View.mark(box, 'box') : box);
        box._indent = indent; currentBox = box; currentIndent = indent;
        return;
      }
      if (/^item\s+/.test(line)) {
        while (currentBox && indent <= currentIndent) { currentBox = currentBox.parent; currentIndent = currentBox ? currentBox._indent : -1; }
        const item = parseItem(line, lineNo);
        if (View) View.mark(item, 'item');
        if (!currentBox) {
          item.parent = null;
          item._indent = indent;
          board.views.push(item);
          itemRecords.push(item);
          return;
        }
        item.parent = currentBox; appendKid(currentBox, item); itemRecords.push(item);
        return;
      }
      if (/^link\b/i.test(line)) fail('`link` keyword removed; write `<from> -> <to>` or `<from> <-> <to>`', lineNo);
      if (/^(?!box\b|item\b|layout\b)\S+\s*(<->|->)\s+\S+/.test(line)) {
        board.links.push(parseLink(line, lineNo));
        return;
      }
      fail(`unknown statement '${line.split(/\s+/, 1)[0]}'`, lineNo);
    });

    if (!sawBoard) fail('missing `board <title>`');
    // Multi-word item text is the default. Promote the first token to an id when
    // a link names it, or when the remainder is an explicit quoted label.
    const linkIds = new Set(board.links.flatMap((link) => [link.from, link.to]));
    itemRecords.forEach((item) => {
      if (item.id) {
        if (byId.has(item.id)) fail(`duplicate id '${item.id}'`, item.line);
        byId.set(item.id, item);
        return;
      }
      if (item.type === 'icon') return;
      const tokens = splitTokens(item.raw);
      const quotedId = tokens.length > 1 && IDENT.test(tokens[0]) && /^["']/.test(tokens[1] || "");
      if (tokens.length > 1 && IDENT.test(tokens[0]) && (linkIds.has(tokens[0]) || quotedId)) {
        item.id = tokens[0]; item.text = unquote(tokens.slice(1).join(' '));
        if (byId.has(item.id)) fail(`duplicate id '${item.id}'`, item.line);
        byId.set(item.id, item);
      }
    });
    if (View) View.adopt(board);
    else board.boxes = (board.views || []).filter((node) => node && node.kind !== 'item' && node.role !== 'item');
    (board.views || []).forEach((node) => {
      if (!View || !View.isItem(node) || node.id) return;
      let index = 1;
      while (byId.has(`ITEM${index}`)) index += 1;
      node.id = `ITEM${index}`;
      byId.set(node.id, node);
    });
    hoistDiamondBoxes(board, byId);
    (board.boxes || []).forEach((box) => validateTree(box, byId));
    board.links.forEach((link) => { if (!byId.has(link.from)) fail(`unknown link endpoint '${link.from}'`, link.line); if (!byId.has(link.to)) fail(`unknown link endpoint '${link.to}'`, link.line); });
    board.layout.places.forEach((place) => { if (!byId.has(place.source)) fail("unknown place id " + place.source, place.line); place.targets.forEach((target) => { if (!byId.has(target)) fail("unknown place target " + target, place.line); }); });
    board.layout.constraints.forEach((constraint) => { if (!byId.has(constraint.source)) fail("unknown constraint source " + constraint.source, constraint.line); if (constraint.target !== "parent" && !byId.has(constraint.target)) fail("unknown constraint target " + constraint.target, constraint.line); });
    Object.keys(board.layout.boxes).forEach((boxId) => { if (!byId.has(boxId)) fail("unknown layout box " + boxId); });
    board._ids = byId;
    cleanTree(board);
    return board;
  }

  function commaIds(tokens, lineNo, label) {
    return tokens.join(' ').split(',').map((value) => value.trim()).filter(Boolean).map((value) => id(value, lineNo, label));
  }
  function pushPin(board, line, lineNo) {
    const consMatch = /^([^\s.]+)\.(start|end|top|bottom)\s+to\s+([^\s.]+)(?:\.(start|end|top|bottom))?(?:\s+(?:gap\s+)?([^\s]+))?$/i.exec(line);
    if (!consMatch) return false;
    board.layout.constraints.push({
      source: id(consMatch[1], lineNo, 'constraint source'),
      sourceEdge: consMatch[2].toLowerCase(),
      target: id(consMatch[3], lineNo, 'constraint target'),
      targetEdge: (consMatch[4] || 'bottom').toLowerCase(),
      gap: consMatch[5] ? number(consMatch[5], 'constraint gap', lineNo) : 0,
      line: lineNo,
    });
    return true;
  }
  function pushArrange(board, sourceTok, relationTok, targetToks, lineNo) {
    const source = id(sourceTok, lineNo, 'arrange id');
    const relation = String(relationTok || '').toLowerCase();
    if (!RELATIONS.has(relation)) fail('arrange relation must be after, before, left-of, right-of, above, or below', lineNo);
    const targets = commaIds(targetToks, lineNo, 'arrange target');
    if (!targets.length) fail('arrange needs at least one target', lineNo);
    board.layout.places.push({ source, relation, targets, line: lineNo });
  }
  function mergeBoxProp(board, boxId, props) {
    merge(board.layout.boxes[boxId] || (board.layout.boxes[boxId] = {}), props);
  }
  function parseLayoutLine(line, lineNo, board) {
    let tokens = splitTokens(line);
    if (!tokens.length) return;
    const first = tokens[0].toLowerCase();
    if (first === 'barrier') fail('barrier is not valid; arrange nodes with after/below or a pin', lineNo);
    if (first === 'pin' || first === 'cons' || first === 'constrain') {
      if (!pushPin(board, tokens.slice(1).join(' '), lineNo)) fail('pin needs `<id>.<edge> to <id|parent>.<edge> [N]`', lineNo);
      return;
    }
    if (pushPin(board, line, lineNo)) return;
    if (first === 'arrange' || first === 'place') {
      if (tokens.length < 4) fail('arrange needs an id, a relation, and a target', lineNo);
      pushArrange(board, tokens[1], tokens[2], tokens.slice(3), lineNo);
      return;
    }
    if (tokens.length >= 3 && RELATIONS.has(String(tokens[1] || '').toLowerCase())) {
      pushArrange(board, tokens[0], tokens[1], tokens.slice(2), lineNo);
      return;
    }
    if (first === 'flush') {
      if (tokens.length < 2) fail('flush needs a value', lineNo);
      const rawEdge = tokens[tokens.length - 1].toLowerCase();
      // `left` / `right` are legacy spellings; the protocol edge vocabulary is start / end / top / bottom.
      const edge = rawEdge === 'left' ? 'start' : rawEdge === 'right' ? 'end' : rawEdge;
      const ids = commaIds(tokens.slice(1, -1), lineNo, 'flush id');
      if (!['start', 'end', 'top', 'bottom'].includes(edge)) fail('flush edge must be start, end, top, or bottom', lineNo);
      if (!ids.length) fail('flush needs ids and an edge', lineNo);
      board.layout.aligns.push({ ids, edge, line: lineNo });
      return;
    }
    if (first === 'align') {
      if (tokens.length < 2) fail('align needs a value', lineNo);
      const edge = tokens[tokens.length - 1].toLowerCase();
      const ids = commaIds(tokens.slice(1, -1), lineNo, 'align id');
      if (!ALIGN.has(edge)) fail('align value must be start, center, or stretch', lineNo);
      if (!ids.length) {
        merge(board.layout.board, { align: edge });
        return;
      }
      ids.forEach((boxId) => mergeBoxProp(board, boxId, { align: edge }));
      return;
    }
    if (first === 'justify') {
      if (tokens.length < 2) fail('justify needs a value', lineNo);
      const value = tokens[tokens.length - 1].toLowerCase();
      if (!JUSTIFY.has(value)) fail('justify must be start, center, or stretch', lineNo);
      const ids = commaIds(tokens.slice(1, -1), lineNo, 'justify id');
      if (!ids.length) {
        merge(board.layout.board, { justify: value });
        return;
      }
      ids.forEach((boxId) => mergeBoxProp(board, boxId, { justify: value }));
      return;
    }
    if (first === 'direction' || first === 'dir') {
      const hasGapPad = tokens.some((tok, i) => i > 0 && /^(gap|padding)$/i.test(tok));
      const value = tokens[tokens.length - 1].toLowerCase();
      if (DIRECTIONS.has(value) && !hasGapPad) {
        const ids = commaIds(tokens.slice(1, -1), lineNo, 'direction id');
        if (!ids.length) {
          merge(board.layout.board, { direction: value });
          return;
        }
        ids.forEach((boxId) => mergeBoxProp(board, boxId, { direction: value }));
        return;
      }
      merge(board.layout.board, parseLayoutProps(tokens, lineNo, 0));
      return;
    }
    let subject = 'board';
    let start = 0;
    if (first !== 'gap' && first !== 'padding' && first !== 'justify') {
      subject = id(tokens[0], lineNo, 'layout subject');
      start = 1;
    }
    const props = parseLayoutProps(tokens, lineNo, start);
    if (subject === 'board') merge(board.layout.board, props);
    else mergeBoxProp(board, subject, props);
  }

  function diamondBoxToChip(box) {
    const chip = {
      kind: 'item',
      type: 'chip',
      shape: 'diamond',
      id: box.id,
      text: String(box.title == null ? '' : box.title),
      parent: null,
    };
    if (View) View.mark(chip, 'item');
    return chip;
  }
  function hoistDiamondBoxes(board, byId) {
    const layoutBoxes = (board.layout && board.layout.boxes) || {};
    const lift = (box) => {
      (box.boxes || []).slice().forEach(lift);
      const kids = ensureKids(box);
      const next = [];
      kids.forEach((kid) => {
        if (!isItemNode(kid) && String(kid.type || kid.kind) === 'diamond') {
          const chip = diamondBoxToChip(kid);
          if (byId) byId.set(chip.id, chip);
          next.push(chip);
          ensureKids(kid).forEach((inner) => next.push(inner));
          delete layoutBoxes[kid.id];
        } else {
          next.push(kid);
        }
      });
      box.kids = next;
      syncKids(box);
    };
    const views = board.views || [];
    const nextViews = [];
    views.forEach((node) => {
      if (isItemNode(node)) {
        nextViews.push(node);
        return;
      }
      lift(node);
      if (String(node.type || node.kind) === 'diamond') {
        const chip = diamondBoxToChip(node);
        if (byId) byId.set(chip.id, chip);
        nextViews.push(chip);
        ensureKids(node).forEach((inner) => nextViews.push(inner));
        delete layoutBoxes[node.id];
      } else {
        nextViews.push(node);
      }
    });
    board.views = nextViews;
    if (View) View.adopt(board);
    else board.boxes = nextViews.filter((node) => !isItemNode(node));
    Object.keys(layoutBoxes).forEach((id) => {
      const hit = byId && byId.get(id);
      if (hit && isItemNode(hit)) delete layoutBoxes[id];
    });
  }
  function validateTree(box, byId) {
    if (!byId.has(box.id)) byId.set(box.id, box);
    box.boxes.forEach((child) => { if (byId.has(child.id) && byId.get(child.id) !== child) fail(`duplicate id '${child.id}'`, child._indent); validateTree(child, byId); });
  }
  function cleanTree(board) {
    const visit = (node) => { delete node._indent; delete node.parent; if (node.boxes) node.boxes.forEach(visit); if (node.items) node.items.forEach((item) => { delete item.parent; delete item.raw; delete item.line; }); };
    (board.views || board.boxes || []).forEach((node) => {
      if (node && (node.role === 'item' || node.kind === 'item')) { delete node._indent; delete node.parent; delete node.raw; delete node.line; return; }
      visit(node);
    }); delete board._ids;
  }

  function writeLayoutLines(lines, layout) {
    const boxes = layout.boxes || {};
    const dirGroups = { row: [], column: [] };
    const boxAligns = { start: [], center: [], stretch: [] };
    const boxJustifies = { start: [], center: [], stretch: [] };
    Object.keys(boxes).forEach((boxId) => {
      const props = boxes[boxId] || {};
      if (props.direction === 'row' || props.direction === 'column') dirGroups[props.direction].push(boxId);
      if (props.align && boxAligns[props.align]) boxAligns[props.align].push(boxId);
      if (props.justify && boxJustifies[props.justify]) boxJustifies[props.justify].push(boxId);
    });
    const hasBoard = Object.keys(layout.board || {}).some((key) => {
      if (key === 'gap' || key === 'padding') return false;
      if (key === 'justify' && layout.board.justify === 'start') return false;
      return true;
    });
    const hasBoxes = dirGroups.row.length || dirGroups.column.length
      || boxAligns.start.length || boxAligns.center.length || boxAligns.stretch.length
      || boxJustifies.start.length || boxJustifies.center.length || boxJustifies.stretch.length;
    const hasRest = (layout.places || []).length || (layout.aligns || []).length || (layout.constraints || []).length;
    if (!hasBoard && !hasBoxes && !hasRest) return;
    lines.push('layout');
    const boardDir = layout.board && layout.board.direction;
    if (boardDir) lines.push('  direction ' + boardDir);
    const boardAlign = layout.board && layout.board.align;
    if (boardAlign) lines.push('  align ' + boardAlign);
    if (dirGroups.row.length) lines.push('  direction ' + dirGroups.row.join(', ') + ' row');
    if (dirGroups.column.length) lines.push('  direction ' + dirGroups.column.join(', ') + ' column');
    ['start', 'center', 'stretch'].forEach((edge) => {
      if (boxAligns[edge].length) lines.push('  align ' + boxAligns[edge].join(', ') + ' ' + edge);
    });
    ['start', 'center', 'stretch'].forEach((edge) => {
      if (boxJustifies[edge].length) lines.push('  justify ' + boxJustifies[edge].join(', ') + ' ' + edge);
    });
    const boardJustify = layout.board && layout.board.justify;
    if (boardJustify && boardJustify !== 'start') lines.push('  justify ' + boardJustify);
    (layout.places || []).forEach((place) => {
      lines.push('  arrange ' + place.source + ' ' + place.relation + ' ' + place.targets.join(', '));
    });
    (layout.aligns || []).forEach((align) => {
      lines.push('  flush ' + align.ids.join(', ') + ' ' + align.edge);
    });
    (layout.constraints || []).forEach((constraint) => {
      const gap = Number(constraint.gap) ? ' ' + constraint.gap : '';
      lines.push('  pin ' + constraint.source + '.' + constraint.sourceEdge + ' to ' + constraint.target + '.' + constraint.targetEdge + gap);
    });
  }
  function quote(value) { return JSON.stringify(String(value == null ? "" : value)); }
  function serialize(board) { var lines = ["board " + quote(board.title)]; var styleLine = writeStyleLine(board.style); if (styleLine) lines.push(styleLine); var writeItem = function(item, indent) { var it = (item.type || "chip"); var prefix = " ".repeat(indent) + "item" + (item.id ? (" " + item.id) : "") + (it !== "chip" ? (" type " + it) : "") + (it === "chip" && item.shape === "diamond" ? " shape diamond" : "") + (item.cap === "off" && it !== "icon" ? " cap off" : ""); if (it === "icon") { var icon = Number(item.icon); if (!Number.isInteger(icon)) fail("icon n must be an integer"); requireKnownIcon(icon); var iconLine = prefix + " " + String(icon).padStart(3, "0"); if (item.text) iconLine += " " + quote(item.text); lines.push(iconLine); return; } lines.push(prefix + " " + quote(item.text)); }; var writeBox = function(box, indent) { var prefix = " ".repeat(indent); var bt = shapeType(box); var isLayout = bt === "layout"; var boxTitle = isLayout ? "" : String(box.title == null ? "" : box.title); var boxIcon = Number(box.icon); var iconBit = ""; if (!isLayout && box.icon != null && box.icon !== "" && Number.isInteger(boxIcon)) { requireKnownIcon(boxIcon); iconBit = " " + String(boxIcon).padStart(3, "0"); } lines.push(prefix + "box " + box.id + (bt !== "card" && bt !== "diamond" ? (" type " + bt) : "") + iconBit + (boxTitle ? (" " + quote(boxTitle)) : "")); var kids = Array.isArray(box.kids) ? box.kids : (box.items || []).concat(box.boxes || []); kids.forEach(function(kid) { if (kid && (kid.role === "item" || kid.kind === "item")) writeItem(kid, indent + 2); else writeBox(kid, indent + 2); }); }; var roots = (board.views && board.views.length) ? board.views : (board.boxes || []); roots.forEach(function(node) { if (node && (node.role === "item" || node.kind === "item")) writeItem(node, 0); else writeBox(node, 0); }); (board.links || []).forEach(function(link) { var title = linkTitle(link); var lt = linkType(link); var op = linkArrow(link) === "both" ? " <-> " : " -> "; lines.push(link.from + op + link.to + (lt === "dashed" ? " type dashed" : "") + (title ? " title " + quote(title) : "")); }); writeLayoutLines(lines, board.layout || {}); return lines.join("\n") + "\n"; }
  function findNode(board, selection) {
    if (!selection) return null;
    if (selection.kind === "item" && selection.id && (selection.boxId == null || selection.boxId === "")) {
      const roots = (View && View.topItems(board)) || [];
      const hit = roots.find((item) => item.id === selection.id);
      if (hit) return hit;
    }
    var found = null;
    var visit = function(box) {
      if (selection.kind === "box" && box.id === selection.id) found = box;
      if (selection.kind === "item" && selection.id) {
        (box.items || []).forEach((item) => { if (item.id === selection.id) found = item; });
      }
      if (selection.kind === "item" && !found && selection.boxId && box.id === selection.boxId) {
        found = (box.items || [])[Number(selection.index)] || null;
      }
      (box.boxes || []).forEach(visit);
    };
    ((View && View.topBoxes(board)) || board.boxes || []).forEach(visit);
    return found;
  }
  function findBoxWithParent(board, targetId) {
    var found = null;
    var visit = function(list, parent) { if (found) return; (list || []).forEach(function(box) { if (found) return; if (View && View.isItem(box)) return; if (box.id === targetId) { found = { node: box, parent: parent, list: list }; return; } visit(box.boxes || [], box); }); };
    visit(board.views || board.boxes || [], null); return found;
  }
  function containsBox(box, targetId) { return (box.boxes || []).some(function(child) { return child.id === targetId || containsBox(child, targetId); }); }
  function unchangedEdit(source, selection) { return { source: String(source == null ? "" : source), selection: selection || null }; }
  function boxDirection(board, boxId) {
    var props = ((board.layout && board.layout.boxes) || {})[boxId] || {};
    return props.direction === "row" ? "row" : "column";
  }
  function itemSelectionIn(parent, item) {
    var index = (parent.items || []).indexOf(item);
    return { kind: "item", key: "item:" + parent.id + ":" + index, id: item.id || null, boxId: parent.id, index: index };
  }
  function nodeSelectionIn(parent, node) {
    if (isItemNode(node)) return itemSelectionIn(parent, node);
    return { kind: "box", key: "box:" + node.id, id: node.id };
  }
  function findNestedMove(board, selection) {
    if (!selection) return null;
    if (selection.kind === "box") {
      var found = findBoxWithParent(board, selection.id);
      if (!found || !found.parent) return null;
      return { node: found.node, parent: found.parent };
    }
    if (selection.kind === "item") {
      if (!selection.boxId) return null;
      var parentHit = findBoxWithParent(board, selection.boxId);
      if (!parentHit) return null;
      var item = findNode(board, selection);
      if (!item || (View && !View.isItem(item))) return null;
      return { node: item, parent: parentHit.node };
    }
    return null;
  }
  function reorderInfo(source, selection) {
    var board = parse(source);
    var moving = findNestedMove(board, selection);
    if (!moving) return null;
    var kids = ensureKids(moving.parent);
    return {
      parentId: moving.parent.id,
      index: kids.indexOf(moving.node),
      count: kids.length,
      direction: boxDirection(board, moving.parent.id)
    };
  }
  function reorderFinalIndex(from, insertBefore) {
    var src = Number(from);
    var at = Number(insertBefore);
    if (!Number.isInteger(src) || !Number.isInteger(at)) return src;
    if (at === src || at === src + 1) return src;
    return at > src ? at - 1 : at;
  }
  function reorderNode(source, selection, toIndex) {
    if (!selection) fail("select a Board node before reordering");
    var board = parse(source);
    var moving = findNestedMove(board, selection);
    if (!moving) fail("only a nested Board node can be reordered");
    var kids = ensureKids(moving.parent);
    var from = kids.indexOf(moving.node);
    if (from < 0) fail("selected Board node was not found in its parent");
    var nextSel = nodeSelectionIn(moving.parent, moving.node);
    if (kids.length < 2) return unchangedEdit(source, nextSel);
    var to = Number(toIndex);
    if (!Number.isInteger(to)) fail("reorder index must be an integer");
    to = Math.max(0, Math.min(to, kids.length - 1));
    if (from === to) return unchangedEdit(source, nextSel);
    kids.splice(from, 1);
    kids.splice(to, 0, moving.node);
    syncKids(moving.parent);
    if (View) View.adopt(board);
    return editResult(board, nodeSelectionIn(moving.parent, moving.node));
  }
  function reparentNode(source, selection, targetId) {
    if (!selection) fail("select a Board node before reparenting");
    var board = parse(source), target = targetId == null || targetId === "" ? null : findBoxWithParent(board, targetId);
    if (targetId != null && targetId !== "" && !target) fail("drop target Board box was not found");
    if (selection.kind === "box") {
      var moving = findBoxWithParent(board, selection.id);
      if (!moving) fail("selected Board box was not found");
      if (target && (target.node.id === moving.node.id || containsBox(moving.node, target.node.id))) fail("cannot reparent a box into itself or its descendant");
      if (target && moving.parent === target.node) return unchangedEdit(source, selection);
      if (!target && !moving.parent) return unchangedEdit(source, selection);
      if (moving.parent) removeKid(moving.parent, moving.node);
      else moving.list.splice(moving.list.indexOf(moving.node), 1);
      if (target) appendKid(target.node, moving.node);
      else if (View) View.pushTop(board, moving.node);
      else board.boxes.push(moving.node);
      if (View) View.adopt(board);
      board.layout.constraints = (board.layout.constraints || []).filter(function(constraint) { return constraint.source !== moving.node.id; });
      return editResult(board, selection);
    }
    if (selection.kind === "item") {
      var item = findNode(board, selection);
      if (!item || (View && !View.isItem(item))) fail("selected Board item was not found");
      if (!item.id) item.id = nextItemId(board);
      if (View) View.mark(item, "item");
      if (!target) {
        if (!selection.boxId) return unchangedEdit(source, selection);
        var sourceBox = findBoxWithParent(board, selection.boxId);
        var itemIndex = Number(selection.index);
        if (!sourceBox || !Number.isInteger(itemIndex)) fail("selected Board item parent was not found");
        removeKid(sourceBox.node, item);
        if (View) View.pushTop(board, item); else (board.boxes || (board.boxes = [])).push(item);
        if (View) View.adopt(board);
        var constraints = board.layout.constraints || (board.layout.constraints = []);
        constraints.push({ source: item.id, sourceEdge: "start", target: "parent", targetEdge: "start", gap: 32 });
        constraints.push({ source: item.id, sourceEdge: "top", target: "parent", targetEdge: "top", gap: 32 });
        return editResult(board, { kind: "item", key: "item:" + item.id, id: item.id, boxId: null, index: -1 });
      }
      if (selection.boxId) {
        var fromBox = findBoxWithParent(board, selection.boxId), fromIndex = Number(selection.index);
        if (!fromBox) fail("selected Board item parent was not found");
        if (fromBox.node.id === target.node.id) return unchangedEdit(source, selection);
        removeKid(fromBox.node, item);
      } else if (View) View.removeTop(board, item);
      appendKid(target.node, item);
      board.layout.constraints = (board.layout.constraints || []).filter(function(constraint) { return constraint.source !== item.id; });
      if (View) View.adopt(board);
      var nextIndex = target.node.items.length - 1;
      return editResult(board, { kind: "item", key: "item:" + target.node.id + ":" + nextIndex, boxId: target.node.id, index: nextIndex });
    }
    fail("unsupported Board node selection");
  }
  function updateTitle(source, selection, title) {
    var board = parse(source);
    var next = String(title == null ? "" : title);
    if (selection && selection.kind === "title") {
      next = next.trim();
      if (!next) fail("board title is required");
      board.title = next;
      return serialize(board);
    }
    var node = findNode(board, selection);
    if (!node) fail("selected Board node was not found");
    if (selection.kind === "box" && normalizeBoxType(node.type || node.kind || "card", 0) === "layout") {
      fail("layout boxes do not have a title");
    }
    if (selection.kind === "item") {
      next = next.trim();
      if (node.type === "icon") {
        node.text = next;
      } else {
        if (!next) fail("item text is required");
        node.text = next;
      }
    } else {
      // box title may be empty
      node.title = next.trim();
    }
    return serialize(board);
  }
  function updateIcon(source, selection, nextIcon) {
    var board = parse(source);
    var node = findNode(board, selection);
    if (!node) fail("selected Board node was not found");
    if (selection.kind === "box" && normalizeBoxType(node.type || node.kind || "card", 0) === "layout") {
      fail("layout boxes do not have an icon");
    }
    if (nextIcon == null || nextIcon === "") {
      if (selection.kind !== "box") fail("only a box can clear its icon");
      node.icon = null;
      return serialize(board);
    }
    var icon = Number(nextIcon);
    if (!Number.isInteger(icon)) fail("icon n must be an integer");
    requireKnownIcon(icon);
    if (selection.kind === "box") {
      node.icon = icon;
      return serialize(board);
    }
    if (selection.kind !== "item") fail("select a box or an icon item before editing its icon");
    if (node.type !== "icon") fail("only icon items have an icon number");
    node.icon = icon;
    return serialize(board);
  }
  function updateType(source, selection, nextType) {
    var board = parse(source);
    if (selection && selection.kind === "title") fail("board title type is fixed as title");
    var node = findNode(board, selection);
    if (!node) fail("selected Board node was not found");
    if (selection.kind === "item") {
      node.type = normalizeItemType(nextType, 0);
      if (node.type !== "chip") delete node.shape;
      if (node.type === "icon") delete node.cap;
      if (node.type === "icon") {
        if (!Number.isInteger(Number(node.icon)) || !Icons || !Icons.glyph(node.icon)) {
          node.icon = Icons && Icons.MIN != null ? Icons.MIN : null;
          if (node.icon == null) fail("icon catalog missing");
        }
      } else if (!String(node.text || "").trim()) {
        node.text = node.icon != null ? String(node.icon) : "New Item";
      }
    } else {
      if (String(nextType || '').toLowerCase() === 'diamond') fail('use `item <id> shape diamond`, not `box type diamond`');
      var bt = normalizeBoxType(nextType, 0);
      node.type = bt;
      node.kind = bt;
      if (bt === "layout") {
        node.title = "";
        node.icon = null;
      }
    }
    return serialize(board);
  }
  function updateShape(source, selection, nextShape) {
    var board = parse(source);
    if (!selection || selection.kind !== 'item') fail('shape is only valid on chip');
    var node = findNode(board, selection);
    if (!node || !isItemNode(node)) fail('selected Board item was not found');
    if ((node.type || 'chip') !== 'chip') fail('shape is only valid on chip');
    var shape = normalizeChipShape(nextShape, 0);
    if (shape === 'rect') delete node.shape;
    else node.shape = shape;
    return serialize(board);
  }
  function updateCap(source, selection, nextCap) {
    var board = parse(source);
    if (!selection || selection.kind !== 'item') fail('cap is only valid on chip, text, or note');
    var node = findNode(board, selection);
    if (!node || !isItemNode(node)) fail('selected Board item was not found');
    var itemType = node.type || 'chip';
    if (itemType === 'icon') fail('cap is only valid on chip, text, or note');
    var cap = normalizeItemCap(nextCap, 0);
    if (cap === 'on') delete node.cap;
    else node.cap = 'off';
    return serialize(board);
  }

  function updateDir(source, selection, direction) {
    var board = parse(source);
    var dir = String(direction == null ? "" : direction).trim();
    if (!DIRECTIONS.has(dir)) fail("direction must be row or column");
    if (!selection) fail("selection required");
    if (selection.kind === "item") fail("items do not have direction");
    if (selection.kind === "title") {
      board.layout.board = board.layout.board || {};
      board.layout.board.direction = dir;
      return serialize(board);
    }
    if (selection.kind !== "box") fail("only board title or a box can set direction");
    if (!findNode(board, selection)) fail("selected Board node was not found");
    board.layout.boxes = board.layout.boxes || {};
    var cur = Object.assign({}, board.layout.boxes[selection.id] || {});
    cur.direction = dir;
    board.layout.boxes[selection.id] = cur;
    return serialize(board);
  }
  function updateBoxFlexProp(source, selection, key, value, allowed, error) {
    var board = parse(source);
    var next = String(value == null ? "" : value).trim();
    if (!allowed.has(next)) fail(error);
    if (!selection) fail("selection required");
    if (selection.kind === "item") fail("items do not have " + key);
    if (selection.kind !== "box") fail("only a box can set " + key);
    if (!findNode(board, selection)) fail("selected Board node was not found");
    board.layout.boxes = board.layout.boxes || {};
    var cur = Object.assign({}, board.layout.boxes[selection.id] || {});
    cur[key] = next;
    board.layout.boxes[selection.id] = cur;
    return serialize(board);
  }
  function updateAlign(source, selection, align) {
    return updateBoxFlexProp(source, selection, "align", align, ALIGN, "align must be start, center, or stretch");
  }
  function updateJustify(source, selection, justify) {
    return updateBoxFlexProp(source, selection, "justify", justify, JUSTIFY, "justify must be start, center, or stretch");
  }

  function occupiedIds(board) {
    return allNodeIds(board);
  }

  function rewriteIdRefs(board, from, to) {
    if (!from || !to || from === to) return;
    (board.links || []).forEach((link) => {
      if (link.from === from) link.from = to;
      if (link.to === from) link.to = to;
    });
    const layout = board.layout || {};
    (layout.places || []).forEach((place) => {
      if (place.source === from) place.source = to;
      place.targets = (place.targets || []).map((target) => target === from ? to : target);
    });
    (layout.aligns || []).forEach((align) => {
      align.ids = (align.ids || []).map((idValue) => idValue === from ? to : idValue);
    });
    (layout.constraints || []).forEach((constraint) => {
      if (constraint.source === from) constraint.source = to;
      if (constraint.target === from) constraint.target = to;
    });
    if (layout.boxes && Object.prototype.hasOwnProperty.call(layout.boxes, from)) {
      layout.boxes[to] = layout.boxes[from];
      delete layout.boxes[from];
    }
  }

  function idIsReferenced(board, idValue) {
    if (!idValue) return false;
    if ((board.links || []).some((link) => link.from === idValue || link.to === idValue)) return true;
    const layout = board.layout || {};
    if ((layout.places || []).some((place) => place.source === idValue || (place.targets || []).indexOf(idValue) >= 0)) return true;
    if ((layout.aligns || []).some((align) => (align.ids || []).indexOf(idValue) >= 0)) return true;
    if ((layout.constraints || []).some((constraint) => constraint.source === idValue || constraint.target === idValue)) return true;
    return false;
  }

  function isIdTaken(source, selection, nextId) {
    const next = String(nextId == null ? "" : nextId).replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!next) return false;
    const board = parse(source);
    const node = selection ? findNode(board, selection) : null;
    const prev = node && node.id ? String(node.id) : "";
    if (next === prev) return false;
    const taken = occupiedIds(board);
    if (prev) taken.delete(prev);
    return taken.has(next);
  }

  function updateId(source, selection, nextId) {
    if (!selection || (selection.kind !== "box" && selection.kind !== "item")) fail("only a box or item can set id");
    const board = parse(source);
    const node = findNode(board, selection);
    if (!node) fail("selected Board node was not found");
    const raw = String(nextId == null ? "" : nextId).trim();
    const prev = node.id ? String(node.id) : "";
    if (raw === prev) return serialize(board);
    if (!raw) {
      if (selection.kind === "box") fail("box id is required");
      if (selection.boxId == null || selection.boxId === "") fail("top-level item needs an id");
      if (idIsReferenced(board, prev)) fail("cannot clear id used by link or layout");
      node.id = null;
      return serialize(board);
    }
    if (!/^[A-Za-z]+$/.test(raw)) fail("id must be letters only");
    const next = raw.toUpperCase();
    if (next === prev) {
      node.id = next;
      return serialize(board);
    }
    const taken = occupiedIds(board);
    if (prev) taken.delete(prev);
    if (taken.has(next)) fail("duplicate id '" + next + "'");
    if (prev) rewriteIdRefs(board, prev, next);
    node.id = next;
    return serialize(board);
  }

  function updatePosition(source, selection, x, y) {
    if (!selection || (selection.kind !== "box" && selection.kind !== "item")) fail("only a selected view can be repositioned");
    if (selection.kind === "item" && selection.boxId) fail("only a top-level item can be repositioned");
    var board = parse(source);
    if (!findNode(board, selection)) fail("selected Board node was not found");
    var nextX = number(x, "box x"), nextY = number(y, "box y");
    // Allow negative offsets so users can drag past the layout origin (canvas left/top).
    var constraints = board.layout.constraints || [];
    var replace = function(edge, gap) {
      var replaced = false, next = [];
      constraints.forEach(function(c) {
        if (c.source === selection.id && c.sourceEdge === edge) {
          if (!replaced) { next.push({ source: selection.id, sourceEdge: edge, target: "parent", targetEdge: edge, gap: Math.round(gap * 100) / 100, mode: "exact", line: c.line }); replaced = true; }
        } else next.push(c);
      });
      if (!replaced) next.push({ source: selection.id, sourceEdge: edge, target: "parent", targetEdge: edge, gap: Math.round(gap * 100) / 100, mode: "exact" });
      constraints = next;
    };
    // P1 writes board-relative parent anchors; end/bottom constraints remain for size.
    replace("start", nextX); replace("top", nextY);
    board.layout.constraints = constraints;
    // Free-drag pins to parent; drop place-* where this node is the source so a
    // remount/refresh cannot re-chain it under an old relative rule.
    board.layout.places = (board.layout.places || []).filter(function(place) {
      return place.source !== selection.id;
    });
    return serialize(board);
  }
  function updateLinkTitle(source, selection, title) {
    var board = parse(source);
    if (!selection || selection.kind !== "link") fail("select a Board link before editing its title");
    var index = Number(selection.index);
    if (!Number.isInteger(index) || index < 0 || index >= (board.links || []).length) fail("selected Board link was not found");
    var next = String(title == null ? "" : title).trim().slice(0, 48);
    board.links[index].title = next;
    return serialize(board);
  }
  function updateLinkType(source, selection, nextType) {
    var board = parse(source);
    if (!selection || selection.kind !== "link") fail("select a Board link before editing its type");
    var index = Number(selection.index);
    if (!Number.isInteger(index) || index < 0 || index >= (board.links || []).length) fail("selected Board link was not found");
    board.links[index].type = normalizeLinkType(nextType, 0);
    return serialize(board);
  }
  function updateLinkArrow(source, selection, nextArrow) {
    var board = parse(source);
    if (!selection || selection.kind !== "link") fail("select a Board link before editing its arrow");
    var index = Number(selection.index);
    if (!Number.isInteger(index) || index < 0 || index >= (board.links || []).length) fail("selected Board link was not found");
    board.links[index].arrow = normalizeLinkArrow(nextArrow, 0);
    return serialize(board);
  }
  function reverseLink(source, selection) {
    var board = parse(source);
    if (!selection || selection.kind !== "link") fail("select a Board link before reversing it");
    var index = Number(selection.index);
    if (!Number.isInteger(index) || index < 0 || index >= (board.links || []).length) fail("selected Board link was not found");
    var link = board.links[index];
    var from = link.from;
    link.from = link.to;
    link.to = from;
    return serialize(board);
  }
  function addLink(source, from, to, title, type, arrow) {
    const board = parse(source);
    const fromId = resolveLinkEndpoint(board, from, "link endpoint");
    const toId = resolveLinkEndpoint(board, to, "link endpoint");
    const ids = allNodeIds(board);
    if (!ids.has(fromId)) fail("unknown link endpoint " + fromId);
    if (!ids.has(toId)) fail("unknown link endpoint " + toId);
    if (fromId === toId) fail("a link needs two different endpoints");
    const nextTitle = String(title == null ? "" : title).trim() || "control";
    const nextType = normalizeLinkType(type == null || type === "" ? "solid" : type, 0);
    const nextArrow = normalizeLinkArrow(arrow == null || arrow === "" ? "forward" : arrow, 0);
    board.links = board.links || [];
    board.links.push({ from: fromId, to: toId, title: nextTitle, type: nextType, arrow: nextArrow });
    const index = board.links.length - 1;
    return editResult(board, { kind: "link", key: "link:" + index, index: index });
  }

  function deleteLink(source, selection) {
    if (!selection || selection.kind !== "link") fail("select a Board link before deleting");
    const board = parse(source);
    const index = Number(selection.index);
    if (!Number.isInteger(index) || index < 0 || index >= (board.links || []).length) fail("selected Board link was not found");
    board.links.splice(index, 1);
    return editResult(board, null);
  }
  function nodeIds(node, ids) {
    if (!node) return;
    if (node.id) ids.add(node.id);
    (node.items || []).forEach((item) => { if (item.id) ids.add(item.id); });
    (node.boxes || []).forEach((child) => nodeIds(child, ids));
  }

  function allNodeIds(board) {
    const ids = new Set();
    (board.views || board.boxes || []).forEach((node) => {
      if (node && (node.role === 'item' || node.kind === 'item')) { if (node.id) ids.add(node.id); return; }
      nodeIds(node, ids);
    });
    return ids;
  }

  function nextBoxId(board) {
    const ids = allNodeIds(board);
    let index = 1;
    while (ids.has(`BOX${index}`)) index += 1;
    return `BOX${index}`;
  }

  function nextItemId(board) {
    const ids = allNodeIds(board);
    let index = 1;
    while (ids.has(`ITEM${index}`)) index += 1;
    return `ITEM${index}`;
  }

  function resolveLinkEndpoint(board, ref, label) {
    if (ref && typeof ref === "object") {
      const item = findNode(board, { kind: "item", boxId: String(ref.boxId || ""), index: Number(ref.index) });
      if (!item || item.kind !== "item") fail("unknown link endpoint item");
      if (!item.id) item.id = nextItemId(board);
      return item.id;
    }
    return id(String(ref == null ? "" : ref).trim(), 0, label);
  }

  function editResult(board, selection) {
    return { source: serialize(board), selection: selection || null };
  }

  function addBox(source, selection) {
    const board = parse(source);
    const boxId = nextBoxId(board);
    const node = { type: 'card', kind: 'card', id: boxId, title: 'New Box', icon: null, boxes: [], items: [], kids: [] };
    var parentSel = selection && selection.kind === 'box' ? selection : null;
    if (parentSel) {
      var parent = findNode(board, parentSel);
      if (!parent || parent.kind === 'item') fail('selected Board box was not found');
      appendKid(parent, node);
      // Nested boxes flow inside the parent via dir — no board-level cons.
    } else {
      if (View) View.mark(node, 'box');
      if (View) View.pushTop(board, node); else board.boxes.push(node);
      // Keep the new top-level box in the relational protocol and near the canvas.
      const constraints = board.layout.constraints || (board.layout.constraints = []);
      constraints.push({ source: boxId, sourceEdge: 'start', target: 'parent', targetEdge: 'start', gap: 32 });
      constraints.push({ source: boxId, sourceEdge: 'top', target: 'parent', targetEdge: 'top', gap: 32 });
    }
    return editResult(board, { kind: 'box', key: `box:${boxId}`, id: boxId });
  }

  function addItem(source, selection) {
    const board = parse(source);
    if (selection && selection.kind === 'box') {
      const box = findNode(board, selection);
      if (!box || (View && View.isItem(box))) fail('selected Board box was not found');
      const nested = View ? View.mark({ kind: 'item', type: 'chip', id: null, text: 'New Item' }, 'item') : { kind: 'item', type: 'chip', id: null, text: 'New Item' };
      appendKid(box, nested);
      const index = (box.items || []).length - 1;
      return editResult(board, { kind: 'item', key: `item:${box.id}:${index}`, boxId: box.id, index });
    }
    const itemId = nextItemId(board);
    const item = View ? View.mark({ kind: 'item', type: 'chip', id: itemId, text: 'New Item' }, 'item') : { kind: 'item', type: 'chip', id: itemId, text: 'New Item' };
    if (View) View.pushTop(board, item); else (board.boxes || (board.boxes = [])).push(item);
    const constraints = board.layout.constraints || (board.layout.constraints = []);
    constraints.push({ source: itemId, sourceEdge: 'start', target: 'parent', targetEdge: 'start', gap: 32 });
    constraints.push({ source: itemId, sourceEdge: 'top', target: 'parent', targetEdge: 'top', gap: 32 });
    return editResult(board, { kind: 'item', key: `item:${itemId}`, id: itemId, boxId: null, index: -1 });
  }

  function removeBoxFrom(list, targetId, removed) {
    for (let index = 0; index < list.length; index += 1) {
      const box = list[index];
      if (box.id === targetId) {
        nodeIds(box, removed);
        list.splice(index, 1);
        return true;
      }
      if (removeBoxFrom(box.boxes || [], targetId, removed)) return true;
    }
    return false;
  }

  function deleteNode(source, selection) {
    if (!selection) fail('select a Board node before deleting');
    const board = parse(source);
    const removed = new Set();
    let deleted = false;
    if (selection.kind === 'box') {
      deleted = removeBoxFrom(board.views || board.boxes || [], selection.id, removed);
      if (View) View.adopt(board);
    } else if (selection.kind === 'item' && (selection.boxId == null || selection.boxId === '')) {
      const roots = board.views || [];
      const index = roots.findIndex((node) => View && View.isItem(node) && node.id === selection.id);
      if (index >= 0) {
        if (roots[index].id) removed.add(roots[index].id);
        roots.splice(index, 1);
        if (View) View.adopt(board);
        deleted = true;
      }
    } else if (selection.kind === 'item') {
      const visit = (box) => {
        if (deleted) return;
        if (box.id === selection.boxId) {
          const index = Number(selection.index);
          if (Number.isInteger(index) && index >= 0 && index < (box.items || []).length) {
            const item = box.items[index];
            if (item.id) removed.add(item.id);
            removeKid(box, item);
            deleted = true;
          }
          return;
        }
        (box.boxes || []).forEach(visit);
      };
      (board.boxes || []).forEach(visit);
    }
    if (!deleted) fail('selected Board node was not found');

    board.links = (board.links || []).filter((link) => !removed.has(link.from) && !removed.has(link.to));
    const layout = board.layout || {};
    layout.constraints = (layout.constraints || []).filter((constraint) => !removed.has(constraint.source) && !removed.has(constraint.target));
    layout.places = (layout.places || []).map((place) => ({ ...place, targets: (place.targets || []).filter((target) => !removed.has(target)) })).filter((place) => !removed.has(place.source) && place.targets.length);
    layout.aligns = (layout.aligns || []).map((align) => ({ ...align, ids: (align.ids || []).filter((idValue) => !removed.has(idValue)) })).filter((align) => align.ids.length);
    Object.keys(layout.boxes || {}).forEach((idValue) => { if (removed.has(idValue)) delete layout.boxes[idValue]; });
    return editResult(board, null);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `);
  }
  function findBoxById(nodes, id) {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      const hit = findBoxById(n.boxes, id);
      if (hit) return hit;
    }
    return null;
  }
  function propsFor(board, subject) {
    const base = subject === 'board' ? board.layout.board : board.layout.boxes[subject] || {};
    const box = subject !== 'board' ? findBoxById(board.boxes, subject) : null;
    const kind = box ? shapeType(box) : '';
    const isLayout = kind === 'layout';
    const isContainer = kind === 'container';
    return Object.assign(
      { direction: 'column', gap: 16, padding: 16, align: 'stretch', justify: 'start' },
      subject === 'board' ? { direction: 'row', gap: 32, padding: 24, align: 'stretch', justify: 'start' } : {},
      isLayout ? { padding: 0, gap: 16 } : {},
      isContainer ? { padding: 16, paddingY: 28, paddingX: 30, gap: 16 } : {},
      base
    );
  }
  // Sibling gaps use `board-slot` spacers (CSS flex `gap` is forced to 0).
  // Base gap is only Max(SLOT_MIN, tallestSiblingHeight * SLOT_HEIGHT_RATIO).
  // Whether neighbors are linked does not change the base gap; after routing,
  // growLinkSlotsForArrows may enlarge a slot if the arrow run needs more room.
  const SLOT_MIN = 16;
  const SLOT_HEIGHT_RATIO = 0.1;

  function applyFlex(el, props) {
    el.style.display = 'flex';
    el.style.flexDirection = props.direction;
    el.style.gap = '0px';
    {
      const padY = Number.isFinite(props.paddingY) ? props.paddingY : props.padding;
      const padX = Number.isFinite(props.paddingX) ? props.paddingX : props.padding;
      el.style.padding = `${padY}px ${padX}px`;
    }
    el.style.alignItems = props.align === 'start' ? 'flex-start' : props.align === 'center' ? 'center' : 'stretch';
    // Main-axis stretch is grow (applyMainStretch), not justify-content:stretch.
    el.style.justifyContent = props.justify === 'center' ? 'center' : 'flex-start';
    el.classList.toggle('board-dir-row', props.direction === 'row');
    el.classList.toggle('board-dir-column', props.direction !== 'row');
    el.classList.toggle('board-justify-stretch', props.justify === 'stretch');
    applyMainStretch(el, props);
  }

  function boxContentKids(content) {
    return Array.from((content && content.children) || []).filter((el) => (
      el.classList.contains('board-zone') || el.classList.contains('board-item')
    ));
  }

  function isDiamondKid(el) {
    return !!(el && (el.classList.contains('board-item-diamond') || el.dataset.boardShape === 'diamond' || (View && View.isDiamondEl && View.isDiamondEl(el))));
  }

  function kidCrossNeed(el, row) {
    return (row ? el.offsetHeight : el.offsetWidth) || 0;
  }

  function applyMainStretch(content, props) {
    const stretch = !!(props && props.justify === 'stretch');
    const row = !!(props && props.direction === 'row');
    boxContentKids(content).forEach((el) => {
      if (isDiamondKid(el)) return;
      if (stretch) {
        el.style.flex = '1 0 auto';
        if (row) {
          el.style.width = '';
          el.style.maxWidth = '';
          el.style.minWidth = 'min-content';
        } else {
          el.style.height = '';
          el.style.maxHeight = '';
          el.style.minHeight = 'min-content';
        }
      } else {
        el.style.flex = '0 0 auto';
        if (row) el.style.minWidth = '';
        else el.style.minHeight = '';
      }
    });
  }

  function equalizeBoxKids(content, dir) {
    const kids = boxContentKids(content);
    if (!kids.length) return;
    const row = dir === 'row';
    kids.forEach((el) => {
      el.style.width = '';
      el.style.minWidth = '';
      el.style.maxWidth = '';
      if (!isDiamondKid(el)) {
        el.style.height = '';
        el.style.minHeight = '';
      }
    });
    let max = 0;
    kids.forEach((el) => {
      max = Math.max(max, kidCrossNeed(el, row));
    });
    if (!(max > 0)) return;
    // Integer offset* can sit <1px under max-content. Pinning that integer
    // wraps the last word; complete with +1, do not round.
    const complete = max + 1;
    kids.forEach((el) => {
      el.style.boxSizing = 'border-box';
      if (isDiamondKid(el)) return;
      if (row) {
        el.style.height = complete + 'px';
        el.style.minHeight = complete + 'px';
      } else {
        el.style.width = complete + 'px';
        el.style.minWidth = complete + 'px';
      }
    });
  }

  function equalizeAllBoxKids(root, board) {
    if (!root) return;
    root.querySelectorAll('.box-content').forEach((content) => {
      if (content.style.display === 'none') return;
      const host = content.closest('[data-board-id]');
      const id = host && host.dataset.boardId;
      if (!id) return;
      const props = propsFor(board, id);
      const dir = props.direction === 'row' ? 'row' : 'column';
      equalizeBoxKids(content, dir);
      applyMainStretch(content, props);
    });
  }

  function slotHeightRef(content) {
    const kids = boxContentKids(content);
    let maxH = 0;
    kids.forEach((el) => {
      maxH = Math.max(maxH, el.offsetHeight || el.clientHeight || 0);
    });
    return maxH;
  }

  function slotGapForContent(content) {
    const y = Math.round(slotHeightRef(content) * SLOT_HEIGHT_RATIO);
    return Math.max(SLOT_MIN, y);
  }

  function applySlotSize(slot, size, dir) {
    if (!slot) return;
    const axis = dir === 'row' ? 'row' : 'column';
    slot.style.flex = '0 0 ' + size + 'px';
    if (axis === 'row') {
      slot.style.width = size + 'px';
      slot.style.minWidth = size + 'px';
    } else {
      slot.style.height = size + 'px';
      slot.style.minHeight = size + 'px';
    }
  }

  function slotAxisSize(slot, dir) {
    const raw = dir === 'row' ? parseFloat(slot.style.width) : parseFloat(slot.style.height);
    return Number.isFinite(raw) ? raw : SLOT_MIN;
  }

  function slotHitBetween(board, fromId, toId) {
    if (!fromId || !toId) return null;
    const links = board.links || [];
    for (let index = 0; index < links.length; index += 1) {
      const link = links[index];
      if (link.from === fromId && link.to === toId) return { link, index, forward: true };
      if (link.from === toId && link.to === fromId) return { link, index, forward: false };
    }
    return null;
  }

  function makeBoardSlot(board, dir, fromId, toId, doc) {
    if (!doc) return null;
    const hit = slotHitBetween(board, fromId, toId);
    const slot = doc.createElement('span');
    // `is-link` marks arrow-owned slots for later growth only; base size is Max.
    slot.className = 'board-slot' + (hit ? ' is-link' : '');
    slot.dataset.boardSlot = '1';
    slot.dataset.boardSlotDir = dir === 'row' ? 'row' : 'column';
    if (fromId) slot.dataset.boardSlotFrom = fromId;
    if (toId) slot.dataset.boardSlotTo = toId;
    applySlotSize(slot, SLOT_MIN, dir);
    slot.style.alignSelf = 'stretch';
    if (hit) {
      slot.dataset.boardEdgeKey = 'link:' + hit.index;
      slot.dataset.boardEdgeIndex = String(hit.index);
    }
    return slot;
  }

  /** Set every sibling slot to Max(SLOT_MIN, height*ratio). Does not consider arrows.
   *  Arrow-grown `.is-link` slots keep at least their current size — base Max must
   *  not shrink them back (that desyncs parent box size vs already-painted edges). */
  function applySiblingSlotGaps(root) {
    if (!root) return false;
    let changed = false;
    root.querySelectorAll('.box-content').forEach((content) => {
      if (content.style.display === 'none') return;
      const slots = Array.from(content.children || []).filter((el) => el.classList && el.classList.contains('board-slot'));
      if (!slots.length) return;
      const want = slotGapForContent(content);
      slots.forEach((slot) => {
        const dir = slot.dataset.boardSlotDir === 'row' ? 'row' : 'column';
        const have = slotAxisSize(slot, dir);
        const next = slot.classList.contains('is-link') ? Math.max(want, have) : want;
        if (Math.abs(next - have) <= 0.25) return;
        applySlotSize(slot, next, dir);
        changed = true;
      });
    });
    return changed;
  }

  /** Enlarge link slots only when the routed arrow needs a longer run than the Max gap. */
  function growLinkSlotsForArrows(root, items) {
    if (!root || !Arrow) return false;
    let grown = false;
    root.querySelectorAll('.board-slot.is-link').forEach((slot) => {
      const index = Number(slot.dataset.boardEdgeIndex);
      const item = (items || []).find((entry) => entry.linkIndex === index);
      if (!item || !item.points) return;
      const need = Arrow.slotNeed(item.points, linkArrow(item.link) === 'both');
      const dir = slot.dataset.boardSlotDir === 'row' ? 'row' : 'column';
      const have = slotAxisSize(slot, dir);
      if (!(need > have + 0.25)) return;
      applySlotSize(slot, need, dir);
      grown = true;
    });
    return grown;
  }

  function collectNodes(board) {
    const map = new Map();
    const visit = (box) => { map.set(box.id, box); box.items.forEach((item) => item.id && map.set(item.id, item)); box.boxes.forEach(visit); };
    board.boxes.forEach(visit); return map;
  }
  function orderFor(ids, placements) {
    const rank = new Map(ids.map((value, index) => [value, index]));
    placements.forEach((place) => {
      if (!rank.has(place.source)) return;
      place.targets.forEach((target) => {
        if (!rank.has(target)) return;
        const sourceRank = rank.get(place.source), targetRank = rank.get(target);
        if (place.relation === 'after' || place.relation === 'right-of' || place.relation === 'below') rank.set(place.source, Math.max(sourceRank, targetRank + 1));
        if (place.relation === 'before' || place.relation === 'left-of' || place.relation === 'above') rank.set(place.source, Math.min(sourceRank, Math.max(0, targetRank - 1)));
      });
    });
    return rank;
  }


  function stableUnits(units, places) {
    const unitFor = new Map();
    units.forEach((unit, index) => unit.ids.forEach((idValue) => unitFor.set(idValue, index)));
    const edges = units.map(() => new Set()), indegree = units.map(() => 0);
    const add = (from, to) => { if (from === to || edges[from].has(to)) return; edges[from].add(to); indegree[to] += 1; };
    places.forEach((place) => {
      const source = unitFor.get(place.source); if (source == null) return;
      place.targets.forEach((targetId) => { const target = unitFor.get(targetId); if (target == null || target === source) return;
        if (place.relation === 'after' || place.relation === 'right-of') add(target, source);
        if (place.relation === 'before' || place.relation === 'left-of') add(source, target);
      });
    });
    const ready = units.map((_, index) => index).filter((index) => indegree[index] === 0), ordered = [];
    while (ready.length) { ready.sort((a, b) => a - b); const next = ready.shift(); ordered.push(units[next]); edges[next].forEach((target) => { indegree[target] -= 1; if (!indegree[target]) ready.push(target); }); }
    return ordered.length === units.length ? ordered : units;
  }

  function evidenceParts(text) { const raw = String(text || "").trim(); const dash = raw.split(/\s+—\s+/, 2); if (dash.length > 1) return { title: dash[0], subtitle: dash[1] }; const paren = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(raw); return paren ? { title: paren[1].trim(), subtitle: paren[2].trim() } : { title: raw, subtitle: "" }; }
  function iconKindForBox(box) { const key = (box.kind + " " + box.id + " " + box.title).toLowerCase(); if (box.kind === "diamond" || key.includes("executor interface")) return "diamond"; if (box.kind === "document" || /yaml|definition/.test(key)) return "document"; if (box.kind === "kit") return "shield"; if (box.kind === "env-local" || /local machine|host/.test(key)) return "laptop"; if (box.kind === "env-sbx" || /docker|sbx|container/.test(key)) return "whale"; if (box.kind === "artifact" || /artifact|record/.test(key)) return "artifact"; if (box.kind === "suite" || /suite|compare|track/.test(key)) return "chart"; if (box.kind === "evidence" || /evidence|runtime/.test(key)) return "evidence"; if (box.kind === "kit" || /kit|validator|runner/.test(key)) return "shield"; return "document"; }
  function iconKindForItem(item, parent) { const key = String(item.text || "").toLowerCase(); if (parent && parent.kind === "artifact") return "check"; if (/validator|verify|check/.test(key)) return "shield"; if (/runner|executor|run/.test(key)) return "play"; if (/command|invocation|output|stdout|stderr/.test(key)) return "terminal"; if (/exit code|result/.test(key)) return "check"; if (/duration|wall clock|time/.test(key)) return "clock"; if (/compare|track|group|suite/.test(key)) return "chart"; if (/parameter|metadata|provenance|artifact|record|evidence/.test(key)) return "artifact"; if (parent && parent.kind === "env-local") return "laptop"; if (parent && parent.kind === "env-sbx") return "whale"; return "dot"; }
  function iconElement(doc, kind) {
    const el = doc.createElement("span");
    el.className = "board-icon board-icon-" + kind;
    el.setAttribute("aria-hidden", "true");
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.55");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("shape-rendering", "geometricPrecision");
    svg.setAttribute("vector-effect", "non-scaling-stroke");
    const marks = {
      document: `<path d="M4.5 2.75h7l4 4v10a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-13a1 1 0 0 1 1-1Z"/><path d="M11.5 2.75v4h4M7 10h6M7 13.25h6M7 16.5h3.5"/>`,
      shield: `<path d="m10 2.5 6.25 2.65v4.4c0 3.75-2.15 6.55-6.25 8.1-4.1-1.55-6.25-4.35-6.25-8.1v-4.4L10 2.5Z"/><path d="m6.8 10 2.05 2.05 4.35-4.35"/>`,
      play: `<circle cx="10" cy="10" r="7.25"/><path d="m8.4 6.8 5.1 3.2-5.1 3.2V6.8Z" fill="currentColor" stroke="none"/>`,
      laptop: `<rect x="3.25" y="3.25" width="13.5" height="9.5" rx="1"/><path d="M1.75 16.25h16.5M7.25 16.25l.75-3.5h4l.75 3.5"/>`,
      whale: `<path d="M2.75 12.8c1-2.05 2.65-3.05 4.95-3.05h5.85V7.7h2.5c.75 0 1.25.55 1.25 1.3v.95c1.1.3 2 .9 2.7 1.8-.85 3.15-3.4 4.8-7.7 4.8H7.5c-2.2 0-3.7-1.25-4.75-3.75Z" fill="currentColor" stroke="none"/><path d="M6.2 9.75V7.8M8.4 9.75V6.8M10.6 9.75V7.8M17.5 10.15c.8-.25 1.55-.2 2.25.05" stroke="white" stroke-width="1.15"/><circle cx="16.65" cy="12.55" r=".55" fill="white" stroke="none"/>`,
      artifact: `<path d="M7.35 3.4H5.8A1.8 1.8 0 0 0 4 5.2v1.7c0 1.35-.8 2.15-2.05 2.65C3.2 10.05 4 10.9 4 12.2v2.6a1.8 1.8 0 0 0 1.8 1.8h1.55M12.65 3.4h1.55a1.8 1.8 0 0 1 1.8 1.8v1.7c0 1.35.8 2.15 2.05 2.65-1.25.5-2.05 1.35-2.05 2.65v2.6a1.8 1.8 0 0 1-1.8 1.8h-1.55"/>`,
      chart: `<path d="M3.25 16.75V4.25M3.25 16.75h14.5"/><path d="M6.25 14.75v-3.5h2.2v3.5M10.1 14.75V8.75h2.2v6M13.95 14.75V6h2.2v8.75" fill="currentColor" stroke="none"/>`,
      evidence: `<rect x="3.25" y="3.25" width="13.5" height="13.5" rx="1.35"/><path d="M6.25 7.3h7.5M6.25 10h7.5M6.25 12.7h4.25" stroke-width="1.35"/>`,
      terminal: `<path d="m4.25 6.5 3.5 3.5-3.5 3.5M10.5 13.5h5.25"/>`,
      check: `<circle cx="10" cy="10" r="7.25"/><path d="m6.55 10 2.25 2.25 4.65-4.65"/>`,
      clock: `<circle cx="10" cy="10" r="7.25"/><path d="M10 5.75v4.6l3.05 1.85"/>`,
      dot: `<circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none"/>`,
    };
    svg.innerHTML = marks[kind] || marks.dot;
    el.appendChild(svg);
    return el;
  }

  async function render(text, targetEl) {
    if (!targetEl || !targetEl.ownerDocument) throw new Error('BoardRender.render requires a target element');
    if (!Layout) throw new Error('BoardLayout module is not loaded');
    if (!Route) throw new Error('BoardRoute module is not loaded');
    if (!View || !View.Types) throw new Error('Board type modules are not loaded');
    const board = parse(text), doc = targetEl.ownerDocument;
    const docStyle = applyDocumentStyle(board, doc);
    targetEl.innerHTML = '';
    const root = doc.createElement('section'); root.className = 'board-html board-render board-engine'; root.dataset.boardTitle = board.title; root.style.width = 'max-content'; root.style.minWidth = '0'; root.style.boxSizing = 'border-box';
    const themeId = docStyle.theme;
    if (Themes && typeof Themes.applyTo === 'function') Themes.applyTo(root, themeId);
    const header = doc.createElement('header'); header.className = 'board-html-header board-title-node'; header.dataset.boardKey = 'title:board'; header.dataset.boardKind = 'title'; header.dataset.boardType = 'title'; header.setAttribute('title', 'Board title'); const heading = doc.createElement('h2'); heading.textContent = board.title || ''; header.appendChild(heading); if (board.title) root.appendChild(header);
    const canvas = doc.createElement('div'); canvas.className = 'board-canvas'; canvas.style.position = 'relative'; canvas.style.paddingTop = '0'; canvas.style.boxSizing = 'border-box'; canvas.style.minWidth = '0'; canvas.style.overflow = 'visible'; root.appendChild(canvas);
    const elements = new Map();
    const ctx = {
      doc,
      board,
      root,
      elements,
      nested: false,
      toneSeq: { n: 0 },
      applyFlex,
      propsFor,
      makeBoardSlot: function (dir, fromId, toId) { return makeBoardSlot(board, dir, fromId, toId, doc); },
    };
    (board.views || board.boxes || []).forEach((node) => {
      canvas.appendChild(View.Types.wrap(node).mount(ctx));
    });
    /* legend removed: edge meaning lives in link labels, not chrome */
    const edgeSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); edgeSvg.classList.add('board-edges'); edgeSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:50;shape-rendering:geometricPrecision'); edgeSvg.setAttribute('shape-rendering', 'geometricPrecision'); edgeSvg.setAttribute('aria-hidden', 'true'); canvas.appendChild(edgeSvg); targetEl.appendChild(root);

    // Intrinsic measure -> adaptive solve -> live-CSS remeasure -> crisp repaint.
    // A fixed frame can wrap text differently from the initial max-content probe;
    // inflate the measured box from rendered scroll extents before finalizing
    // topology so padding, borders, line-height, and item gaps participate.
    let result = null;
    let lastSignature = "";
    let lastAvailable = 0;
    const eachBox = (visit) => {
      const walk = (box) => { visit(box); (box.boxes || []).forEach(walk); };
      ((View && View.topBoxes(board)) || board.boxes || []).forEach(walk);
    };
    const eachRootItem = (visit) => {
      ((View && View.topItems(board)) || []).forEach(visit);
    };
    const applyLayout = (next) => {
      result = next;
      root.style.width = `${result.width}px`;
      canvas.style.width = `${result.width}px`;
      canvas.style.height = `${result.height}px`;
      canvas.style.minHeight = `${result.height}px`;
      const applyRootFrames = () => {
        result.frames.forEach((frame, id) => {
          const el = elements.get(id);
          if (!el) return;
          if (el.dataset.boardNested === '1') return; // nested boxes flow inside parent flex
          const inst = el.dataset.boardKind === 'item'
            ? View.Types.item(el.dataset.boardType, { id, kind: 'item' })
            : View.Types.box(el.dataset.boardType, { id });
          inst.applyFrame(el, frame);
        });
      };
      // Equalize first so contentInsetNeed sees the shared column width
      // (nested diamond intrinsic, not the pre-stretch article).
      equalizeAllBoxKids(root, board);
      applyRootFrames();
      equalizeAllBoxKids(root, board);
      eachBox((box) => {
        const el = elements.get(box.id);
        const inst = View.Types.wrap(box);
        if (el && el.dataset.boardNested === '1' && typeof inst.fitNested === 'function') inst.fitNested(el);
      });
      if (View && typeof View.fitChipDiamonds === 'function') View.fitChipDiamonds(root);
    };
    const liveCssMeasure = (measured) => {
      const adjusted = new Map(measured);
      let changed = false;
      eachBox((box) => {
        const el = elements.get(box.id);
        const base = measured.get(box.id) || { w: 160, h: 80 };
        if (!el) return;
        // getBoundingClientRect is viewport-scaled by the drawer preview.
        // Use layout-pixel dimensions so responsive preview transforms never
        // shrink the engine's measured topology.
        const sized = View.Types.wrap(box).measureLive(el, base);
        const w = sized.w;
        const h = sized.h;
        if (sized.exact) {
          if (Math.abs(w - base.w) > 0.25 || Math.abs(h - base.h) > 0.25) changed = true;
        } else if (w > base.w + 0.25 || h > base.h + 0.25) {
          changed = true;
        }
        adjusted.set(box.id, { w, h });
      });
      eachRootItem((item) => {
        const el = elements.get(item.id);
        const base = measured.get(item.id) || { w: 80, h: 30 };
        if (!el) return;
        const w = Math.max(base.w, el.offsetWidth || el.clientWidth || 80);
        const h = Math.max(base.h, el.offsetHeight || el.clientHeight || 30);
        if (w > base.w + 0.25 || h > base.h + 0.25) changed = true;
        adjusted.set(item.id, { w, h });
      });
      return { measured: adjusted, changed };
    };
    const measureNodes = () => {
      const measured = new Map();
      eachBox((box) => {
        const el = elements.get(box.id);
        const rect = el && el.getBoundingClientRect();
        measured.set(box.id, {
          w: (el && (el.offsetWidth || el.clientWidth)) || (rect && rect.width) || 160,
          h: (el && (el.offsetHeight || el.clientHeight)) || (rect && rect.height) || 80,
        });
      });
      eachRootItem((item) => {
        const el = elements.get(item.id);
        const rect = el && el.getBoundingClientRect();
        const minW = View.Types.wrap(item).intrinsicMinWidth();
        measured.set(item.id, {
          w: (el && (el.offsetWidth || el.clientWidth)) || (rect && rect.width) || minW,
          h: (el && (el.offsetHeight || el.clientHeight)) || (rect && rect.height) || 30,
        });
      });
      return measured;
    };
    const settleSiblingGaps = () => {
      // Equalize + Max until stable before/between layout passes.
      let changed = false;
      for (let i = 0; i < 4; i += 1) {
        equalizeAllBoxKids(root, board);
        if (!applySiblingSlotGaps(root)) break;
        changed = true;
      }
      return changed;
    };
    const resolve = () => {
      const available = canvas.clientWidth || root.clientWidth || 1200;
      const remeasureIntrinsic = !result;
      if (remeasureIntrinsic) {
        eachBox((box) => {
          const el = elements.get(box.id);
          if (el) { el.style.left = "auto"; el.style.top = "auto"; el.style.width = "max-content"; el.style.minWidth = `${View.Types.wrap(box).intrinsicMinWidth()}px`; el.style.height = "auto"; }
        });
        eachRootItem((item) => {
          const el = elements.get(item.id);
          if (el) { el.style.left = "auto"; el.style.top = "auto"; el.style.width = "max-content"; el.style.minWidth = `${View.Types.wrap(item).intrinsicMinWidth()}px`; el.style.height = "auto"; }
        });
      }
      settleSiblingGaps();
      let measured = measureNodes();
      lastAvailable = available;
      let next = Layout.layout(board, measured, { width: available, gap: propsFor(board, "board").gap, padding: propsFor(board, "board").padding, adaptive: true });
      for (let pass = 0; pass < 3; pass += 1) {
        applyLayout(next);
        const gapsMoved = settleSiblingGaps();
        const live = liveCssMeasure(measured);
        if (!gapsMoved && !live.changed) break;
        measured = live.measured;
        next = Layout.layout(board, measured, { width: available, gap: propsFor(board, "board").gap, padding: propsFor(board, "board").padding, adaptive: true });
      }
      applyLayout(next);
      for (let slotPass = 0; slotPass < 3; slotPass += 1) {
        const routed = drawEdges(board, canvas, edgeSvg, elements, doc, result.frames, false);
        if (!growLinkSlotsForArrows(root, routed) || slotPass === 2) break;
        const live = liveCssMeasure(measured);
        measured = live.measured;
        next = Layout.layout(board, measured, { width: lastAvailable, gap: propsFor(board, "board").gap, padding: propsFor(board, "board").padding, adaptive: true });
        applyLayout(next);
        root.querySelectorAll('.box-content').forEach((content) => {
          if (content.style.display === 'none') return;
          const floor = slotGapForContent(content);
          Array.from(content.children || []).forEach((slot) => {
            if (!slot.classList || !slot.classList.contains('board-slot')) return;
            const dir = slot.dataset.boardSlotDir === 'row' ? 'row' : 'column';
            const have = slotAxisSize(slot, dir);
            // Never shrink is-link below arrow need; only lift the Max floor.
            const keep = slot.classList.contains('is-link') ? have : 0;
            const nextSize = Math.max(floor, keep);
            if (nextSize > have + 0.25) applySlotSize(slot, nextSize, dir);
          });
        });
      }
      // Final live sync + paint: edges must use post-slot box edges (canvas links
      // are not slot-sized; parent churn from in-box slots must not leave them floating).
      {
        const live = liveCssMeasure(measured);
        if (live.changed) {
          measured = live.measured;
          next = Layout.layout(board, measured, { width: lastAvailable, gap: propsFor(board, "board").gap, padding: propsFor(board, "board").padding, adaptive: true });
          applyLayout(next);
        }
        drawEdges(board, canvas, edgeSvg, elements, doc, result.frames, true);
      }
      const signature = `${next.width}:${next.height}:${[...measured.values()].map((size) => `${Math.round(size.w)}x${Math.round(size.h)}`).join(",")}`;
      if (lastSignature && signature === lastSignature) return result;
      lastSignature = signature;
      return result;
    };
    targetEl.classList.add("board-preview");
    // Fonts before first resolve — replaces the old fonts.ready → second resolve hook.
    if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      try { await doc.fonts.ready; } catch (_) {}
    }
    await new Promise((done) => {
      const run = () => { resolve(); done(); };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
      else setTimeout(run, 0);
    });
    return { board, root, frames: result.frames, constraints: result.constraints, layout: result };
  }

  // Renderer-global link routing (not DSL): 'stagger' (default) | 'trunk' | 'straight'
  var linkRouteStyle = 'stagger';
  function setLinkRouteStyle(style) {
    linkRouteStyle = STYLE_ROUTES.has(style) ? style : 'stagger';
    return linkRouteStyle;
  }
  function getLinkRouteStyle() { return linkRouteStyle; }

  function themeStroke(name, fallback) {
    const Themes = root.BoardThemes;
    const themeId = (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset.diagramTheme) || 'default';
    const theme = Themes && Themes.get ? Themes.get(themeId) : null;
    if (theme) {
      if (name === '--board-edge') return theme.edgeStroke || fallback;
      if (name === '--board-color') return theme.color || fallback;
    }
    return fallback;
  }

  function edgeStyle(link) {
    const dashed = linkType(link) === 'dashed';
    const color = themeStroke('--board-edge', '#2563eb');
    const marker = 'url(#board-arrow)';
    return {
      color: color,
      marker: marker,
      markerStart: linkArrow(link) === 'both' ? marker : '',
      dash: dashed ? '7 6' : '',
      evidence: false,
    };
  }

  function drawEdges(board, canvas, svg, elements, doc, frames, paint) {
    if (!canvas || !svg) return [];
    const shouldPaint = paint !== false;
    const c = canvas.getBoundingClientRect();
    const layoutWidth = canvas.clientWidth || canvas.offsetWidth;
    const layoutHeight = canvas.clientHeight || canvas.offsetHeight;
    if (!layoutWidth || !layoutHeight || !c.width || !c.height) return [];
    const scaleX = c.width / layoutWidth || 1;
    const scaleY = c.height / layoutHeight || 1;
    if (shouldPaint) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', `0 0 ${Math.ceil(layoutWidth)} ${Math.ceil(layoutHeight)}`);
      svg.setAttribute('width', Math.ceil(layoutWidth));
      svg.setAttribute('height', Math.ceil(layoutHeight));
    }
    if (!Route) throw new Error('BoardRoute module is not loaded');
    const liveRect = (el) => {
      const diamond = View && View.isDiamondEl && View.isDiamondEl(el);
      const geom = (diamond && (
        (View.diamondGeomEl && View.diamondGeomEl(el))
        || el.querySelector('.board-item-diamond-visual, .board-diamond-visual')
      )) || el;
      const rr = geom.getBoundingClientRect();
      const left = (rr.left - c.left) / scaleX;
      const top = (rr.top - c.top) / scaleY;
      const width = rr.width / scaleX;
      const height = rr.height / scaleY;
      return {
        left, right: left + width, top, bottom: top + height,
        x: left + width / 2, y: top + height / 2, width, height,
        kind: diamond ? 'diamond' : (el.dataset.boardKind || ''),
      };
    };
    const boxRects = new Map();
    elements.forEach((el, id) => {
      if (!el) return;
      const rect = liveRect(el);
      if (!(rect.width > 2 && rect.height > 2)) return;
      boxRects.set(id, {
        id,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        kind: rect.kind,
      });
    });
    const items = [];
    (board.links || []).forEach((link, linkIndex) => {
      const from = elements.get(link.from);
      const to = elements.get(link.to);
      if (!from || !to) return;
      const fromRect = liveRect(from);
      const toRect = liveRect(to);
      if ([fromRect.left, fromRect.right, fromRect.top, fromRect.bottom, fromRect.width, fromRect.height, toRect.left, toRect.right, toRect.top, toRect.bottom, toRect.width, toRect.height].some((v) => !Number.isFinite(v))) return;
      items.push({
        from: link.from,
        to: link.to,
        fromRect,
        toRect,
        link,
        linkIndex,
        style: edgeStyle(link),
      });
    });
    Route.route({
      boxes: board.boxes,
      views: board.views || board.boxes,
      links: items,
      boxRects,
      style: linkRouteStyle,
    });
    if (!shouldPaint) return items;
    const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = (idValue, color) => {
      const m = doc.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', idValue);
      m.setAttribute('viewBox', '0 0 10 10');
      m.setAttribute('refX', '9');
      m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '6');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      p.setAttribute('fill', color);
      m.appendChild(p);
      defs.appendChild(m);
    };
    // context-stroke: arrow fill tracks path stroke (selected darken stays in sync).
    marker('board-arrow', 'context-stroke');
    marker('board-arrow-selected', 'context-stroke');
    svg.appendChild(defs);
    const labelObstacles = Array.from(boxRects.values());
    const placedLabels = [];

    items.forEach((item) => {
      if (!item.d) return;
      const style = item.style;
      const hit = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', item.d);
      hit.setAttribute('class', 'board-edge board-edge-hit');
      hit.setAttribute('data-board-edge-key', 'link:' + item.linkIndex);
      hit.setAttribute('data-board-edge-index', String(item.linkIndex));
      hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '14');
      hit.setAttribute('stroke-linecap', 'round');
      hit.setAttribute('stroke-linejoin', 'round');
      hit.style.pointerEvents = 'stroke';
      hit.style.cursor = 'pointer';
      svg.appendChild(hit);
      const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', item.d);
      path.setAttribute('class', `board-edge board-edge-visible${style.evidence ? ' board-evidence-edge' : ''}`);
      path.setAttribute('data-board-edge-key', 'link:' + item.linkIndex);
      path.setAttribute('data-board-edge-index', String(item.linkIndex));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', style.color);
      path.setAttribute('stroke-width', style.evidence ? '1.6' : '1.7');
      if (style.markerStart) path.setAttribute('marker-start', style.markerStart);
      path.setAttribute('marker-end', style.marker);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('shape-rendering', 'geometricPrecision');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.style.pointerEvents = 'none';
      if (style.dash) path.setAttribute('stroke-dasharray', style.dash);
      svg.appendChild(path);
      const title = linkTitle(item.link);
      const showTitle = title && title.toLowerCase() !== 'control';
      if (showTitle) {
        const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.textContent = title;
        text.setAttribute('x', '0');
        text.setAttribute('y', '0');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', style.evidence ? 'board-edge board-edge-label board-feedback-label' : 'board-edge board-edge-label');
        text.setAttribute('data-board-edge-key', 'link:' + item.linkIndex);
        text.setAttribute('data-board-edge-index', String(item.linkIndex));
        text.setAttribute('fill', style.color);
        const Scale = root.BoardTypeScale;
        const step = clampTypeStep(doc.documentElement && doc.documentElement.dataset.boardTypeStep);
        text.setAttribute('font-size', Scale && typeof Scale.px === 'function' ? String(Scale.px('body', step)) : '12');
        svg.appendChild(text);
        // Stroke (paint-order) is outside getBBox — inflate so short-gap
        // placement does not sit under endpoint boxes (ABCDE half-clip).
        const strokePad = 4;
        let metrics = { dx: -6 * title.length - strokePad, dy: -12 - strokePad, width: 12 * title.length + strokePad * 2, height: 16 + strokePad * 2 };
        try {
          const bb = text.getBBox();
          if (bb.width > 0 && bb.height > 0) {
            metrics = {
              dx: bb.x - strokePad,
              dy: bb.y - strokePad,
              width: bb.width + strokePad * 2,
              height: bb.height + strokePad * 2,
            };
          }
        } catch (err) { /* keep the estimate */ }
        const pick = Route.placeLabel
          ? Route.placeLabel(item.points, metrics, labelObstacles.concat(placedLabels))
          : { x: item.labelX, y: item.labelY, box: null };
        text.setAttribute('x', String(pick.x));
        text.setAttribute('y', String(pick.y));
        if (pick.box) placedLabels.push(pick.box);
      }
    });
    // Keep edges above absolute boxes (short-gap labels must not sit under fill).
    if (svg && svg.parentNode) svg.parentNode.appendChild(svg);
    return items;
  }

  function topLevelBoxIds(board) {
    return (board.boxes || []).map(function(box) { return box.id; });
  }

  function refreshEdges(root, board) {
    if (!root || !board) return;
    const canvas = root.querySelector('.board-canvas');
    const svg = root.querySelector('svg.board-edges');
    if (!canvas || !svg) return;
    const elements = new Map();
    root.querySelectorAll('[data-board-id]').forEach((el) => {
      const id = el.getAttribute('data-board-id');
      if (id) elements.set(id, el);
    });
    const frames = new Map();
    elements.forEach((el, id) => {
      const x = Number.parseFloat(el.style.left);
      const y = Number.parseFloat(el.style.top);
      const w = el.offsetWidth || el.clientWidth || 0;
      const h = el.offsetHeight || el.clientHeight || 0;
      frames.set(id, {
        x: Number.isFinite(x) ? x : (el.offsetLeft || 0),
        y: Number.isFinite(y) ? y : (el.offsetTop || 0),
        w, h,
      });
    });
    drawEdges(board, canvas, svg, elements, document, frames);
  }
  return { parse, serialize, findNode, updateTitle, updateType, updateShape, updateCap, updateStyle, encodeStylePayload, decodeStylePayload, authoredViewport, updateIcon, updateId, isIdTaken, updateDir, updateAlign, updateJustify, updateLinkTitle, updateLinkType, updateLinkArrow, reverseLink, updateLinkLabel: updateLinkTitle, updatePosition, reorderInfo, reorderFinalIndex, reorderNode, reparentNode, addBox, addItem, deleteNode, addLink, deleteLink, setLinkRouteStyle, getLinkRouteStyle, resolveStyle, applyDocumentStyle, render, refreshEdges, BoardParseError };
});
