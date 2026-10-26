#!/usr/bin/env node
/**
 * Site pages: landing, OAuth consent, brand marks.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const webDir = path.join(repo, '.cache/web');

for (const name of ['favicon.svg', 'favicon-32.png', 'favicon.ico']) {
  const src = path.join(repo, 'packages/brand', name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(webDir, name));
  console.log('ok ' + name);
}

const consentSrc = path.join(repo, 'packages/site/oauth/consent');
const consentOut = path.join(webDir, 'oauth/consent');
mkdirSync(consentOut, { recursive: true });
for (const name of ['index.html', 'consent.css', 'consent.js']) {
  const src = path.join(consentSrc, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(consentOut, name));
  console.log('ok .cache/web/oauth/consent/' + name);
}

const landingSrc = path.join(repo, 'packages/site/landing');
const landingOut = path.join(webDir, 'landing');
mkdirSync(landingOut, { recursive: true });
mkdirSync(path.join(landingOut, 'fonts'), { recursive: true });
for (const name of [
  'index.html', 'landing-base.css', 'landing-sections.css', 'landing.js', 'hero-art.webp',
  'agent-chat.webp', 'board-shot.webp',
  'fonts/instrument-serif-latin-400-normal.woff2', 'fonts/inter-latin-wght-normal.woff2',
  'fonts/OFL-instrument-serif.txt', 'fonts/OFL-inter.txt',
]) {
  const src = path.join(landingSrc, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(landingOut, name));
  console.log('ok .cache/web/landing/' + name);
}
