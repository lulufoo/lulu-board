import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const { roundedRhombusPath, rhombusHalfDiagonals } = require('../../../../packages/boxes/box/diamond.js');

// Walk the real path (M/L/Q only) and return the extremes of the drawn curve.
function extremes(d) {
  const nums = (s) => s.trim().split(/\s+/).map(Number);
  const tokens = d.match(/[MLQ][^MLQZ]*/g) || [];
  let cur = null;
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  const hit = (x, y) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  tokens.forEach((tok) => {
    const kind = tok[0];
    const v = nums(tok.slice(1));
    if (kind === 'M' || kind === 'L') {
      cur = [v[0], v[1]];
      hit(cur[0], cur[1]);
    } else if (kind === 'Q') {
      const [cx, cy, ex, ey] = v;
      for (let i = 0; i <= 64; i += 1) {
        const t = i / 64;
        const u = 1 - t;
        hit(u * u * cur[0] + 2 * u * t * cx + t * t * ex, u * u * cur[1] + 2 * u * t * cy + t * t * ey);
      }
      cur = [ex, ey];
    }
  });
  return { minX, maxX, minY, maxY };
}

// The drawn tips must touch the W x H box that link routes attach to.
[[96, 69], [112, 80], [140, 60], [200, 143], [96, 96]].forEach(([W, H]) => {
  const r = Math.min(6, Math.min(W, H) / 6);
  const base = rhombusHalfDiagonals(W, H, r);
  const box = extremes(roundedRhombusPath(W / 2, H / 2, base.a, base.b, r));
  const tol = 0.05;
  assert.ok(Math.abs(box.minX - 0) < tol, `${W}x${H} left tip ${box.minX}`);
  assert.ok(Math.abs(box.maxX - W) < tol, `${W}x${H} right tip ${box.maxX}`);
  assert.ok(Math.abs(box.minY - 0) < tol, `${W}x${H} top tip ${box.minY}`);
  assert.ok(Math.abs(box.maxY - H) < tol, `${W}x${H} bottom tip ${box.maxY}`);
});

console.log('ok diamond-tips');
