/* Settings dialog: list, generate, and one-time copy of a personal access token. */
import { register, call } from '../core/hooks.js';
import { cloudListTokens, cloudCreateToken, cloudRevokeToken } from '../cloud/cloud-tokens.js';
import { setStatus } from '../state/shell-state.js';
import { paintTokenRow } from './settings-token-row.js';

var settingsBusy = false;
var settingsPlain = '';
var settingsDays = 30;
var settingsArmedId = '';
var settingsRows = [];
var settingsPreviewRows = [
  { id: 'preview-ci', name: 'CI bot', prefix: 'lbp_abcd', expires_at: '2026-12-10T00:00:00Z' },
  { id: 'preview-1', name: 'Spark — Mac', prefix: 'lbp_6a2f', expires_at: '2026-12-10T00:00:00Z' },
];

function settingsEl(id) { return document.getElementById(id); }

function settingsLive() {
  return !call('shellIsPreview') && typeof cloudListTokens === 'function';
}

function settingsPrefixLabel(prefix) {
  var raw = String(prefix || '');
  if (/^lbp_[0-9a-f]{4}$/.test(raw)) return 'lbp_····' + raw.slice(4);
  return raw;
}

function settingsExpiresLabel(iso) {
  var date = new Date(String(iso || ''));
  if (Number.isNaN(date.getTime())) return '';
  return 'Expires ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function settingsSetError(text) {
  var node = settingsEl('settingsError');
  if (node) { node.textContent = text || ''; node.hidden = !text; }
}

function settingsHead(title, sub) {
  var h = settingsEl('settingsDialogTitle');
  var s = settingsEl('settingsDialogSub');
  if (h) h.textContent = title;
  if (s) s.textContent = sub;
}

function settingsShowPane(name) {
  ['List', 'Generate', 'Result'].forEach(function (part) {
    var pane = settingsEl('settingsPane' + part);
    if (pane) pane.hidden = part.toLowerCase() !== name;
  });
  if (name === 'list') settingsHead('Settings', 'Manage access to Board');
  if (name === 'generate') settingsHead('Generate personal access token', 'For reading your diagrams in Spark');
}

function settingsPaintDays() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-settings-days]'), function (btn) {
    var days = Number(btn.getAttribute('data-settings-days'));
    btn.setAttribute('aria-checked', days === settingsDays ? 'true' : 'false');
    btn.classList.toggle('is-active', days === settingsDays);
  });
}

function settingsTokenCards() {
  var box = settingsEl('settingsTokenList');
  return box ? box.querySelectorAll('.settings-token') : [];
}

function settingsSetArmed(id) {
  settingsArmedId = id || '';
  Array.prototype.forEach.call(settingsTokenCards(), function (card) {
    var on = !!settingsArmedId && card.getAttribute('data-token-id') === settingsArmedId;
    card.classList.toggle('is-armed', on);
    var action = card.querySelector('.settings-token-action');
    if (action) action.style.transform = '';
  });
}

function settingsPaintList() {
  var box = settingsEl('settingsTokenList');
  if (!box) return;
  box.replaceChildren();
  if (!settingsRows.length) {
    settingsArmedId = '';
    var empty = document.createElement('p');
    empty.className = 'settings-empty';
    empty.textContent = 'No personal access tokens yet.';
    box.appendChild(empty);
    return;
  }
  settingsRows.forEach(function (row) {
    box.appendChild(paintTokenRow(row, {
      armedId: settingsArmedId,
      prefixLabel: settingsPrefixLabel,
      expiresLabel: settingsExpiresLabel,
      onReveal: settingsSetArmed,
      onRevoke: function (id) { void settingsRevoke(id); },
    }));
  });
}

async function settingsLoadList() {
  settingsSetError('');
  if (!settingsLive()) {
    settingsRows = settingsPreviewRows.slice();
    settingsPaintList();
    return;
  }
  try {
    settingsRows = await cloudListTokens();
  } catch (error) {
    settingsRows = [];
    var message = error && error.message ? error.message : 'Could not load tokens';
    settingsSetError(message);
    if (typeof setStatus === 'function') setStatus(message, true);
  }
  settingsPaintList();
}

function settingsOpenGenerate() {
  settingsSetArmed('');
  settingsSetError('');
  var name = settingsEl('settingsTokenName');
  if (name) name.value = '';
  settingsDays = 30;
  settingsPaintDays();
  settingsShowPane('generate');
  if (name) name.focus({ preventScroll: true });
}

function settingsShowResult(name, days, token) {
  settingsPlain = token;
  var sub = String(name || 'Token') + ' · Expires in ' + days + ' days';
  settingsHead('Token generated', sub);
  var value = settingsEl('settingsTokenValue');
  if (value) value.textContent = token;
  var copy = settingsEl('settingsCopyToken');
  if (copy) copy.textContent = 'Copy';
  settingsShowPane('result');
  if (copy) copy.focus({ preventScroll: true });
}

