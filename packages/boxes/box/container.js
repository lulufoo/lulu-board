/* Concrete box type=container. */
/* Concrete box type=container. */
import View from '../view/view.js';

  class BoxContainer extends View.Box {
    typeName() { return 'container'; }

    decorate(el) {
      el.classList.add('board-container');
    }
  }

  View.Types.registerBox('container', BoxContainer);
export { BoxContainer };
