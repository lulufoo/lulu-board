/* Concrete item type=text. */
(function (root) {
  'use strict';
  const View = root.BoardView;
  if (!View || !View.Item) throw new Error('BoardItem must load before item-text.js');

  class ItemText extends View.Item {
    typeName() { return 'text'; }
    framed() { return false; }
  }

  View.Types.registerItem('text', ItemText);
})(typeof globalThis !== 'undefined' ? globalThis : this);
