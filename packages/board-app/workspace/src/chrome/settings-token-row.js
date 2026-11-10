/* One personal-access-token row: swipe left to reveal Revoke. */
import { bindTokenSwipe } from './settings-token-swipe.js';

export function paintTokenRow(row, hooks) {
  var card = document.createElement('div');
  card.className = 'settings-token' + (hooks.armedId === row.id ? ' is-armed' : '');
  card.setAttribute('data-token-id', row.id);
  var body = document.createElement('div');
  body.className = 'settings-token-body';
  var top = document.createElement('div');
  top.className = 'settings-token-title';
  var name = document.createElement('span');
  var dot = document.createElement('i');
  dot.className = 'settings-dot';
  name.appendChild(dot);
  name.appendChild(document.createTextNode(row.name || 'Untitled'));
  var reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'settings-text-btn';
  reveal.textContent = 'Revoke';
  reveal.addEventListener('click', function (event) {
    event.stopPropagation();
    hooks.onReveal(row.id);
  });
  top.appendChild(name);
  var meta = document.createElement('div');
  meta.className = 'settings-token-meta';
  meta.textContent = hooks.prefixLabel(row.prefix) + '\n' + hooks.expiresLabel(row.expires_at);
  body.appendChild(top);
  body.appendChild(meta);
  var action = document.createElement('button');
  action.type = 'button';
  action.className = 'settings-token-action';
  action.textContent = 'Revoke';
  action.addEventListener('click', function (event) {
    event.stopPropagation();
    hooks.onRevoke(row.id);
  });
  card.appendChild(body);
  card.appendChild(reveal);
  card.appendChild(action);
  bindTokenSwipe(card, {
    isOpen: function () { return hooks.isOpen(row.id); },
    setOpen: function (open) { hooks.setArmed(open ? row.id : ''); },
    onDragStart: function () { hooks.onDragStart(card, row.id); },
  });
  return card;
}
