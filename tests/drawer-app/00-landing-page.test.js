'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Persist = require('../../packages/drawer-app/js/00-hash-persist.js');

const landingDir = path.join(__dirname, '../../packages/drawer-app/landing');
const BLANK = '#z:eJyrVkrKTVGyUkrKTyxKUYhRCs0rySzJSU2JUYrJU9JRKkstKs7Mz1OyMqwFACtUDgY';

// one blank board address everywhere on the page
const html = fs.readFileSync(path.join(landingDir, 'index.html'), 'utf8');
assert.match(html, /src="\.\/agent-chat\.png"/, 'first shot is the agent-chat clip');
assert.ok(fs.existsSync(path.join(landingDir, 'agent-chat.png')), 'agent-chat.png exists');
const blankLinks = html.match(/href="\/#z:[^"]+"/g) || [];
assert.ok(blankLinks.length >= 4, 'landing page links to the blank board');
for (const link of blankLinks) assert.strictEqual(link, 'href="/' + BLANK + '"');
assert.match(html, /href="https:\/\/github.com\/lulufoo\/lulu-board"/, 'GitHub opens the repo');
assert.match(html, /href="mailto:namdamlu@outlook.com"/, 'Email opens a mail to namdamlu');
assert.doesNotMatch(html, /data-open-sign-in="github"/, 'GitHub is not a sign-in button');

// CSP is script-src 'self'; style-src 'self'
assert.ok(!/<style[\s>]/i.test(html), 'no inline <style> (CSP style-src self)');
assert.ok(!/<script(?![^>]*\ssrc=)/i.test(html), 'no inline <script> (CSP script-src self)');
assert.ok(!/\sstyle=/i.test(html), 'no inline style attributes');

// the page never loads Supabase; it only reads the stored session
const script = fs.readFileSync(path.join(landingDir, 'landing.js'), 'utf8');
assert.ok(!/createClient|@supabase|supabase\.co/i.test(script), 'landing.js does not load Supabase');
assert.ok(!/supabase/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'landing page does not reference Supabase');

// the fixed blank address opens as a blank board in the workspace
Persist.decodeBoardHash(BLANK).then((decoded) => {
  assert.strictEqual(decoded.bmd, 'board "Untitled"\n');
  assert.strictEqual(decoded.version, 1);
  console.log('ok landing-page');
});
