/* Concrete box type=layout — pure arrangement (no chrome, no title/icon). */
/* Concrete box type=layout — pure arrangement (no chrome, no title/icon). */
import View from '../view/view.js';

  class BoxLayout extends View.Box {
    typeName() { return 'layout'; }

    decorate(el) {
      el.classList.add('board-layout');
    }
  }

  View.Types.registerBox('layout', BoxLayout);
export { BoxLayout };
