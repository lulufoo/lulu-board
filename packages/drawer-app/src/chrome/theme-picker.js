/* Palette dropdown in the Style panel. The native <select id="kindThemeSelect"> stays hidden
 * as the one source of truth. Code that sets select.value or listens for "change" keeps working. */
import { THEMES } from '../../../board-themes/index.js';
import { mountPopupSelect } from './popup-select.js';

/* One solid chip in the theme's link color. A pale card tint would vanish on the white panel. */
function buildThemeIcon(id) {
  const theme = THEMES[id];
  if (!theme) return { fill: '#fff' };
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'>"
    + "<rect x='2' y='2' width='18' height='18' rx='5.5' fill='" + theme.edgeStroke + "'/>"
    + '</svg>';
  return { fill: 'url("data:image/svg+xml;utf8,' + svg.replace(/#/g, '%23') + '") center / contain no-repeat', glyph: true };
}

const select = document.getElementById('kindThemeSelect');
const host = document.getElementById('themeSelectHost');
if (select && host) {
  const picker = mountPopupSelect(host, {
    label: select.getAttribute('aria-label') || 'Palette',
    value: select.value,
    options: Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.textContent,
      icon: buildThemeIcon(option.value),
    })),
    onPick: (value) => {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
  });
  const native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(select, 'value', {
    configurable: true,
    get() { return native.get.call(select); },
    set(value) {
      native.set.call(select, value);
      picker.setValue(native.get.call(select));
    },
  });
}
