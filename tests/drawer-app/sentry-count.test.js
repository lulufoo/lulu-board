'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const landing = read('packages/drawer-app/landing/index.html');
const landingJs = read('packages/drawer-app/landing/landing.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');
const webBuild = read('scripts/web-build/build.mjs');
const helper = read('packages/drawer-app/js/00-sentry-count.js');
const drawer = read('packages/drawer-app/js/09-shell-drawer.js');
const tabs = read('packages/drawer-app/js/09-shell-tabs.js');
const chrome = read('packages/drawer-app/js/07-chrome-boot.js');
const shortcuts = read('packages/drawer-app/js/09-shortcuts.js');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');
const create = read('packages/drawer-app/js/09-create-kind-dialog.js');

assert.match(html, /sentry-config\.js/, 'home loads sentry-config');
assert.match(html, /sentry-client\.js/, 'home loads sentry-client');
assert.match(html, /https:\/\/\*\.ingest\.sentry\.io/, 'home CSP allows Sentry ingest');
assert.match(html, /https:\/\/\*\.ingest\.us\.sentry\.io/, 'home CSP allows US ingest');
assert.match(landing, /sentry-config\.js/, 'landing loads sentry-config');
assert.match(landing, /sentry-client\.js/, 'landing loads sentry-client');
assert.match(landing, /https:\/\/\*\.ingest\.sentry\.io/, 'landing CSP allows Sentry ingest');
assert.match(appBuild, /LULU_BOARD_SENTRY_DSN/, 'build reads DSN from env');
assert.match(
  appBuild,
  /if \(dsn\) Sentry\.init\(\{ dsn: dsn, defaultIntegrations: false \}\)/,
  'init disables automatic Browser integrations'
);
assert.doesNotMatch(appBuild, /browserTracingIntegration|tracesSampleRate/, 'no automatic tracing');
assert.doesNotMatch(appBuild, /ingest\.sentry\.io\/\d+/, 'DSN is not hardcoded');
assert.match(appBuild, /00-sentry-count\.js/, 'drawer bundle includes the count helper');
assert.match(webBuild, /sentry-config\.js/, 'web build ships sentry-config');
assert.match(webBuild, /sentry-client\.js/, 'web build ships sentry-client');

assert.match(helper, /canvas\.view/, 'home open counts canvas.view');
assert.match(landingJs, /landing\.view/, 'landing open counts landing.view');
assert.match(landing, /data-sentry-count="landing.start_free"/, 'nav Start free is tagged');
assert.match(landing, /data-sentry-count="landing.github"/, 'hero GitHub is tagged');
assert.match(landing, /data-sentry-count="landing.email"/, 'hero Email is tagged');
assert.doesNotMatch(landing, /Get Started[\s\S]*data-sentry-count/, 'footer Get Started is not tagged');

[
  'home.new_diagram',
  'home.tab_mine',
  'home.tab_shared',
  'home.list_open',
  'home.delete_group',
  'home.product_intro',
  'home.sign_out',
  'home.account',
  'home.sign_in',
  'home.auth_google',
  'home.auth_github',
  'canvas.drawer_toggle',
  'canvas.search',
  'canvas.search_close',
  'canvas.account',
  'canvas.dock_props',
  'canvas.dock_style',
  'canvas.dock_export',
  'canvas.shortcuts',
  'canvas.auth_google',
  'canvas.auth_github',
  'create.filter',
  'create.welcome',
  'create.sketch',
  'create.boxes',
  'create.mermaid_group',
].forEach(function (name) {
  const body = helper + drawer + tabs + chrome + shortcuts + cloud + create + landingJs;
  assert.match(body, new RegExp(name.replace('.', '\\.')), 'count site for ' + name);
});

console.log('ok sentry-count');
