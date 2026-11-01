/* Box chrome for the default palette. Colors come from the frozen Light table. */
import light from '../../../board-themes/appearance/light.js';

export default {
  card: { radius: '12px', titleColor: light.chrome.card.titleColor, cardColor: light.chrome.card.cardColor },
  layout: { shell: 'hollow', pad: '0' },
  container: {
    shell: 'outline',
    borderStyle: 'dashed',
    pad: '16px',
    titleColor: light.chrome.container.titleColor,
    cardColor: light.chrome.container.cardColor,
  },
};
