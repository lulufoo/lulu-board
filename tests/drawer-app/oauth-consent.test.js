'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/oauth/consent/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/oauth/consent/consent.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'packages/drawer-app/oauth/consent/consent.js'), 'utf8');
const webBuild = fs.readFileSync(path.join(root, 'scripts/web-build/build.mjs'), 'utf8');
const siteWorker = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const mcpWorker = fs.readFileSync(path.join(root, 'packages/board-mcp/wrangler.toml'), 'utf8');

assert.match(html, /id="consent-signed-out"/, 'unsigned-in pane exists');
assert.match(html, /id="consent-signed-in"/, 'signed-in pane exists');
assert.match(html, /id="btn-consent-google"/, 'Google sign-in is on the page');
assert.match(html, /id="btn-consent-github"/, 'GitHub sign-in is on the page');
assert.match(html, /id="btn-consent-approve"/, 'Approve is on the page');
assert.match(html, /id="btn-consent-deny"/, 'Deny is on the page');
assert.match(html, /id="btn-consent-switch"/, 'Switch account is on the page');
assert.match(html, /Authorize Cursor/, 'page title names Cursor');
assert.match(css, /\.consent-sheet/, 'consent has its own sheet');
assert.match(js, /authorization_id/, 'script reads the authorization id');
assert.match(js, /oauth\/authorizations\//, 'script talks to Auth consent REST');
assert.match(js, /signInWithOAuth/, 'unsigned-in path uses the existing OAuth login');
assert.match(js, /signOut/, 'switch account signs out');
assert.match(js, /redirectTo: location\.href/, 'login returns to this consent URL');
assert.match(webBuild, /oauth\/consent/, 'web-build copies the consent page');
assert.doesNotMatch(js, /service_role|SERVICE_ROLE/, 'consent holds no service key');
assert.match(siteWorker, /directory = "\.\/\.cache\/web\/"/, 'static Worker still serves generated assets');
assert.doesNotMatch(siteWorker, /board-mcp|mcp\.luluboard/, 'static Worker stays off the MCP host');
assert.match(mcpWorker, /name = "lulu-board-mcp"/, 'MCP is a separate Worker');
assert.match(mcpWorker, /PUBLIC_ORIGIN = "https:\/\/mcp\.luluboard\.app"/, 'MCP origin is the hosted hostname');

console.log('ok oauth-consent');
