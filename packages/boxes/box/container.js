/* Concrete box type=container. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Box) throw new Error('BoardBox must load before box-container.js');

  class BoxContainer extends View.Box {
    typeName() { return 'container'; }

    decorate(el) {
      el.classList.add('board-container');
    }
  }

  View.Types.registerBox('container', BoxContainer);
})(typeof globalThis !== 'undefined' ? globalThis : this);
