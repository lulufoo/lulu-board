/* One dropdown for the Style panel (Theme, Background). A native <select> cannot draw icons and its popup
 * is the system menu, so this is a small listbox. Each option may carry an icon: { fill, glyph? }. fill is any
 * CSS background value for a 22px box. By default the box is a disc; glyph: true draws it with no disc. */

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

/* config: { label, options: [{ value, label, icon? }], value, onPick(value) }. Returns { setValue }. */
export function mountPopupSelect(host, config) {
  const withIcon = config.options.some((option) => option.icon);
  const { trigger, icon, name } = buildTrigger(config.label, withIcon);
  const menu = document.createElement('ul');
  menu.className = 'ps-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', config.label);
  config.options.forEach((option) => menu.appendChild(buildOption(option)));
  host.classList.add('popup-select');
  host.classList.toggle('has-icon', withIcon);
  host.append(trigger, menu);

  let current = config.value;
  const rows = () => Array.from(menu.querySelectorAll('.ps-option'));

  function setValue(value) {
    const found = config.options.find((option) => option.value === value) || config.options[0];
    current = found.value;
    name.textContent = found.label;
    if (icon && found.icon) paintIcon(icon, found.icon);
    rows().forEach((row) => row.setAttribute('aria-selected', row.dataset.value === current ? 'true' : 'false'));
  }

  function closeMenu(returnFocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    openMenus.delete(closeMenu);
    if (returnFocus) trigger.focus();
  }

  function openMenu() {
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
    else if (event.key === 'Home') moveFocus(-config.options.length);
    else if (event.key === 'End') moveFocus(config.options.length);
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
  return { setValue };
}
