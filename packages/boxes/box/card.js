/* Concrete box type=card. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Box) throw new Error('BoardBox must load before box-card.js');

  class BoxCard extends View.Box {
    typeName() { return 'card'; }

    decorate(el, ctx) {
      if (ctx.nested) return;
      const pad = el.style.getPropertyValue('--board-card-zone-pad') || el.style.getPropertyValue('--board-zone-pad') || '12px 14px';
      el.style.padding = pad;
    }
  }

  View.Types.registerBox('card', BoxCard);
})(typeof globalThis !== 'undefined' ? globalThis : this);
