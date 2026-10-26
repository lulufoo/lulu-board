import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
/* Corridor rail seeds: far boxes outside the link hull must not contribute rails. */
const W = require('../../../../packages/boxes/engine/route/world');
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const memory = { id: 'MEMORY', left: 147, right: 1275, top: 923, bottom: 1061 };
const risk = { id: 'RISK', left: 592, right: 878, top: 181, bottom: 335 };
const review = { id: 'REVIEW', left: 335, right: 1149, top: 383, bottom: 700 };
const authorNarrow = { id: 'AUTHOR', left: 308, right: 559, top: 12, bottom: 124 };
const authorWide = { id: 'AUTHOR', left: 666, right: 1548, top: 12, bottom: 124 };

const portPoints = [{ x: 711, y: 923 }, { x: 735, y: 335 }];
const corridor = W.linkCorridor(portPoints);
assert(!W.boundsOverlap(authorNarrow, corridor), 'narrow AUTHOR outside corridor');
assert(!W.boundsOverlap(authorWide, corridor), 'wide AUTHOR outside corridor');

const seedsWide = W.railSeedObstacles([memory, risk, review, authorWide], corridor);
assert(seedsWide.every((r) => r.id !== 'AUTHOR'), 'AUTHOR not a rail seed');
assert(seedsWide.some((r) => r.id === 'REVIEW'), 'REVIEW still seeds');

const xsNarrow = W.foldRailCoordinates(portPoints, [memory, risk, review, authorNarrow], 'x');
const xsWide = W.foldRailCoordinates(portPoints, [memory, risk, review, authorWide], 'x');
assert(JSON.stringify(xsNarrow) === JSON.stringify(xsWide), 'rail xs unchanged when AUTHOR slides right');
assert(!xsWide.some((x) => Math.abs(x - (authorWide.right + W.ROUTE_GAP)) < 1e-6), 'AUTHOR right+GAP not seeded');
assert(!xsWide.some((x) => Math.abs(x - authorWide.right) < 1e-6), 'AUTHOR right flush not seeded');

console.log('corridor-rails.test.js ok', { seedIds: seedsWide.map((r) => r.id), nXs: xsWide.length });
