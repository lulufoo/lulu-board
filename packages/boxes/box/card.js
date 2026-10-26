/* Concrete box type=card. */
/* Concrete box type=card. */
import View from '../view/view.js';

  class BoxCard extends View.Box {
    typeName() { return 'card'; }

    decorate(el, ctx) {
      if (ctx.nested) return;
      const pad = el.style.getPropertyValue('--board-card-zone-pad') || el.style.getPropertyValue('--board-zone-pad') || '12px 14px';
      el.style.padding = pad;
    }
  }

  View.Types.registerBox('card', BoxCard);
export { BoxCard };
