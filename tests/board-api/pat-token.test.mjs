import assert from 'node:assert/strict';
import { isPatToken, PAT_PREFIX, PAT_TOKEN_RE } from '../../packages/board-api/src/pat-token.js';

assert.equal(PAT_PREFIX, 'lbp_');
assert.equal(isPatToken('lbp_' + 'ab'.repeat(32)), true);
assert.equal(isPatToken('lbp_' + 'AB'.repeat(32)), false);
assert.equal(isPatToken('lbp_' + 'a'.repeat(63)), false);
assert.equal(isPatToken('lbp_' + 'a'.repeat(65)), false);
assert.equal(isPatToken(''), false);
assert.equal(isPatToken(null), false);
assert.equal(isPatToken('header.' + Buffer.from('{}').toString('base64url') + '.sig'), false);
assert.equal(PAT_TOKEN_RE.test('lbp_' + '0'.repeat(64)), true);

console.log('ok pat token');
