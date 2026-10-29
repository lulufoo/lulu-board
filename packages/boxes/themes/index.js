/* Box chrome. Palette lives in board-themes; this module adds kitFor / applyTo. */
import * as Palette from '../../board-themes/index.js';
import { ring } from '../../board-themes/index.js';
import * as Scale from './type-scale.js';
import * as Rotation from './rotation.js';
import chromeDefault from './packs/chrome-default.js';
import chromeClassic from './packs/chrome-classic.js';
import chromePastel from './packs/chrome-pastel.js';

export * from '../../board-themes/index.js';
export { Scale as TypeScale, Rotation };

const BOX_TYPES = ['card', 'container', 'layout'];
const EDGE_DASH_ALPHA = 0.3;
const partials = { default: chromeDefault, classic: chromeClassic, pastel: chromePastel };
const typesById = {};

function typeChrome(partial) {
  return Object.assign({
    radius: '4px',
    pad: '12px 14px',
    titleColor: '#333',
    titleSize: Scale.sizeForTitle('card'),
    titleWeight: Scale.WEIGHT.title,
    titleMargin: '0 0 8px',
    cardRadius: '4px',
    cardPad: '6px 10px',
    cardSize: Scale.sizeForCard(),
    cardColor: '#333',
    shell: 'filled',
    borderStyle: 'solid',
  }, partial || {});
}

function typesFor(id) {
  if (typesById[id]) return typesById[id];
  const partial = partials[id] || partials.default;
  const types = {};
  BOX_TYPES.forEach((typeName) => {
    const chrome = typeChrome(partial[typeName] || {});
    chrome.titleSize = Scale.sizeForTitle(typeName);
    chrome.cardSize = Scale.sizeForCard();
    types[typeName] = chrome;
  });
  typesById[id] = types;
  return types;
}

function withChrome(themeOrId) {
  const theme = typeof themeOrId === 'string' || themeOrId == null
    ? Palette.get(themeOrId)
    : themeOrId;
  if (theme.types) return theme;
  return Object.assign({}, theme, { types: typesFor(theme.id) });
}

function typeChromeOf(theme, typeName) {
  const key = BOX_TYPES.includes(typeName) ? typeName : 'card';
  return theme.types[key] || theme.types.card;
}

function kitFor(themeOrId, typeName) {
  const theme = withChrome(themeOrId);
  const chrome = typeChromeOf(theme, typeName);
  const fill = theme.colors[0];
  const edge = Palette.edgeTint(theme, EDGE_DASH_ALPHA);
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
    kit.zoneBg = 'transparent';
    kit.zoneBorder = 'transparent';
    kit.panelBg = 'transparent';
    kit.panelHeaderBg = 'transparent';
    kit.borderStyle = 'none';
  } else if (chrome.shell === 'outline') {
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

function applyTo(el, id) {
  if (!el) return withChrome(id);
  const theme = withChrome(id);
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
    '--board-item-text-weight': Scale.WEIGHT.text,
    '--board-note-weight': Scale.WEIGHT.note,
    '--board-bold-weight': Scale.WEIGHT.bold,
    '--board-subtitle-weight': Scale.WEIGHT.subtitle,
    '--board-edge-label-weight': Scale.WEIGHT.edgeLabel,
    '--board-header-weight': Scale.WEIGHT.header,
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
    '--bf-ring': ring.color,
    '--bf-ring-soft': ring.hover,
    '--canvas-ring': ring.color,
    '--canvas-ring-soft': ring.hover,
    '--canvas-ring-width': ring.width + 'px',
    '--canvas-ring-offset': ring.offset + 'px',
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

export { BOX_TYPES, EDGE_DASH_ALPHA, kitFor, applyTo };
