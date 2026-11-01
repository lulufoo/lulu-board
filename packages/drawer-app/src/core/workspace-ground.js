/* Workspace ground: the locked paper canvas.
 * The canvas CSS reads it through custom properties (applyGround); PNG export paints it (paintGround). */
const STEP = 24;
const DOT_RADIUS = 1;
const PAPER = { background: '#fff', dot: '#dfe7ea' };

export function resolveGround() {
  return { background: PAPER.background, dot: PAPER.dot, dotRadius: DOT_RADIUS, step: STEP };
}

function buildGroundImage(ground) {
  const half = ground.step / 2;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + ground.step + "' height='" + ground.step + "'>"
    + "<circle cx='" + half + "' cy='" + half + "' r='" + ground.dotRadius + "' fill='" + ground.dot + "'/></svg>";
  return 'url("data:image/svg+xml;utf8,' + svg.replace(/#/g, '%23') + '")';
}

export function applyGround(root) {
  const ground = resolveGround();
  root.style.setProperty('--ground-bg', ground.background);
  root.style.setProperty('--ground-image', buildGroundImage(ground));
  root.style.setProperty('--ground-size', ground.step + 'px ' + ground.step + 'px');
}

/* Dots sit at each cell's center, like the SVG tile. Edge pixels stay half transparent. */
export function paintGround(ctx, canvas, surfaceSize) {
  const ground = resolveGround();
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
  resolveGround: resolveGround,
  applyGround: applyGround,
  paintGround: paintGround,
};

export default DrawerWorkspaceGround;