function settingsOpen() {
  var dialog = settingsEl('settingsDialog');
  if (!dialog) return;
  settingsPlain = '';
  settingsArmedId = '';
  settingsShowPane('list');
  dialog.hidden = false;
  var first = settingsEl('settingsGenerateOpen');
  if (first) first.focus({ preventScroll: true });
  void settingsLoadList();
}

function settingsClose() {
  var dialog = settingsEl('settingsDialog');
  if (dialog) dialog.hidden = true;
  settingsPlain = '';
  settingsArmedId = '';
  settingsSetError('');
  var value = settingsEl('settingsTokenValue');
  if (value) value.textContent = '';
  settingsShowPane('list');
}

async function settingsCreate() {
  if (settingsBusy) return;
  settingsSetError('');
  var input = settingsEl('settingsTokenName');
  var name = input ? String(input.value || '').trim() : '';
  if (!name) { settingsSetError('Name is required'); if (input) input.focus(); return; }
  if (settingsDays !== 7 && settingsDays !== 30 && settingsDays !== 90) {
    settingsSetError('Choose 7, 30, or 90 days');
    return;
  }
  if (!settingsLive()) {
    var fake = 'lbp_' + 'ab'.repeat(32);
    settingsPreviewRows = [{ id: 'preview-new', name: name, prefix: 'lbp_' + fake.slice(-4), expires_at: new Date(Date.now() + settingsDays * 86400000).toISOString() }].concat(settingsPreviewRows);
    settingsShowResult(name, settingsDays, fake);
    return;
  }
  settingsBusy = true;
  try {
    var made = await cloudCreateToken(name, settingsDays);
    settingsShowResult(name, settingsDays, made.token);
  } catch (error) {
    var message = error && error.message ? error.message : 'Could not create token';
    settingsSetError(message);
    if (typeof setStatus === 'function') setStatus(message, true);
  } finally {
    settingsBusy = false;
  }
}

async function settingsRevoke(id) {
  if (settingsBusy || !id) return;
  if (!settingsLive()) {
    settingsPreviewRows = settingsPreviewRows.filter(function (row) { return row.id !== id; });
    settingsRows = settingsPreviewRows.slice();
    settingsArmedId = '';
    settingsPaintList();
    return;
  }
  settingsBusy = true;
  try {
    await cloudRevokeToken(id);
    settingsArmedId = '';
    await settingsLoadList();
    if (typeof setStatus === 'function') setStatus('Token revoked');
  } catch (error) {
    var message = error && error.message ? error.message : 'Could not revoke token';
    settingsSetError(message);
    if (typeof setStatus === 'function') setStatus(message, true);
  } finally {
    settingsBusy = false;
  }
}

async function settingsCopy() {
  var btn = settingsEl('settingsCopyToken');
  if (!settingsPlain || !btn) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(settingsPlain);
    btn.textContent = 'Copied';
    setTimeout(function () { btn.textContent = 'Copy'; }, 1400);
  } catch (error) {
    settingsSetError(error && error.message ? error.message : 'Could not copy token');
  }
}

(function wireSettingsDialog() {
  var dialog = settingsEl('settingsDialog');
  if (!dialog) return;
  settingsEl('settingsDialogBackdrop').addEventListener('click', settingsClose);
  settingsEl('settingsDialogClose').addEventListener('click', settingsClose);
  settingsEl('settingsGenerateOpen').addEventListener('click', settingsOpenGenerate);
  settingsEl('settingsGenerateClose').addEventListener('click', settingsClose);
  settingsEl('settingsGenerateSubmit').addEventListener('click', function () { void settingsCreate(); });
  settingsEl('settingsCopyToken').addEventListener('click', function () { void settingsCopy(); });
  settingsEl('settingsResultDone').addEventListener('click', settingsClose);
  Array.prototype.forEach.call(document.querySelectorAll('[data-settings-days]'), function (btn) {
    btn.addEventListener('click', function () {
      settingsDays = Number(btn.getAttribute('data-settings-days'));
      settingsPaintDays();
    });
  });
  document.addEventListener('pointerdown', function (event) {
    if (!settingsArmedId || dialog.hidden) return;
    var hit = event.target && event.target.closest ? event.target.closest('.settings-token-action') : null;
    var card = hit && hit.closest ? hit.closest('.settings-token') : null;
    if (card && card.getAttribute('data-token-id') === settingsArmedId) return;
    settingsSetArmed('');
  }, true);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || dialog.hidden) return;
    if (settingsArmedId) { event.stopPropagation(); settingsSetArmed(''); return; }
    var confirm = document.getElementById('confirmDialog');
    if (confirm && !confirm.hidden) return;
    event.stopPropagation();
    settingsClose();
  }, true);
  var want = /[?&]settings=open/.exec(location.search);
  if (want) settingsOpen();
})();

register('settingsDialogOpen', settingsOpen);
register('settingsDialogClose', settingsClose);
export { settingsOpen, settingsClose, settingsPrefixLabel, settingsExpiresLabel };
