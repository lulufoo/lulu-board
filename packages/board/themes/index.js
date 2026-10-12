/* Board drawing themes — vendor/board/themes (packs + type scale). Public API: BoardThemes. */
(function (root, factory) {
  const Scale = root.BoardTypeScale || (typeof require === 'function' ? require('./type-scale') : null);
  const packs = root.BoardThemePacks || {};
  const loadPack = (name) => packs[name] || (typeof require === 'function' ? require('./packs/' + name) : null);
  const DefaultPack = loadPack('default');
  const ClassicPack = loadPack('classic');
  const PastelPack = loadPack('pastel');
  if (!Scale || !DefaultPack || !ClassicPack || !PastelPack) throw new Error('BoardThemes parts are not loaded');
  const api = factory(Scale, { default: DefaultPack, classic: ClassicPack, pastel: PastelPack });
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
      titleWeight: Scale.TITLE_WEIGHT,
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
      fontFamily: Scale.FONT_FAMILY,
      color: pack.color,
      edgeStroke: pack.edgeStroke,
      edgeLabel: pack.edgeLabel,
      edgeEvidence: pack.edgeEvidence,
      edgeFeedback: pack.edgeFeedback,
      bandBg: pack.bandBg,
      bandBorder: pack.bandBorder,
      colors: pack.colors,
      edgeRgb: pack.edgeRgb || '74, 53, 36',
      types,
    };
  }

  const THEMES = {
    default: hydrate(packs.default),
    classic: hydrate(packs.classic),
    pastel: hydrate(packs.pastel),
  };

  const ORDER = ['default', 'classic', 'pastel'];
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

  /**
   * Chrome tokens for one box type. Fills of filled nodes come from the rotation (themes/rotation.js, painted inline);
   * the first colour of the list is only the fallback for tokens that no node overrides.
   */
  function kitFor(themeOrId, typeName) {
    const theme = typeof themeOrId === 'string' ? get(themeOrId) : themeOrId;
    const chrome = typeChromeOf(theme, typeName);
    const fill = theme.colors[0];
    // same depth in every theme: the pack's edge colour at .3
    const edge = 'rgba(' + theme.edgeRgb + ', .3)';
    const kit = {
      zoneBg: fill,
      zoneBorder: edge,
      panelBg: fill,
      panelHeaderBg: fill,
      cardBg: fill,
      cardBorder: edge,
      cardLeft: '1px solid ' + edge,
      borderStyle: chrome.borderStyle || 'solid',
    };
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

  /** Apply theme-level defaults on .board-render root (first colour / shared edges). */
  function applyTo(el, id) {
    if (!el) return get(id);
    const theme = get(id);
    const step = typeStepOf(el);
    const base = kitFor(theme, 'card');
    const map = {
      '--board-font': theme.fontFamily,
      '--bf-rgb': theme.edgeRgb,
      '--board-color': theme.color,
      '--board-edge': theme.edgeStroke,
      '--board-edge-label': theme.edgeLabel || theme.color,
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
      '--board-label-size': Scale.sizeForLabel(step),
      '--board-card-color': base.cardColor,
      '--board-card-left': base.cardLeft,
      '--board-panel-bg': base.panelBg,
      '--board-panel-header-bg': base.panelHeaderBg,
    };
    BOX_TYPES.forEach((typeName) => {
      const k = kitFor(theme, typeName);
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
    });
    setVars(el, map);
    el.dataset.boardTheme = theme.id;
    return theme;
  }

  return {
    THEMES, ORDER, BOX_TYPES, LEGACY_IDS,
    get, list, resolveId, kitFor, applyTo,
  };
});
