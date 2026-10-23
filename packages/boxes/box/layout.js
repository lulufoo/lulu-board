/* Concrete box type=layout — pure arrangement (no chrome, no title/icon). */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Box) throw new Error('BoardBox must load before box-layout.js');

  class BoxLayout extends View.Box {
    typeName() { return 'layout'; }

    decorate(el) {
      el.classList.add('board-layout');
    }
  }

  View.Types.registerBox('layout', BoxLayout);
})(typeof globalThis !== 'undefined' ? globalThis : this);
