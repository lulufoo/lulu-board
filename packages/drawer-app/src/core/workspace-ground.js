/* Workspace ground: the one spec for the canvas background.
 * The canvas CSS reads it through custom properties (applyGround); PNG export paints it (paintGround).
 * Preset ids come from the style token; this file owns the colors. */
import { resolveBackground } from '../../../board-core/style-token.js';

const STEP = 24;
const DOT_RADIUS = 1;

const GROUNDS = [
  { id: 'paper', name: 'Paper', background: '#fff', dot: '#dfe7ea' },
  { id: 'mist', name: 'Mist', background: '#d6e8f2', dot: '#b9ccd6' },
  { id: 'sage', name: 'Sage', background: '#b4ccc3', dot: '#98b1a8' },
  { id: 'dusk', name: 'Dusk', background: '#bbc7dc', dot: '#9facc1' },
];

export function listGrounds() {
  return GROUNDS.map((ground) => ({ ...ground }));
}

export function resolveGround(id) {
  const resolved = resolveBackground(id);
  const found = GROUNDS.find((ground) => ground.id === resolved);
  return { background: found.background, dot: found.dot, dotRadius: DOT_RADIUS, step: STEP };
}

function buildGroundImage(ground) {
  const half = ground.step / 2;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + ground.step + "' height='" + ground.step + "'>"
    + "<circle cx='" + half + "' cy='" + half + "' r='" + ground.dotRadius + "' fill='" + ground.dot + "'/></svg>";
  return 'url("data:image/svg+xml;utf8,' + svg.replace(/#/g, '%23') + '")';
}

export function applyGround(root, id) {
  const ground = resolveGround(id);
  root.style.setProperty('--ground-bg', ground.background);
  root.style.setProperty('--ground-image', buildGroundImage(ground));
  root.style.setProperty('--ground-size', ground.step + 'px ' + ground.step + 'px');
}

/* Dots sit at each cell's center, like the SVG tile. Edge pixels stay half transparent. */
export function paintGround(ctx, canvas, surfaceSize, id) {
  const ground = resolveGround(id);
  const pixelRatio = canvas.width / surfaceSize.width;
  const step = ground.step * pixelRatio;
  const radius = ground.dotRadius * pixelRatio;

  ctx.fillStyle = ground.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ground.dot;
  ctx.beginPath();
  for (let y = step / 2; y < canvas.height + radius; y += step) {
    for (let x = step / 2; x < canvas.width + radius; x += step) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

const DrawerWorkspaceGround = {
  listGrounds: listGrounds,
  resolveGround: resolveGround,
  applyGround: applyGround,
  paintGround: paintGround,
};

export default DrawerWorkspaceGround;
