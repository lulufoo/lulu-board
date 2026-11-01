/* Dock / Drawer chrome: page, dock, and source tokens from the appearance table. */
import { getAppearance } from '../../../board-themes/appearance/index.js';

const PAGE_VARS = {
  bg: '--bg',
  canvas: '--canvas',
  panel: '--panel',
  panelSolid: '--panel-solid',
  stroke: '--stroke',
  strokeStrong: '--stroke-strong',
  text: '--text',
  muted: '--muted',
  faint: '--faint',
  accent: '--accent',
  accentSoft: '--accent-soft',
  ok: '--ok',
  warn: '--warn',
  danger: '--danger',
  shadow: '--shadow',
  shadowSoft: '--shadow-soft',
};

const DOCK_VARS = {
  accent: '--accent',
  accentSoft: '--accent-soft',
  ink: '--ink',
  inkSoft: '--ink-soft',
  brand: '--brand',
  paper: '--paper',
  dock: '--dock',
  paperLine: '--paper-line',
  press: '--press',
  wash: '--wash',
  fill: '--fill',
  fillHover: '--fill-hover',
  chip: '--chip',
};

const SOURCE_VARS = {
  paper: '--src-paper',
  ink: '--src-ink',
  num: '--src-num',
  numOn: '--src-num-on',
  indent: '--src-indent',
};

function writeVars(root, map, values) {
  Object.keys(map).forEach((key) => {
    const value = values[key];
    if (value == null) return;
    root.style.setProperty(map[key], value);
  });
}

export function applyChrome(root, id) {
  if (!root || !root.style) return getAppearance(id);
  const table = getAppearance(id);
  writeVars(root, PAGE_VARS, table.page);
  writeVars(root, DOCK_VARS, table.dock);
  writeVars(root, SOURCE_VARS, table.source);
  if (root.dataset) {
    root.dataset.theme = table.id;
    root.dataset.appearance = table.id;
  }
  return table;
}

const DrawerAppearanceChrome = {
  applyChrome: applyChrome,
};

export default DrawerAppearanceChrome;
