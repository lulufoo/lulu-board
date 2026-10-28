/* Background dropdown in the Style panel. A pick switches the canvas ground and writes the document style. */
import { listGrounds, applyGround } from '../core/workspace-ground.js';
import { persistBoardStyle } from '../kinds/board-style.js';
import { register } from '../core/hooks.js';
import { mountPopupSelect } from './popup-select.js';

function buildGroundFill(ground) {
  return 'radial-gradient(' + ground.dot + ' 1.1px, transparent 1.5px) 0 0 / 8px 8px ' + ground.background;
}

const host = document.getElementById('groundSelectHost');
if (host) {
  const picker = mountPopupSelect(host, {
    label: 'Canvas background',
    value: 'paper',
    options: listGrounds().map((ground) => ({
      value: ground.id,
      label: ground.name,
      icon: { fill: buildGroundFill(ground) },
    })),
    onPick: (id) => {
      applyGround(document.documentElement, id);
      persistBoardStyle({ background: id });
    },
  });
  register('applyDocumentGround', (id) => picker.setValue(id || 'paper'));
}
