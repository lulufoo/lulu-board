/* Item content align: 3x3. Stored on style.ids.<id>.align. */

const VALUES = [
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
];
const VALUE_SET = new Set(VALUES);

const DEFAULTS = {
  chip: 'center',
  text: 'top-left',
  note: 'top-left',
  icon: 'left',
};

function defaultForType(type) {
  const key = String(type || '').trim();
  return DEFAULTS[key] || 'top-left';
}

function authored(raw) {
  const key = String(raw == null ? '' : raw).trim();
  return VALUE_SET.has(key) ? key : null;
}

function resolve(raw, type) {
  return authored(raw) || defaultForType(type);
}

function apply(el, value) {
  if (!el) return;
  const next = authored(value);
  if (!next) {
    el.removeAttribute('data-board-align');
    return;
  }
  el.setAttribute('data-board-align', next);
}

export { VALUES, DEFAULTS, defaultForType, authored, resolve, apply };
