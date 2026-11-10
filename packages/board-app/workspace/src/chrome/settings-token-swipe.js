/* Pointer swipe that reveals the trailing revoke action on a token row. */
export var TOKEN_ACTION_W = 88;

export function bindTokenSwipe(card, opts) {
  var startX = 0, origin = 0, dragging = false, tracking = false;
  var width = opts.width || TOKEN_ACTION_W;
  function action() { return card.querySelector('.settings-token-action'); }
  card.addEventListener('pointerdown', function (event) {
    if (event.button) return;
    if (event.target.closest && event.target.closest('.settings-token-action')) return;
    tracking = true;
    dragging = false;
    startX = event.clientX;
    origin = opts.isOpen() ? 0 : width;
    if (card.setPointerCapture) card.setPointerCapture(event.pointerId);
  });
  card.addEventListener('pointermove', function (event) {
    if (!tracking) return;
    var dx = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < 10) return;
      dragging = true;
      if (opts.onDragStart) opts.onDragStart();
      card.classList.add('is-dragging');
      card.classList.remove('is-armed');
    }
    var x = Math.min(width, Math.max(0, origin + dx));
    var node = action();
    if (node) node.style.transform = 'translateX(' + x + 'px)';
  });
  function endDrag(event) {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    var x = Math.min(width, Math.max(0, origin + (event.clientX - startX)));
    opts.setOpen(x < width / 2);
  }
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
}
