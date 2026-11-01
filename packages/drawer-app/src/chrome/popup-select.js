/* One dropdown (Palette, Properties, Flowchart, Mindmap). A native <select>
 * cannot draw icons and its popup is the system menu, so this is a small listbox.
 * Each option may carry an icon: { fill, glyph? }. fill is any CSS background value
 * for a 22px box. By default the box is a disc; glyph: true draws it with no disc. */

const openMenus = new Set();

function paintIcon(icon, spec) {
  icon.style.background = spec.fill;
  icon.classList.toggle('is-glyph', Boolean(spec.glyph));
}

function buildIcon(spec) {
  const icon = document.createElement('span');
  icon.className = 'ps-icon';
  paintIcon(icon, spec);
  return icon;
}

function buildOption(option) {
  const item = document.createElement('li');
  item.className = 'ps-option';
  item.dataset.value = option.value;
  item.tabIndex = -1;
  item.setAttribute('role', 'option');
  if (option.icon) item.appendChild(buildIcon(option.icon));
  const name = document.createElement('span');
  name.textContent = option.label;
  item.appendChild(name);
  return item;
}

function buildTrigger(label, withIcon) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'ps-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', label);
  const icon = withIcon ? buildIcon({ fill: '#fff' }) : null;
  const name = document.createElement('span');
  if (icon) trigger.appendChild(icon);
  trigger.appendChild(name);
  return { trigger, icon, name };
}

function optionsFromSelect(select, iconFor) {
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.textContent,
    icon: iconFor ? iconFor(option) : undefined,
  }));
}

/* config: { label, options: [{ value, label, icon? }], value, onPick(value) }.
 * Returns { setValue, setOptions, setDisabled }. */
export function mountPopupSelect(host, config) {
  let options = (config.options || []).slice();
  const withIcon = options.some((option) => option.icon);
  const { trigger, icon, name } = buildTrigger(config.label, withIcon);
  const menu = document.createElement('ul');
  menu.className = 'ps-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', config.label);
  options.forEach((option) => menu.appendChild(buildOption(option)));
  host.classList.add('popup-select');
  host.classList.toggle('has-icon', withIcon);
  host.append(trigger, menu);

  let current = config.value;
  const rows = () => Array.from(menu.querySelectorAll('.ps-option'));

  function setValue(value) {
    const found = options.find((option) => option.value === value) || options[0];
    if (!found) {
      current = value || '';
      name.textContent = '';
      return;
    }
    current = found.value;
    name.textContent = found.label;
    if (icon && found.icon) paintIcon(icon, found.icon);
    rows().forEach((row) => row.setAttribute('aria-selected', row.dataset.value === current ? 'true' : 'false'));
  }

  function setOptions(next) {
    options = (next || []).slice();
    host.classList.toggle('has-icon', options.some((option) => option.icon));
    menu.replaceChildren();
    options.forEach((option) => menu.appendChild(buildOption(option)));
    setValue(current);
  }

  function setDisabled(disabled) {
    trigger.disabled = !!disabled;
    if (disabled) closeMenu(false);
  }

  function closeMenu(returnFocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    openMenus.delete(closeMenu);
    if (returnFocus) trigger.focus();
  }

  function openMenu() {
    if (trigger.disabled || !rows().length) return;
    openMenus.forEach((close) => { if (close !== closeMenu) close(false); });
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openMenus.add(closeMenu);
    (rows().find((row) => row.dataset.value === current) || rows()[0]).focus({ preventScroll: true });
  }

  function pick(value) {
    closeMenu(true);
    if (value !== current) config.onPick(value);
    setValue(value);
  }

  function moveFocus(step) {
    const list = rows();
    if (!list.length) return;
    const next = Math.min(list.length - 1, Math.max(0, list.indexOf(document.activeElement) + step));
    list[next].focus({ preventScroll: true });
  }

  trigger.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(false)));
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (menu.hidden) openMenu();
  });
  menu.addEventListener('mouseover', (event) => {
    const row = event.target.closest('.ps-option');
    if (row && row !== document.activeElement) row.focus({ preventScroll: true });
  });
  menu.addEventListener('click', (event) => {
    const row = event.target.closest('.ps-option');
    if (row) pick(row.dataset.value);
  });
  menu.addEventListener('keydown', (event) => {
    const row = event.target.closest('.ps-option');
    if (event.key === 'ArrowDown') moveFocus(1);
    else if (event.key === 'ArrowUp') moveFocus(-1);
    else if (event.key === 'Home') moveFocus(-options.length);
    else if (event.key === 'End') moveFocus(options.length);
    else if ((event.key === 'Enter' || event.key === ' ') && row) pick(row.dataset.value);
    else if (event.key === 'Escape') closeMenu(true);
    else if (event.key === 'Tab') closeMenu(false);
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !host.contains(event.target)) closeMenu(false);
  });

  setValue(config.value);
  return { setValue, setOptions, setDisabled };
}

/* Hide a native <select>, paint a listbox beside it, and keep select.value / change as the SoT. */
export function bindNativeSelect(select, extras) {
  const opt = extras || {};
  if (!select || select.dataset.psBound === '1') return null;
  select.dataset.psBound = '1';
  select.classList.add('ps-bound');
  let host = opt.host || null;
  if (!host) {
    host = document.createElement('div');
    select.insertAdjacentElement('afterend', host);
  }
  const native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const picker = mountPopupSelect(host, {
    label: opt.label || select.getAttribute('aria-label') || '',
    value: native.get.call(select),
    options: optionsFromSelect(select, opt.iconFor),
    onPick: (value) => {
      native.set.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
  });
  Object.defineProperty(select, 'value', {
    configurable: true,
    get() { return native.get.call(select); },
    set(value) {
      native.set.call(select, value);
      picker.setValue(native.get.call(select));
    },
  });
  function syncChrome() {
    picker.setDisabled(select.disabled);
    if (!opt.hostAlways) host.hidden = !!select.hidden;
    picker.setOptions(optionsFromSelect(select, opt.iconFor));
    picker.setValue(native.get.call(select));
  }
  const observer = new MutationObserver(syncChrome);
  observer.observe(select, { childList: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });
  select.addEventListener('focus', () => {
    const trigger = host.querySelector('.ps-trigger');
    if (trigger && !select.disabled) trigger.focus();
  });
  syncChrome();
  return picker;
}
