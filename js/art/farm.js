// Launchers, the farmer, the barn and ground props. Local frames are in
// metres with canvas y down; the origin is the object's ground point.

import { LAUNCH_ANGLE } from '../config.js';

const INK = '#3a2230';
const DIR_X = Math.cos(LAUNCH_ANGLE);
const DIR_Y = -Math.sin(LAUNCH_ANGLE);

function stroke(g, w, c = INK) {
  g.lineWidth = w;
  g.strokeStyle = c;
  g.stroke();
}

function fillStroke(g, fill, w = 0.12) {
  g.fillStyle = fill;
  g.fill();
  stroke(g, w);
}

// Pig centre relative to the launcher origin (launch position minus ground).
export const PIG_SEAT = { x: 0, y: -3 };

// ---------- launchers ----------
function slingshot(g, big, pull) {
  const s = big ? 1.25 : 1;
  const wood = big ? '#6f4a2c' : '#9c6b3f';
  g.lineCap = 'round';
  const px = PIG_SEAT.x - DIR_X * pull * 1.4;
  const py = PIG_SEAT.y - DIR_Y * pull * 1.4;
  // back fork arm + band
  g.beginPath(); g.moveTo(0, -1.6 * s); g.lineTo(-0.9 * s, -3.6 * s); stroke(g, 0.42 * s, INK);
  g.beginPath(); g.moveTo(0, -1.6 * s); g.lineTo(-0.9 * s, -3.6 * s); stroke(g, 0.3 * s, wood);
  g.beginPath(); g.moveTo(-0.9 * s, -3.6 * s); g.lineTo(px - 0.6, py); stroke(g, 0.16 * s, big ? '#222' : '#c0392b');
  // trunk
  g.beginPath(); g.moveTo(0, 0.2); g.lineTo(0, -1.8 * s); stroke(g, 0.5 * s, INK);
  g.beginPath(); g.moveTo(0, 0.2); g.lineTo(0, -1.8 * s); stroke(g, 0.38 * s, wood);
  return { px, py, front: () => {
    g.beginPath(); g.moveTo(0, -1.6 * s); g.lineTo(0.9 * s, -3.6 * s); stroke(g, 0.42 * s, INK);
    g.beginPath(); g.moveTo(0, -1.6 * s); g.lineTo(0.9 * s, -3.6 * s); stroke(g, 0.3 * s, wood);
    g.beginPath(); g.moveTo(0.9 * s, -3.6 * s); g.lineTo(px - 0.6, py + 0.2); stroke(g, 0.16 * s, big ? '#222' : '#c0392b');
    if (big) { g.beginPath(); g.arc(0, -1.2, 0.35, 0, Math.PI * 2); fillStroke(g, '#333', 0.08); }
  } };
}

function catapult(g, pull) {
  g.beginPath(); g.roundRect(-2.2, -1.1, 4, 0.8, 0.15); fillStroke(g, '#8d5a2b');
  for (const wx of [-1.6, 1.2]) { g.beginPath(); g.arc(wx, -0.3, 0.45, 0, Math.PI * 2); fillStroke(g, '#5c3b1e'); }
  g.beginPath(); g.moveTo(-1.5, -1.1); g.lineTo(-0.4, -2.6); g.lineTo(0.7, -1.1); stroke(g, 0.25, '#6f4a2c');
  g.save(); g.translate(-0.4, -2.4); g.rotate(-0.2 + pull * 0.9);
  g.beginPath(); g.roundRect(-0.15, -0.15, 2.6, 0.3, 0.1); fillStroke(g, '#a47148', 0.1);
  g.restore();
  return {
    px: PIG_SEAT.x - pull * 1.2,
    py: PIG_SEAT.y + pull * 0.6,
    front: () => { g.beginPath(); g.arc(-0.4, -2.4, 0.2, 0, Math.PI * 2); fillStroke(g, '#333', 0.06); },
  };
}

function barrel(g, { color, trim, len = 3.6, rad = 0.85, base, glow }) {
  base(g);
  g.save();
  g.translate(PIG_SEAT.x, PIG_SEAT.y);
  g.rotate(-LAUNCH_ANGLE);
  g.beginPath(); g.roundRect(-len, -rad, len + 0.1, rad * 2, 0.25); fillStroke(g, color);
  g.fillStyle = trim;
  for (let i = 1; i < 3; i++) g.fillRect(-len + i * (len / 3) - 0.12, -rad, 0.24, rad * 2);
  g.beginPath(); g.roundRect(-0.25, -rad - 0.15, 0.45, rad * 2 + 0.3, 0.12); fillStroke(g, trim);
  if (glow) {
    g.fillStyle = glow;
    for (let i = 0; i < 4; i++) g.fillRect(-len + 0.4 + i * 0.75, -rad * 0.35, 0.35, rad * 0.7);
  }
  g.restore();
}

function wheels(g, xs, r, fill = '#5c3b1e', hub = '#ffd166') {
  for (const wx of xs) {
    g.beginPath(); g.arc(wx, -r, r, 0, Math.PI * 2); fillStroke(g, fill);
    g.beginPath(); g.arc(wx, -r, r * 0.3, 0, Math.PI * 2); fillStroke(g, hub, 0.08);
  }
}

