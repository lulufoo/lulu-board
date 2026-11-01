/* Session Light/Dark. Not in the style token; later this becomes a user setting. */
import { DEFAULT_APPEARANCE, resolveAppearance } from '../../../board-themes/appearance/index.js';

let current = DEFAULT_APPEARANCE;

export function getSessionAppearance() {
  return current;
}

export function setSessionAppearance(id) {
  current = resolveAppearance(id);
  return current;
}

const DrawerSessionAppearance = {
  getSessionAppearance: getSessionAppearance,
  setSessionAppearance: setSessionAppearance,
};

export default DrawerSessionAppearance;
