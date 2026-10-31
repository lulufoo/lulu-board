/* Box child placement: absolute X / Y. Legacy align / justify translate here. */

const ALIGN_X = new Set(['left', 'center', 'right', 'stretch']);
const ALIGN_Y = new Set(['top', 'center', 'bottom', 'stretch']);
const LEGACY_ALIGN = new Set(['start', 'center', 'stretch']);
const LEGACY_JUSTIFY = new Set(['start', 'center', 'between', 'stretch']);

const X_FROM_START = { start: 'left', center: 'center', stretch: 'stretch', between: 'left' };
const Y_FROM_START = { start: 'top', center: 'center', stretch: 'stretch', between: 'top' };

function defaultDir(kind) {
  return kind === 'board' ? 'row' : 'column';
}

function defaultX(kind) {
  return kind === 'board' ? 'left' : 'stretch';
}

function defaultY(kind) {
  return kind === 'board' ? 'stretch' : 'top';
}

function authoredX(raw) {
  const key = String(raw == null ? '' : raw).trim();
  return ALIGN_X.has(key) ? key : null;
}

function authoredY(raw) {
  const key = String(raw == null ? '' : raw).trim();
  return ALIGN_Y.has(key) ? key : null;
}

function directionOf(props, kind) {
  const dir = props && props.direction;
  return dir === 'row' || dir === 'column' ? dir : defaultDir(kind);
}

function translateLegacy(align, justify, dir) {
  const row = dir === 'row';
  const out = {};
  if (LEGACY_ALIGN.has(align)) {
    if (row) out.align_y = Y_FROM_START[align];
    else out.align_x = X_FROM_START[align];
  }
  if (LEGACY_JUSTIFY.has(justify)) {
    if (row) out.align_x = X_FROM_START[justify];
    else out.align_y = Y_FROM_START[justify];
  }
  return out;
}

function normalizeProps(props, kind) {
  const src = props && typeof props === 'object' ? props : {};
  const next = Object.assign({}, src);
  const legacy = translateLegacy(next.align, next.justify, directionOf(next, kind));
  if (authoredX(next.align_x) == null && legacy.align_x) next.align_x = legacy.align_x;
  if (authoredY(next.align_y) == null && legacy.align_y) next.align_y = legacy.align_y;
  delete next.align;
  delete next.justify;
  if (next.align_x != null && !authoredX(next.align_x)) delete next.align_x;
  if (next.align_y != null && !authoredY(next.align_y)) delete next.align_y;
  return next;
}

function resolve(props, kind) {
  const src = props && typeof props === 'object' ? props : {};
  return {
    align_x: authoredX(src.align_x) || defaultX(kind),
    align_y: authoredY(src.align_y) || defaultY(kind),
  };
}

function cssAlign(value, end) {
  if (value === 'center') return 'center';
  if (value === 'stretch') return 'stretch';
  if (value === end) return 'flex-end';
  return 'flex-start';
}

function applyToFlex(el, props) {
  if (!el || !props) return;
  const row = props.direction === 'row';
  const cross = row ? props.align_y : props.align_x;
  const main = row ? props.align_x : props.align_y;
  el.style.alignItems = cssAlign(cross, row ? 'bottom' : 'right');
  el.style.justifyContent = main === 'center' ? 'center' : cssAlign(main, row ? 'right' : 'bottom') === 'flex-end'
    ? 'flex-end'
    : 'flex-start';
  el.classList.toggle('board-justify-stretch', main === 'stretch');
}

function isMainStretch(props) {
  if (!props) return false;
  return props.direction === 'row' ? props.align_x === 'stretch' : props.align_y === 'stretch';
}

export {
  ALIGN_X, ALIGN_Y, LEGACY_ALIGN, LEGACY_JUSTIFY,
  defaultDir, defaultX, defaultY, authoredX, authoredY,
  translateLegacy, normalizeProps, resolve, applyToFlex, isMainStretch,
};