export function drawLauncher(g, tier, pull, t, pigDraw) {
  g.save();
  g.lineJoin = 'round';
  if (tier <= 1) {
    const s = slingshot(g, tier === 1, pull);
    pigDraw(s.px, s.py);
    s.front();
  } else if (tier === 2) {
    const s = catapult(g, pull);
    pigDraw(s.px, s.py);
    s.front();
  } else {
    const shake = pull > 0.95 ? Math.sin(t * 90) * 0.05 : 0;
    g.translate(shake, 0);
    pigDraw(PIG_SEAT.x + DIR_X * 0.3, PIG_SEAT.y + DIR_Y * 0.3);
    const specs = {
      3: { color: '#b07d48', trim: '#6f4a2c', base: (c) => { c.beginPath(); c.roundRect(-2.4, -1.5, 3.2, 1.5, 0.5); fillStroke(c, '#f2c14e'); c.strokeStyle = '#d9a431'; c.lineWidth = 0.08; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-2.2 + i * 0.8, -1.4); c.lineTo(-1.9 + i * 0.8, -0.1); c.stroke(); } } },
      4: { color: '#e63946', trim: '#ffd166', base: (c) => { c.beginPath(); c.roundRect(-2.6, -1.3, 3.2, 0.6, 0.2); fillStroke(c, '#1d3557'); wheels(c, [-2, 0.1], 0.75, '#1d3557'); } },
      5: { color: '#2d6a4f', trim: '#95d5b2', len: 3.2, base: (c) => { c.beginPath(); c.roundRect(-3.2, -2.4, 3.6, 1.6, 0.3); fillStroke(c, '#40916c'); c.beginPath(); c.roundRect(-2.8, -3.6, 1.4, 1.3, 0.2); fillStroke(c, '#b7e4c7'); wheels(c, [-2.6], 1.0, '#222', '#ffd166'); wheels(c, [0.1], 0.6, '#222', '#ffd166'); } },
      6: { color: '#c9a227', trim: '#8a6d1d', len: 3.8, base: (c) => { c.beginPath(); c.roundRect(-3, -1.4, 3.6, 1.4, 0.3); fillStroke(c, '#6c584c'); c.beginPath(); c.roundRect(-2.6, -2.8, 0.5, 1.5, 0.2); fillStroke(c, '#adb5bd'); c.fillStyle = `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 5)})`; c.beginPath(); c.arc(-2.35, -3.2 - (t % 1), 0.4 + (t % 1) * 0.4, 0, Math.PI * 2); c.fill(); } },
      7: { color: '#343a40', trim: '#adb5bd', len: 4.4, rad: 0.7, glow: `rgba(57,225,255,${0.6 + 0.4 * Math.sin(t * 8)})`, base: (c) => { c.beginPath(); c.moveTo(-3.2, 0); c.lineTo(-2.4, -1.6); c.lineTo(0.6, -1.6); c.lineTo(1.2, 0); c.closePath(); fillStroke(c, '#495057'); } },
    };
    barrel(g, specs[Math.min(7, tier)]);
  }
  g.restore();
}

