/* Opaque Board PAT. Distinct from a user JWT: never send this string to Auth /user. */

export const PAT_PREFIX = 'lbp_';
export const PAT_TOKEN_RE = /^lbp_[0-9a-f]{64}$/;

export function isPatToken(token) {
  return PAT_TOKEN_RE.test(String(token || ''));
}
