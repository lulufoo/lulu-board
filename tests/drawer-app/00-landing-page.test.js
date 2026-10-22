'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Persist = require('../../packages/drawer-app/js/00-hash-persist.js');

const landingDir = path.join(__dirname, '../../packages/drawer-app/landing');
const BLANK = '#z:eJyrVkrKTVGyUkrKTyxKUYhRCs0rySzJSU2JUYrJU9JRKkstKs7Mz1OyMqwFACtUDgY';
const WS = '/?ws=1';

const html = fs.readFileSync(path.join(landingDir, 'index.html'), 'utf8');
assert.match(html, /src="\.\/agent-chat\.webp"/, 'first shot is the agent-chat clip');
assert.ok(fs.existsSync(path.join(landingDir, 'agent-chat.webp')), 'agent-chat.webp exists');

// LB-358: Start free / Get Started / Open a blank board → /?ws=1
const wsLinks = html.match(/href="\/\?ws=1"/g) || [];
assert.strictEqual(wsLinks.length, 3, 'three workspace CTAs point to /?ws=1');
assert.doesNotMatch(html, /href=["']\/start\/?["'#?]/, 'LB-357: landing has no /start product links');
assert.match(html, /href="\/\?ws=1"><span class="only-out">Start free</);
assert.match(html, /href="\/\?ws=1"><span class="only-out">Get Started</);
assert.match(html, /href="\/\?ws=1">Open a blank diagram</);

// Sign in keeps blank #z (LB-356 / landing sign-in handoff); not a product CTA
const blankLinks = html.match(/href="\/#z:[^"]+"/g) || [];
assert.strictEqual(blankLinks.length, 1, 'only Sign in still uses blank #z');
assert.strictEqual(blankLinks[0], 'href="/' + BLANK + '"');
assert.match(html, /href="\/#z:[^"]+" data-open-sign-in="menu">Sign in</);

assert.match(html, /href="https:\/\/github.com\/lulufoo\/lulu-board"/, 'GitHub opens the repo');
assert.match(html, /href="mailto:namdamlu@outlook.com"/, 'Email opens a mail to namdamlu');
assert.doesNotMatch(html, /data-open-sign-in="github"/, 'GitHub is not a sign-in button');
const heroCta = html.slice(html.indexOf('class="cta-row"'), html.indexOf('class="shot"'));
assert.match(heroCta, />GitHub</, 'signed-in hero still has GitHub');
assert.match(heroCta, />Email</, 'signed-in hero still has Email');
assert.doesNotMatch(heroCta, /Open workspace/, 'hero does not swap in Open workspace');

// CSP is script-src 'self'; style-src 'self'
assert.ok(!/<style[\s>]/i.test(html), 'no inline <style> (CSP style-src self)');
assert.ok(!/<script(?![^>]*\ssrc=)/i.test(html), 'no inline <script> (CSP script-src self)');
assert.ok(!/\sstyle=/i.test(html), 'no inline style attributes');

// the page never loads Supabase; it only reads the stored session
const script = fs.readFileSync(path.join(landingDir, 'landing.js'), 'utf8');
assert.ok(!/createClient|@supabase|supabase\.co/i.test(script), 'landing.js does not load Supabase');
assert.ok(!/supabase/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'landing page does not reference Supabase');

// signed-in mark: a small circle with the email initial, status dot, full address as tooltip; no text label beside the button
assert.match(html, /id="authAvatar"/, 'mark has an avatar initial');
assert.ok(!/auth-dot|auth-text|authStatusNote/.test(html) && !/Signed in · /.test(script), 'old pill, dot and text label are gone');
assert.match(script, /status\.title = label/, 'full address is the tooltip');
assert.match(script, /avatar\.textContent = \(email \|\| "\?"\)\.charAt\(0\)\.toUpperCase\(\)/, 'avatar shows the email initial');
const baseCss = fs.readFileSync(path.join(landingDir, 'landing-base.css'), 'utf8');
assert.match(baseCss, /\.auth-status \{[^}]*width: 40px;[^}]*height: 40px;[^}]*border-radius: 50%;/, 'the mark is a 40px circle');
const mobileHero = baseCss.slice(baseCss.indexOf('.hero {'), baseCss.indexOf('@media (min-width: 601px)'));
assert.doesNotMatch(mobileHero, /^\s*(?:block-size|min-height|height):/m, 'LB-386: mobile hero is content-driven');
assert.match(baseCss, /@media \(min-width: 768px\) \{\s*\.hero \{[^}]*block-size: 100vh;[^}]*block-size: 100dvh;/, 'LB-386: wide hero is exactly one viewport tall');

// Sign-in blank address still opens as a blank board in the workspace
Persist.decodeBoardHash(BLANK).then((decoded) => {
  assert.strictEqual(decoded.bmd, 'board "Untitled"\n');
  assert.strictEqual(decoded.version, 1);
  console.log('ok landing-page');
});
