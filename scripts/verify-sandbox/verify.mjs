#!/usr/bin/env node
/**
 * Check a deployed runner against the header contract.
 *   node scripts/verify-sandbox/verify.mjs [url]     default https://sandbox.luluboard.app/
 * Exits 1 when the response is not 200, has no CSP header, or the CSP differs from headers.js.
 */
import { fileURLToPath } from 'node:url';
import { runnerCsp } from '../../packages/sandbox-app/src/headers.js';

export async function verifyRunner(url, expectedCsp = runnerCsp(), fetchFn = fetch) {
  const problems = [];
  const res = await fetchFn(url, { redirect: 'manual' });
  if (res.status !== 200) problems.push('status ' + res.status + ', expected 200');
  const csp = res.headers.get('content-security-policy');
  if (!csp) problems.push('no Content-Security-Policy response header');
  else if (csp !== expectedCsp) problems.push('CSP differs\n  got:      ' + csp + '\n  expected: ' + expectedCsp);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv[2] || 'https://sandbox.luluboard.app/';
  const problems = await verifyRunner(url);
  if (problems.length) {
    console.error('FAIL ' + url + '\n' + problems.join('\n'));
    process.exit(1);
  }
  console.log('ok ' + url);
}
