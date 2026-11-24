/* Settings: browser collaboration preference and separate personal-access-token panes. */
import { register, call } from '../core/hooks.js';
import { getWebMcpPreference, setWebMcpEnabled, subscribeWebMcpPreference } from '../core/webmcp-preference.js';
import { cloudListTokens, cloudCreateToken, cloudRevokeToken } from '../cloud/cloud-tokens.js';
import { setStatus } from '../state/shell-state.js';
import { paintTokenRow } from './settings-token-row.js';

var settingsBusy = false;
var settingsPlain = '';
var settingsDays = 30;
var settingsArmedId = '';
var settingsRows = [];
var settingsTab = 'general';
var settingsListLoaded = false;
var settingsSession = 0;
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

function settingsPaintPreference() {
  var state = getWebMcpPreference();
  var toggle = settingsEl('settingsWebMcpSwitch');
  if (toggle) toggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
  var notice = settingsEl('settingsPreferenceNotice');
  if (notice) {
    notice.textContent = state.storageError === 'read'
      ? 'This browser could not load the setting. WebMCP stays off until you choose a setting.'
      : state.storageError === 'write'
        ? 'Changed for this tab. This browser could not save the setting for your next visit.'
        : '';
    notice.hidden = !state.storageError;
  }
}

function settingsSelectTab(name, focus) {
  settingsTab = name === 'tokens' ? 'tokens' : 'general';
  ['general', 'tokens'].forEach(function (part) {
    var suffix = part === 'general' ? 'General' : 'Tokens';
    var tab = settingsEl('settingsTab' + suffix);
    var panel = settingsEl('settingsPanel' + suffix);
    var selected = part === settingsTab;
    if (tab) {
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus({ preventScroll: true });
    }
    if (panel) panel.hidden = !selected;
  });
  settingsSetArmed('');
  if (settingsTab === 'tokens' && !settingsListLoaded) {
    settingsListLoaded = true;
    void settingsLoadList();
  }
}

function settingsShowPane(name) {
  ['List', 'Generate', 'Result'].forEach(function (part) {
    var pane = settingsEl('settingsPane' + part);
    if (pane) pane.hidden = part.toLowerCase() !== name;
  });
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
    var reveal = card.querySelector('.settings-text-btn');
    if (reveal) reveal.tabIndex = on ? -1 : 0;
    var action = card.querySelector('.settings-token-action');
    if (action) {
      action.style.transform = '';
      action.tabIndex = on ? 0 : -1;
      if (settingsTab === 'tokens') {
        if (on) action.focus({ preventScroll: true });
        else if (document.activeElement === action && reveal) reveal.focus({ preventScroll: true });
      }
    }
  });
}

function settingsPaintList() {
  var box = settingsEl('settingsTokenList');
  if (!box) return;
  var hadFocus = box.contains(document.activeElement);
  box.replaceChildren();
  if (!settingsRows.length) {
    settingsArmedId = '';
    var empty = document.createElement('p');
    empty.className = 'settings-empty';
    empty.textContent = 'No personal access tokens yet.';
    box.appendChild(empty);
  } else {
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
  if (hadFocus && settingsTab === 'tokens') {
    var trigger = settingsEl('settingsGenerateOpen');
    if (trigger && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true });
  }
}

async function settingsLoadList() {
  var session = settingsSession;
  settingsSetError('');
  if (!settingsLive()) {
    settingsRows = settingsPreviewRows.slice();
    settingsPaintList();
    return;
  }
  try {
    var rows = await cloudListTokens();
    if (session !== settingsSession) return;
    settingsRows = rows;
  } catch (error) {
    if (session !== settingsSession) return;
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
  var resultSub = settingsEl('settingsTokenResultSub');
  if (resultSub) resultSub.textContent = sub;
  var value = settingsEl('settingsTokenValue');
  if (value) value.textContent = token;
  var copy = settingsEl('settingsCopyToken');
  if (copy) copy.textContent = 'Copy';
  settingsShowPane('result');
  if (copy && settingsTab === 'tokens') copy.focus({ preventScroll: true });
}

function settingsOpen() {
  var dialog = settingsEl('settingsDialog');
  if (!dialog) return;
  settingsSession += 1;
  settingsPlain = '';
  settingsArmedId = '';
  settingsListLoaded = false;
  settingsSetError('');
  var value = settingsEl('settingsTokenValue');
  if (value) value.textContent = '';
  settingsShowPane('list');
  settingsPaintPreference();
  dialog.hidden = false;
  settingsSelectTab('general', true);
}

function settingsClose() {
  settingsSession += 1;
  var dialog = settingsEl('settingsDialog');
  if (dialog) dialog.hidden = true;
  settingsPlain = '';
  settingsArmedId = '';
  settingsSetError('');
  var value = settingsEl('settingsTokenValue');
  if (value) value.textContent = '';
  settingsShowPane('list');
  var trigger = settingsEl('btnShellSettings');
  if (trigger) trigger.focus({ preventScroll: true });
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
  var session = settingsSession;
  try {
    var made = await cloudCreateToken(name, settingsDays);
    if (session !== settingsSession) return;
    settingsShowResult(name, settingsDays, made.token);
  } catch (error) {
    if (session !== settingsSession) return;
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
  var session = settingsSession;
  try {
    await cloudRevokeToken(id);
    if (session !== settingsSession) return;
    settingsArmedId = '';
    await settingsLoadList();
    if (typeof setStatus === 'function') setStatus('Token revoked');
  } catch (error) {
    if (session !== settingsSession) return;
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
  settingsPaintPreference();
  subscribeWebMcpPreference(settingsPaintPreference);
  settingsEl('settingsWebMcpSwitch').addEventListener('click', function () {
    setWebMcpEnabled(!getWebMcpPreference().enabled);
  });
  ['general', 'tokens'].forEach(function (name, index) {
    var tab = settingsEl(name === 'general' ? 'settingsTabGeneral' : 'settingsTabTokens');
    tab.addEventListener('click', function () { settingsSelectTab(name, true); });
    tab.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = 1;
      else return;
      event.preventDefault();
      event.stopPropagation();
      settingsSelectTab(next === 0 ? 'general' : 'tokens', true);
    });
  });
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
    if (dialog.hidden) return;
    var confirm = document.getElementById('confirmDialog');
    if (confirm && !confirm.hidden) return;
    if (event.key === 'Tab') {
      var controls = Array.prototype.filter.call(dialog.querySelectorAll('button, input, [tabindex]'), function (node) {
        return !node.disabled && node.tabIndex >= 0 && !node.closest('[hidden]');
      });
      var first = controls[0];
      var last = controls[controls.length - 1];
      if (first && (controls.indexOf(document.activeElement) === -1 || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
      return;
    }
    if (event.key !== 'Escape') return;
    if (settingsArmedId) { event.stopPropagation(); settingsSetArmed(''); return; }
    event.preventDefault();
    event.stopPropagation();
    settingsClose();
  }, true);
  var want = /[?&]settings=open/.exec(location.search);
  if (want) settingsOpen();
})();

register('settingsDialogOpen', settingsOpen);
register('settingsDialogClose', settingsClose);
export { settingsOpen, settingsClose, settingsPrefixLabel, settingsExpiresLabel };
