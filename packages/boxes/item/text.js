/* Concrete item type=text. */
/* Concrete item type=text. */
import View from '../view/view.js';

  class ItemText extends View.Item {
    typeName() { return 'text'; }
    framed() { return false; }
  }

  View.Types.registerItem('text', ItemText);
export { ItemText };