// ---------- farm props ----------
export function drawFarmer(g, t, cheer) {
  g.save();
  const jump = cheer > 0 ? Math.abs(Math.sin(t * 10)) * 0.5 * cheer : 0;
  g.translate(0, -jump);
  g.lineCap = 'round';
  // legs
  g.beginPath(); g.moveTo(-0.25, 0); g.lineTo(-0.2, -1.1); g.moveTo(0.25, 0); g.lineTo(0.2, -1.1); stroke(g, 0.28, '#1d3557');
  // body (overalls)
  g.beginPath(); g.roundRect(-0.45, -2.3, 0.9, 1.35, 0.3); fillStroke(g, '#457b9d');
  g.beginPath(); g.roundRect(-0.45, -2.3, 0.9, 0.55, 0.2); fillStroke(g, '#e63946', 0.08);
  // arms: one holds a pitchfork, the other waves when cheering
  const wave = cheer > 0 ? Math.sin(t * 14) * 0.6 : 0;
  g.beginPath(); g.moveTo(0.4, -2.1); g.lineTo(0.9 + wave * 0.3, -2.8 - Math.abs(wave) * 0.4); stroke(g, 0.22, '#f4a261');
  g.beginPath(); g.moveTo(-0.4, -2.1); g.lineTo(-0.85, -1.5); stroke(g, 0.22, '#f4a261');
  g.beginPath(); g.moveTo(-0.95, -0.2); g.lineTo(-0.8, -3.3); stroke(g, 0.1, '#6f4a2c');
  g.beginPath(); g.moveTo(-1.05, -3.3); g.lineTo(-1.05, -3.8); g.moveTo(-0.8, -3.3); g.lineTo(-0.8, -3.85); g.moveTo(-0.55, -3.3); g.lineTo(-0.55, -3.8); g.moveTo(-1.05, -3.3); g.lineTo(-0.55, -3.3); stroke(g, 0.07, '#adb5bd');
  // head + straw hat
  g.beginPath(); g.arc(0, -2.7, 0.38, 0, Math.PI * 2); fillStroke(g, '#f4a261', 0.08);
  g.fillStyle = '#6d4c41'; g.fillRect(-0.2, -2.55, 0.4, 0.12);
  g.beginPath(); g.ellipse(0, -3.02, 0.75, 0.14, 0, 0, Math.PI * 2); fillStroke(g, '#f2c14e', 0.07);
  g.beginPath(); g.roundRect(-0.35, -3.4, 0.7, 0.42, 0.12); fillStroke(g, '#f2c14e', 0.07);
  if (cheer < 0) { // jaw drop
    g.fillStyle = INK; g.beginPath(); g.ellipse(0.12, -2.55, 0.1, 0.14, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function drawBarn(g) {
  g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, -5); g.lineTo(0, -8.5); g.lineTo(5, -5); g.lineTo(5, 0); g.closePath();
  fillStroke(g, '#c1121f', 0.18);
  g.beginPath(); g.moveTo(-5.6, -4.7); g.lineTo(0, -9); g.lineTo(5.6, -4.7); stroke(g, 0.45, '#f1faee');
  g.beginPath(); g.rect(-2, -4, 4, 4); fillStroke(g, '#9d0208', 0.14);
  g.beginPath(); g.moveTo(-2, -4); g.lineTo(2, 0); g.moveTo(2, -4); g.lineTo(-2, 0); stroke(g, 0.2, '#f1faee');
  g.beginPath(); g.rect(-1, -7, 2, 1.4); fillStroke(g, '#ffe8a3', 0.1);
}

export function drawTree(g, s) {
  g.save(); g.scale(s, s);
  g.beginPath(); g.roundRect(-0.35, -3, 0.7, 3, 0.2); fillStroke(g, '#7f5539', 0.12);
  for (const [x, y, r] of [[-1.1, -3.6, 1.3], [1.1, -3.8, 1.3], [0, -4.9, 1.6]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); fillStroke(g, '#52b788', 0.12);
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.arc(-0.5, -5.3, 0.6, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function drawBush(g, s) {
  g.save(); g.scale(s, s);
  for (const [x, r] of [[-0.8, 0.8], [0.8, 0.75], [0, 1.05]]) {
    g.beginPath(); g.arc(x, -r * 0.8, r, 0, Math.PI * 2); fillStroke(g, '#40916c', 0.1);
  }
  g.fillStyle = '#ff4d6d';
  for (const [x, y] of [[-0.6, -1.1], [0.4, -1.5], [0.9, -0.8]]) { g.beginPath(); g.arc(x, y, 0.12, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

export function drawFence(g, s) {
  g.save(); g.scale(s, s);
  g.fillStyle = '#e9c46a'; g.strokeStyle = INK; g.lineWidth = 0.08;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(-2.2 + i * 1.4, -1.7, 0.3, 1.7, 0.08); g.fill(); g.stroke(); }
  for (const y of [-1.35, -0.7]) { g.beginPath(); g.roundRect(-2.4, y, 4.8, 0.22, 0.06); g.fill(); g.stroke(); }
  g.restore();
}

export function drawHaystack(g, r) {
  g.beginPath(); g.ellipse(0, -r * 0.6, r * 1.1, r * 0.75, 0, Math.PI, 0); g.lineTo(r * 1.1, 0); g.lineTo(-r * 1.1, 0); g.closePath();
  fillStroke(g, '#f2c14e', 0.12);
  g.strokeStyle = '#d4a017'; g.lineWidth = 0.08;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * r * 0.3, -r * 1.1 + Math.abs(i) * 0.2); g.lineTo(i * r * 0.36, -0.1); g.stroke(); }
}

export function drawTrampoline(g, w, bounce) {
  const d = bounce * 0.5;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(-w / 2 + 0.3, 0); g.lineTo(-w / 2 + 0.5, -1.2); g.moveTo(w / 2 - 0.3, 0); g.lineTo(w / 2 - 0.5, -1.2); stroke(g, 0.2, '#495057');
  g.beginPath(); g.moveTo(-w / 2, -1.3); g.quadraticCurveTo(0, -1.3 + d * 2, w / 2, -1.3); stroke(g, 0.32, '#222');
  g.beginPath(); g.moveTo(-w / 2, -1.3); g.lineTo(w / 2, -1.3); stroke(g, 0.12, '#3a86ff');
}

export function drawSign(g) {
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -2.6); stroke(g, 0.22, '#7f5539');
  g.beginPath(); g.moveTo(-1.4, -3.4); g.lineTo(1.2, -3.4); g.lineTo(1.7, -2.9); g.lineTo(1.2, -2.4); g.lineTo(-1.4, -2.4); g.closePath();
  fillStroke(g, '#f1faee', 0.1);
  g.save();
  g.scale(0.05, 0.05);
  g.fillStyle = INK;
  g.font = 'bold 12px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MOON ↗', 1, -57.6);
  g.restore();
}
