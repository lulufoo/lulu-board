/* Board drawing themes — vendor/board/themes (packs + type scale). Public API: BoardThemes. */
(function (root, factory) {
  const Scale = root.BoardTypeScale || (typeof require === 'function' ? require('./type-scale') : null);
  const packs = root.BoardThemePacks || {};
  const loadPack = (name) => packs[name] || (typeof require === 'function' ? require('./packs/' + name) : null);
  const DefaultPack = loadPack('default');
  const ClassicPack = loadPack('classic');
  const PastelPack = loadPack('pastel');
  const KamiPack = loadPack('kami');
  if (!Scale || !DefaultPack || !ClassicPack || !PastelPack || !KamiPack) throw new Error('BoardThemes parts are not loaded');
  const api = factory(Scale, { default: DefaultPack, classic: ClassicPack, pastel: PastelPack, kami: KamiPack });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Scale, packs) {
  'use strict';

  const BOX_TYPES = ['card', 'container', 'layout'];

  function typeChrome(partial) {
    return Object.assign({
      radius: '4px',
      pad: '12px 14px',
      titleColor: '#333',
      titleSize: Scale.sizeForTitle('card'),
      titleWeight: '700',
      titleMargin: '0 0 8px',
      cardRadius: '4px',
      cardPad: '6px 10px',
      cardSize: Scale.sizeForCard(),
      cardColor: '#333',
      // transparent shell types ignore zone fill from kit
      shell: 'filled', // filled | outline | hollow
      borderStyle: 'solid',
    }, partial || {});
  }

  function hydrate(pack) {
    const types = {};
    BOX_TYPES.forEach((typeName) => {
      const chrome = typeChrome((pack.typePartials && pack.typePartials[typeName]) || {});
      chrome.titleSize = Scale.sizeForTitle(typeName);
      chrome.cardSize = Scale.sizeForCard();
      types[typeName] = chrome;
    });
    return {
      id: pack.id,
      label: pack.label,
      fontFamily: pack.fontFamily,
      color: pack.color,
      edgeStroke: pack.edgeStroke,
      edgeEvidence: pack.edgeEvidence,
      edgeFeedback: pack.edgeFeedback,
      bandBg: pack.bandBg,
      bandBorder: pack.bandBorder,
      swatches: pack.swatches,
      types,
    };
  }

  function kitFromPool(swatches, toneIndex, itemCount) {
    const n = swatches.length || 1;
    const start = ((toneIndex % n) + n) % n;
    const primary = swatches[start];
    const items = [];
    const count = Math.max(itemCount || 5, 5);
    for (let i = 0; i < count; i++) {
      items.push(swatches[(start + i) % n].item || swatches[(start + i) % n].bg);
    }
    return {
      zoneBg: primary.bg,
      zoneBorder: primary.border,
      panelBg: primary.bg,
      panelHeaderBg: primary.bg,
      cardBg: primary.card || '#fff',
      cardBorder: primary.border,
      cardLeft: '1px solid ' + primary.border,
      itemPalette: items,
      toneIndex: start,
    };
  }

  const THEMES = {
    default: hydrate(packs.default),
    classic: hydrate(packs.classic),
    pastel: hydrate(packs.pastel),
    kami: hydrate(packs.kami),
  };
  const FALLBACK_SWATCHES = THEMES.default.swatches;

  const ORDER = ['default', 'classic', 'pastel', 'kami'];
  const LEGACY_IDS = { minimal: 'classic', slate: 'pastel' };

  function resolveId(id) {
    const raw = String(id == null || id === '' ? 'default' : id);
    const mapped = LEGACY_IDS[raw] || raw;
    return THEMES[mapped] ? mapped : 'default';
  }

  function get(id) {
    return THEMES[resolveId(id)];
  }

  function list() {
    return ORDER.map((id) => ({ id, label: THEMES[id].label }));
  }

  function typeChromeOf(theme, typeName) {
    const key = BOX_TYPES.includes(typeName) ? typeName : 'card';
    return (theme.types && theme.types[key]) || theme.types.card;
  }

  /** Build a color kit for one box: theme swatches rotated by toneIndex. */
  function kitFor(themeOrId, typeName, toneIndex, itemCount) {
    const theme = typeof themeOrId === 'string' ? get(themeOrId) : themeOrId;
    const chrome = typeChromeOf(theme, typeName);
    const kit = kitFromPool(theme.swatches || FALLBACK_SWATCHES, toneIndex || 0, itemCount || 8);
    if (chrome.shell === 'hollow') {
      // Pure layout / invisible chrome
      kit.zoneBg = 'transparent';
      kit.zoneBorder = 'transparent';
      kit.panelBg = 'transparent';
      kit.panelHeaderBg = 'transparent';
      kit.borderStyle = 'none';
    } else if (chrome.shell === 'outline') {
      // Grouping: transparent fill, visible border (container default = dashed)
      kit.zoneBg = 'transparent';
      kit.panelBg = 'transparent';
      kit.panelHeaderBg = 'transparent';
      kit.borderStyle = chrome.borderStyle || 'dashed';
    } else {
      kit.borderStyle = chrome.borderStyle || 'solid';
    }
    kit.radius = chrome.radius;
    kit.pad = chrome.pad;
    kit.titleColor = chrome.titleColor;
    kit.titleSize = chrome.titleSize;
    kit.titleWeight = chrome.titleWeight;
    kit.titleMargin = chrome.titleMargin;
    kit.cardRadius = chrome.cardRadius;
    kit.cardPad = chrome.cardPad;
    kit.cardSize = chrome.cardSize;
    kit.cardColor = chrome.cardColor;
    if (chrome.shell === 'hollow' || chrome.shell === 'outline') {
      const raw = kitFromPool(theme.swatches || FALLBACK_SWATCHES, toneIndex || 0, 8);
      kit.cardLeft = '1px solid ' + raw.zoneBorder;
      kit.cardBorder = raw.zoneBorder;
      kit.itemPalette = raw.itemPalette;
      if (chrome.shell === 'outline' && !kit.zoneBorder) kit.zoneBorder = raw.zoneBorder;
    }
    return kit;
  }

  function setVars(el, map) {
    Object.keys(map).forEach((k) => el.style.setProperty(k, map[k]));
  }

  function typeStepOf(el) {
    const doc = (el && el.ownerDocument) || (typeof document !== 'undefined' ? document : null);
    const raw = doc && doc.documentElement && doc.documentElement.dataset
      ? doc.documentElement.dataset.boardTypeStep
      : 0;
    return Scale.clampStep(raw);
  }

  /** Apply theme-level defaults on .board-render root (tone 0 / shared edges). */
  function applyTo(el, id) {
    if (!el) return get(id);
    const theme = get(id);
    const step = typeStepOf(el);
    const base = kitFor(theme, 'card', 0, 8);
    const map = {
      '--board-font': theme.fontFamily,
      '--board-color': theme.color,
      '--board-edge': theme.edgeStroke,
      '--board-edge-evidence': theme.edgeEvidence,
      '--board-edge-feedback': theme.edgeFeedback,
      '--board-band-bg': theme.bandBg,
      '--board-band-border': theme.bandBorder,
      '--board-zone-bg': base.zoneBg,
      '--board-zone-border': base.zoneBorder,
      '--board-zone-radius': base.radius,
      '--board-zone-pad': base.pad,
      '--board-display-size': Scale.sizes(step).display,
      '--board-title-color': base.titleColor,
      '--board-title-size': Scale.sizeForTitle('card', step),
      '--board-title-weight': base.titleWeight,
      '--board-title-margin': base.titleMargin,
      '--board-card-bg': base.cardBg,
      '--board-card-border': base.cardBorder,
      '--board-card-radius': base.cardRadius,
      '--board-card-pad': base.cardPad,
      '--board-card-size': Scale.sizeForCard(step),
      '--board-card-color': base.cardColor,
      '--board-card-left': base.cardLeft,
      '--board-panel-bg': base.panelBg,
      '--board-panel-header-bg': base.panelHeaderBg,
    };
    for (let i = 0; i < 8; i++) {
      map['--board-item-bg-' + (i + 1)] = base.itemPalette[i % base.itemPalette.length];
    }
    BOX_TYPES.forEach((typeName, typeIdx) => {
      const k = kitFor(theme, typeName, typeIdx, 8);
      const p = typeName + '-';
      map['--board-' + p + 'zone-bg'] = k.zoneBg;
      map['--board-' + p + 'zone-border'] = k.zoneBorder;
      map['--board-' + p + 'zone-radius'] = k.radius;
      map['--board-' + p + 'zone-pad'] = k.pad;
      map['--board-' + p + 'title-color'] = k.titleColor;
      map['--board-' + p + 'title-size'] = Scale.sizeForTitle(typeName, step);
      map['--board-' + p + 'title-weight'] = k.titleWeight;
      map['--board-' + p + 'title-margin'] = k.titleMargin;
      map['--board-' + p + 'card-bg'] = k.cardBg;
      map['--board-' + p + 'card-border'] = k.cardBorder;
      map['--board-' + p + 'card-radius'] = k.cardRadius;
      map['--board-' + p + 'card-pad'] = k.cardPad;
      map['--board-' + p + 'card-size'] = Scale.sizeForCard(step);
      map['--board-' + p + 'card-color'] = k.cardColor;
      map['--board-' + p + 'card-left'] = k.cardLeft;
      map['--board-' + p + 'panel-bg'] = k.panelBg;
      map['--board-' + p + 'panel-header-bg'] = k.panelHeaderBg;
      for (let i = 0; i < 8; i++) {
        map['--board-' + p + 'item-bg-' + (i + 1)] = k.itemPalette[i % k.itemPalette.length];
      }
    });
    setVars(el, map);
    el.dataset.boardTheme = theme.id;
    return theme;
  }

  /**
   * Apply a per-box kit onto a box element (overrides inherited theme vars for this subtree).
   * toneIndex: stable color set index; typically sibling order among top-level boxes.
   */
  function applyBoxTone(el, themeOrId, typeName, toneIndex, itemCount) {
    if (!el) return null;
    const theme = typeof themeOrId === 'string' ? get(themeOrId) : (themeOrId || get('default'));
    const step = typeStepOf(el);
    const kit = kitFor(theme, typeName, toneIndex || 0, itemCount || 8);
    const chrome = typeChromeOf(theme, typeName);
    // Transparent shells (layout hollow / container outline) keep
    // own zone clear of fill; nested kids still get filled card tokens via fillKit.
    const transparentHost = chrome.shell === 'hollow' || chrome.shell === 'outline';
    const fillKit = transparentHost
      ? kitFor(theme, 'card', toneIndex || 0, itemCount || 8)
      : kit;
    const hostZone = transparentHost ? kit : fillKit;
    const map = {
      '--board-zone-bg': hostZone.zoneBg,
      '--board-zone-border': hostZone.zoneBorder,
      '--board-zone-border-style': kit.borderStyle || 'solid',
      '--board-zone-radius': fillKit.radius,
      '--board-zone-pad': transparentHost ? kit.pad : fillKit.pad,
      '--board-title-color': kit.titleColor,
      '--board-title-size': Scale.sizeForTitle(typeName, step),
      '--board-title-weight': kit.titleWeight,
      '--board-title-margin': kit.titleMargin,
      '--board-card-bg': fillKit.cardBg,
      '--board-card-border': fillKit.cardBorder,
      '--board-card-radius': fillKit.cardRadius,
      '--board-card-pad': fillKit.cardPad,
      '--board-card-size': Scale.sizeForCard(step),
      '--board-card-color': fillKit.cardColor,
      '--board-card-left': fillKit.cardLeft,
      '--board-panel-bg': hostZone.panelBg,
      '--board-panel-header-bg': hostZone.panelHeaderBg,
      '--board-card-zone-bg': fillKit.zoneBg,
      '--board-card-zone-border': fillKit.zoneBorder,
      '--board-card-zone-pad': fillKit.pad,
      '--board-card-zone-radius': fillKit.radius,
      '--board-card-card-pad': fillKit.cardPad,
      '--board-card-card-bg': fillKit.cardBg,
      '--board-container-card-pad': kit.cardPad,
      '--board-container-card-bg': kit.cardBg,
      '--board-container-zone-bg': kit.zoneBg,
      '--board-container-zone-border': kit.zoneBorder,
      '--board-container-zone-border-style': kit.borderStyle || 'solid',
      '--board-container-card-border': kit.cardBorder,
      '--board-container-card-left': kit.cardLeft,
      '--board-card-card-border': fillKit.cardBorder,
      '--board-card-card-left': fillKit.cardLeft,
      '--board-card-panel-bg': fillKit.panelBg,
      '--board-card-panel-header-bg': fillKit.panelHeaderBg,
    };
    for (let i = 0; i < 8; i++) {
      const c = fillKit.itemPalette[i % fillKit.itemPalette.length];
      const cc = kit.itemPalette[i % kit.itemPalette.length];
      map['--board-item-bg-' + (i + 1)] = c;
      map['--board-card-item-bg-' + (i + 1)] = c;
      map['--board-container-item-bg-' + (i + 1)] = cc;
    }
    setVars(el, map);
    el.dataset.boardTone = String(kit.toneIndex);
    el.classList.add('board-tone-' + (kit.toneIndex % 10));
    return kit;
  }

  return {
    THEMES, ORDER, BOX_TYPES, LEGACY_IDS,
    get, list, resolveId, kitFor, kitFromPool, applyTo, applyBoxTone,
  };
});
