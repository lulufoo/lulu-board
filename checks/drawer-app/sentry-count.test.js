import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const landing = read('packages/site/landing/index.html');
const landingJs = read('packages/site/landing/landing.js');
const appBuild = read('scripts/build-app/drawer.mjs');
const webBuild = read('scripts/build-web/build.mjs');
const helper = read('packages/drawer-app/src/core/sentry-count.js');
const entry = read('packages/drawer-app/src/index.js');
const hooks = read('packages/drawer-app/src/core/hooks.js');
const drawer = read('packages/drawer-app/src/chrome/shell-drawer.js');
const tabs = read('packages/drawer-app/src/chrome/shell-tabs.js');
const chrome = read('packages/drawer-app/src/chrome/chrome-boot.js');
const shortcuts = read('packages/drawer-app/src/chrome/shortcuts.js');
const cloud = read('packages/drawer-app/src/cloud/cloud-sync.js');
const create = read('packages/drawer-app/src/chrome/create-kind-dialog.js');

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
  /if \(dsn\) Sentry\.init\(\{ dsn: dsn, defaultIntegrations: false, tracesSampleRate: 1 \}\)/,
  'init keeps automatic Browser integrations off and samples manual spans'
);
assert.doesNotMatch(appBuild, /browserTracingIntegration/, 'no automatic browser tracing');
assert.doesNotMatch(appBuild, /ingest\.sentry\.io\/\d+/, 'DSN is not hardcoded');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/main.js')), 'drawer build reads the src entry');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/core/sentry-count.js')), 'drawer bundle includes the count helper');
assert.match(entry, /import \{ sentryCount \} from '\.\/core\/sentry-count\.js'/, 'entry imports the helper');
assert.match(entry, /import \{ register, emit, call \} from '\.\/core\/hooks\.js'/, 'entry imports hook points');
assert.match(entry, /from '\.\/core\/style-line\.js'/, 'entry still owns style-line');
assert.match(hooks, /export function register/, 'hooks expose register');
assert.match(hooks, /export function emit/, 'hooks expose emit');
assert.match(hooks, /export function call/, 'hooks expose call');
assert.doesNotMatch(appBuild, /00-sentry-count\.js/, 'old helper is no longer a leftover file');
assert.match(webBuild, /sentry-config\.js/, 'web build ships sentry-config');
assert.match(webBuild, /sentry-client\.js/, 'web build ships sentry-client');

assert.match(helper, /diagram\.fetch\.id/, 'diagram fetch records our own id');
assert.match(helper, /name: "diagram\.fetch"/, 'diagram fetch is one span');
assert.doesNotMatch(helper, /spanContext/, 'diagram fetch does not read the Sentry trace id');
assert.match(cloud, /recordDiagramFetch\(/, 'owned graph fetch records the span');
assert.match(cloud, /crypto\.randomUUID\(\)/, 'owned graph fetch mints the id before the request');
assert.doesNotMatch(cloud, /spanContext/, 'owned graph fetch does not read the Sentry trace id');
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
