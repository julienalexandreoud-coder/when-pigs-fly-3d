// Pip the pig, drawn procedurally in a local frame: body radius = 1,
// nose toward +x, canvas y down. Gear (wings, rocket, helmet) follows tiers.

const INK = '#3a2230';
const LINE = 0.085;
// Pixels per body radius for the current draw call (canvas shadowBlur is in pixels).
let unit = 20;

function outline(g, fill, width = LINE) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = width;
  g.strokeStyle = INK;
  g.stroke();
}

function ellipse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

// ---------- wings ----------
function drawWings(g, tier, t, flap) {
  const lift = Math.sin(t * 9) * 0.06 * flap;
  g.save();
  g.translate(-0.1, -0.55);
  g.rotate(-0.15 + lift);
  switch (tier) {
    case 0: { // cardboard
      g.beginPath();
      g.moveTo(0.3, 0); g.lineTo(-1.5, -0.95); g.lineTo(-1.75, -0.55); g.lineTo(-0.35, 0.2); g.closePath();
      outline(g, '#c89a5e');
      g.strokeStyle = '#9b7442'; g.lineWidth = 0.05;
      g.beginPath(); g.moveTo(-0.4, -0.2); g.lineTo(-1.3, -0.72); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(-0.95, -0.62, 0.35, 0.14);
      break;
    }
    case 1: { // umbrella
      g.rotate(-0.25);
      g.beginPath();
      g.moveTo(0.5, 0); g.quadraticCurveTo(-0.55, -1.35, -1.7, -0.05); g.closePath();
      outline(g, '#ff5a7a');
      g.save(); g.clip();
      g.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(-0.6, 0.3); g.lineTo(-1.8 + i * 0.8, -1.4); g.lineTo(-1.45 + i * 0.8, -1.4); g.closePath(); g.fill();
      }
      g.restore();
      g.strokeStyle = INK; g.lineWidth = 0.07;
      g.beginPath(); g.moveTo(-0.6, -0.1); g.lineTo(-0.2, 0.45); g.stroke();
      break;
    }
    case 2: { // kite
      g.beginPath();
      g.moveTo(0.35, 0); g.lineTo(-0.7, -1.25); g.lineTo(-1.9, -0.45); g.lineTo(-0.55, 0.25); g.closePath();
      outline(g, '#35c4f0');
      g.beginPath(); g.moveTo(-0.7, -1.25); g.lineTo(-0.55, 0.25); g.lineTo(-1.9, -0.45); g.closePath();
      g.fillStyle = '#ffd23f'; g.fill(); g.stroke();
      g.strokeStyle = '#ff5a7a'; g.lineWidth = 0.05;
      g.beginPath(); g.moveTo(-1.9, -0.45); g.quadraticCurveTo(-2.3, -0.1, -2.5, -0.5); g.stroke();
      break;
    }
    case 3: { // hang glider
      g.beginPath();
      g.moveTo(0.9, -0.55); g.lineTo(-2.3, -1.2); g.lineTo(-1.7, -0.55); g.closePath();
      outline(g, '#ff8c2b');
      g.fillStyle = '#ffd08a';
      g.beginPath(); g.moveTo(0.9, -0.55); g.lineTo(-1.1, -0.95); g.lineTo(-1.7, -0.55); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 0.06;
      g.beginPath(); g.moveTo(-0.3, -0.7); g.lineTo(-0.1, 0.2); g.moveTo(-1.2, -0.75); g.lineTo(-0.5, 0.15); g.stroke();
      break;
    }
    case 4: { // biplane
      g.rotate(0.15);
      for (const [y, c] of [[-0.95, '#e63946'], [-0.2, '#c1121f']]) {
        g.beginPath();
        g.roundRect(-1.8, y, 2.2, 0.28, 0.12);
        outline(g, c);
      }
      g.strokeStyle = INK; g.lineWidth = 0.06;
      g.beginPath(); g.moveTo(-1.4, -0.67); g.lineTo(-1.4, -0.2); g.moveTo(-0.1, -0.67); g.lineTo(-0.1, -0.2); g.stroke();
      break;
    }
    case 5: { // carbon
      g.beginPath();
      g.moveTo(0.5, 0.05); g.lineTo(-1.2, -1.15); g.lineTo(-2.05, -1.1); g.lineTo(-0.6, 0.25); g.closePath();
      outline(g, '#2b2d42');
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.05;
      g.beginPath(); g.moveTo(0.1, -0.05); g.lineTo(-1.3, -1.0); g.stroke();
      g.fillStyle = '#ef233c';
      g.beginPath(); g.moveTo(-1.75, -1.12); g.lineTo(-2.05, -1.1); g.lineTo(-1.6, -0.7); g.closePath(); g.fill();
      break;
    }
    default: { // jet wings
      g.beginPath();
      g.moveTo(0.6, 0.05); g.lineTo(-1.3, -1.3); g.lineTo(-2.2, -1.25); g.lineTo(-0.7, 0.3); g.closePath();
      const grad = g.createLinearGradient(0, -1.3, 0, 0.3);
      grad.addColorStop(0, '#e9f1f7'); grad.addColorStop(1, '#8d99ae');
      outline(g, grad);
      g.fillStyle = '#39e1ff';
      g.shadowColor = '#39e1ff'; g.shadowBlur = 0.6 * unit;
      ellipse(g, -2.1, -1.24, 0.14, 0.09); g.fill();
      g.shadowBlur = 0;
    }
  }
  g.restore();
}

// ---------- rocket ----------
function drawRocket(g, tier, boosting, t) {
  if (tier <= 0) return;
  g.save();
  g.translate(-0.8, -0.22);
  const flame = boosting ? 1 + Math.sin(t * 60) * 0.15 + Math.sin(t * 37) * 0.1 : 0;
  const len = [0, 1.1, 1.25, 1.35, 1.35, 1.6, 1.6][tier];
  const rad = [0, 0.26, 0.2, 0.28, 0.34, 0.36, 0.34][tier];
  if (flame > 0) drawFlame(g, -len, rad, flame, tier);
  switch (tier) {
    case 1: { // soda bottle
      g.beginPath(); g.roundRect(-len, -rad, len * 0.8, rad * 2, rad * 0.8); outline(g, 'rgba(90,200,120,0.9)');
      g.beginPath(); g.roundRect(-len * 0.25, -rad * 0.5, len * 0.3, rad, 0.05); outline(g, '#2d9d5a');
      g.fillStyle = '#e63946'; g.fillRect(-len * 0.72, -rad * 0.95, len * 0.28, rad * 1.9);
      break;
    }
    case 2: { // firework
      g.beginPath(); g.rect(-len, -rad, len * 0.85, rad * 2); outline(g, '#d62828');
      g.beginPath(); g.moveTo(-len * 0.15, -rad); g.lineTo(0.15, 0); g.lineTo(-len * 0.15, rad); g.closePath(); outline(g, '#ffd166');
      g.fillStyle = '#ffd166';
      for (let i = 0; i < 3; i++) { ellipse(g, -len + 0.25 + i * 0.28, 0, 0.06, 0.06); g.fill(); }
      break;
    }
    case 3: { // toy rocket
      g.beginPath(); g.roundRect(-len, -rad, len, rad * 2, rad); outline(g, '#f8f9fa');
      g.fillStyle = '#e63946'; g.fillRect(-len * 0.55, -rad, len * 0.18, rad * 2);
      g.beginPath(); g.moveTo(-len, -rad); g.lineTo(-len - 0.25, -rad - 0.3); g.lineTo(-len + 0.35, -rad); g.closePath(); outline(g, '#e63946');
      g.beginPath(); g.moveTo(-len, rad); g.lineTo(-len - 0.25, rad + 0.3); g.lineTo(-len + 0.35, rad); g.closePath(); outline(g, '#e63946');
      break;
    }
    case 4: { // jet engine
      g.beginPath(); g.roundRect(-len, -rad, len, rad * 2, 0.12); outline(g, '#adb5bd');
      g.fillStyle = '#495057'; ellipse(g, -0.05, 0, 0.12, rad * 0.85); g.fill();
      g.strokeStyle = '#6c757d'; g.lineWidth = 0.04;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-len + i * 0.3, -rad); g.lineTo(-len + i * 0.3, rad); g.stroke(); }
      break;
    }
    case 5: { // space rocket
      g.beginPath(); g.roundRect(-len, -rad, len, rad * 2, 0.1); outline(g, '#ffffff');
      g.fillStyle = '#1d3557'; g.fillRect(-len * 0.7, -rad, len * 0.12, rad * 2); g.fillRect(-len * 0.45, -rad, len * 0.05, rad * 2);
      g.beginPath(); g.moveTo(-len + 0.05, -rad); g.lineTo(-len - 0.35, -rad - 0.35); g.lineTo(-len + 0.45, -rad); g.closePath(); outline(g, '#e63946');
      g.beginPath(); g.moveTo(-len + 0.05, rad); g.lineTo(-len - 0.35, rad + 0.35); g.lineTo(-len + 0.45, rad); g.closePath(); outline(g, '#e63946');
      break;
    }
    default: { // warp thruster
      g.beginPath(); g.roundRect(-len, -rad, len, rad * 2, rad); outline(g, '#5a189a');
      g.shadowColor = '#39e1ff'; g.shadowBlur = 0.5 * unit;
      g.fillStyle = '#39e1ff';
      for (let i = 0; i < 3; i++) { g.fillRect(-len + 0.25 + i * 0.4, -rad * 0.6, 0.16, rad * 1.2); }
      g.shadowBlur = 0;
    }
  }
  // strap
  g.fillStyle = '#6b4226';
  g.fillRect(-len * 0.35, -rad - 0.05, 0.14, rad * 2 + 0.1);
  g.restore();
}

function drawFlame(g, x, rad, k, tier) {
  const warp = tier >= 6;
  const soda = tier === 1;
  const L = (0.9 + tier * 0.18) * k;
  const grad = g.createLinearGradient(x, 0, x - L, 0);
  if (soda) {
    grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(210,255,230,0)');
  } else if (warp) {
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#39e1ff'); grad.addColorStop(1, 'rgba(160,60,255,0)');
  } else {
    grad.addColorStop(0, '#fff6c2'); grad.addColorStop(0.35, '#ffb703'); grad.addColorStop(0.7, '#fb5607'); grad.addColorStop(1, 'rgba(230,57,70,0)');
  }
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x, -rad * 0.9);
  g.quadraticCurveTo(x - L * 0.6, -rad * 1.4, x - L, 0);
  g.quadraticCurveTo(x - L * 0.6, rad * 1.4, x, rad * 0.9);
  g.closePath();
  g.fill();
}

// ---------- face ----------
function drawEye(g, face, skin, t) {
  const ex = 0.72;
  const ey = -0.28;
  g.lineCap = 'round';
  if (face === 'happy') {
    g.strokeStyle = INK; g.lineWidth = 0.09;
    g.beginPath(); g.arc(ex, ey + 0.06, 0.13, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    return;
  }
  if (face === 'dizzy' || face === 'splat') {
    g.strokeStyle = INK; g.lineWidth = 0.08;
    if (face === 'dizzy') {
      g.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) {
        const r = 0.02 + a * 0.012;
        const px = ex + Math.cos(a + t * 12) * r;
        const py = ey + Math.sin(a + t * 12) * r;
        if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(ex - 0.11, ey - 0.11); g.lineTo(ex + 0.11, ey + 0.11);
      g.moveTo(ex + 0.11, ey - 0.11); g.lineTo(ex - 0.11, ey + 0.11);
      g.stroke();
    }
    return;
  }
  const big = face === 'scared';
  ellipse(g, ex, ey, big ? 0.2 : 0.16, big ? 0.24 : 0.2);
  outline(g, '#ffffff', 0.06);
  g.fillStyle = skin.eye || INK;
  ellipse(g, ex + 0.05, ey + 0.01, big ? 0.07 : 0.095, big ? 0.08 : 0.12); g.fill();
  g.fillStyle = '#ffffff';
  ellipse(g, ex + 0.08, ey - 0.05, 0.035, 0.035); g.fill();
  if (face === 'determined') {
    g.strokeStyle = INK; g.lineWidth = 0.08;
    g.beginPath(); g.moveTo(ex - 0.18, ey - 0.3); g.lineTo(ex + 0.14, ey - 0.2); g.stroke();
  }
}

function drawMouth(g, face) {
  g.strokeStyle = INK; g.lineWidth = 0.07; g.lineCap = 'round';
  if (face === 'scared' || face === 'splat') {
    g.fillStyle = '#7a2238';
    ellipse(g, 0.95, 0.45, 0.1, 0.12); g.fill(); g.stroke();
  } else {
    g.beginPath(); g.arc(0.9, 0.3, 0.16, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
  }
}

function drawSnout(g, skin) {
  ellipse(g, 1.12, 0.02, 0.27, 0.33);
  outline(g, skin.snout);
  g.fillStyle = INK;
  ellipse(g, 1.1, -0.08, 0.05, 0.08); g.fill();
  ellipse(g, 1.14, 0.12, 0.05, 0.08); g.fill();
}

// ---------- helmet & skin extras ----------
function drawHelmet(g, tier) {
  if (tier <= 0) return;
  g.save();
  if (tier === 1) { // leather cap + goggles
    g.beginPath(); g.arc(0.38, -0.52, 0.56, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); outline(g, '#8d5a2b');
    ellipse(g, 0.6, -0.9, 0.13, 0.1); outline(g, '#9fd8ff', 0.05);
    ellipse(g, 0.3, -0.95, 0.13, 0.1); outline(g, '#9fd8ff', 0.05);
  } else if (tier === 2) { // racing helmet
    g.beginPath(); g.arc(0.36, -0.5, 0.66, Math.PI * 1.0, Math.PI * 1.97); g.closePath(); outline(g, '#e63946');
    g.fillStyle = '#ffffff'; g.fillRect(0.0, -1.1, 0.14, 0.58);
  } else if (tier === 3) { // bullet helmet
    g.beginPath(); g.moveTo(-0.35, -0.45); g.quadraticCurveTo(0.2, -1.3, 1.25, -0.66); g.lineTo(0.92, -0.5); g.closePath();
    const grad = g.createLinearGradient(0, -1, 0, -0.3); grad.addColorStop(0, '#f1f3f5'); grad.addColorStop(1, '#868e96');
    outline(g, grad);
  } else { // nose cone
    g.beginPath(); g.moveTo(0.35, -0.95); g.quadraticCurveTo(1.6, -0.6, 1.75, 0.05); g.quadraticCurveTo(1.6, 0.55, 0.45, 0.75); g.closePath();
    g.globalAlpha = 0.5; outline(g, '#bde0fe'); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    ellipse(g, 1.05, -0.55, 0.22, 0.07, 0.4); g.fill();
  }
  g.restore();
}

function drawSkinExtras(g, skin, t) {
  if (skin.spots) {
    g.fillStyle = skin.spots;
    ellipse(g, -0.45, -0.3, 0.26, 0.2, 0.3); g.fill();
    ellipse(g, 0.05, 0.35, 0.18, 0.14); g.fill();
    ellipse(g, -0.75, 0.3, 0.14, 0.11); g.fill();
  }
  if (skin.mohawk) {
    g.fillStyle = skin.mohawk;
    for (let i = 0; i < 5; i++) {
      g.beginPath(); g.moveTo(-0.6 + i * 0.3, -0.85 + Math.abs(i - 2) * 0.05); g.lineTo(-0.45 + i * 0.3, -1.25); g.lineTo(-0.3 + i * 0.3, -0.85); g.fill();
    }
  }
  if (skin.antenna) {
    g.strokeStyle = INK; g.lineWidth = 0.06;
    g.beginPath(); g.moveTo(0.3, -0.9); g.lineTo(0.2, -1.45); g.stroke();
    g.fillStyle = Math.sin(t * 6) > 0 ? '#ff4d6d' : '#39e1ff';
    ellipse(g, 0.2, -1.5, 0.1, 0.1); outline(g, g.fillStyle, 0.05);
  }
  if (skin.horn) {
    g.beginPath(); g.moveTo(0.55, -0.85); g.lineTo(0.95, -1.6); g.lineTo(0.8, -0.8); g.closePath(); outline(g, '#ffd6f5');
    const mane = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    mane.forEach((c, i) => { g.fillStyle = c; ellipse(g, 0.1 - i * 0.22, -0.88 + i * 0.05, 0.15, 0.1, -0.4); g.fill(); });
  }
}

function drawTusks(g) {
  g.fillStyle = '#fffbea';
  g.beginPath(); g.moveTo(0.9, 0.32); g.quadraticCurveTo(1.05, 0.1, 1.15, 0.05); g.lineTo(1.0, 0.36); g.closePath();
  outline(g, '#fffbea', 0.05);
}

function drawBubble(g) {
  ellipse(g, 0.6, -0.1, 0.95, 0.9);
  g.fillStyle = 'rgba(200,235,255,0.22)'; g.fill();
  g.lineWidth = 0.07; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  ellipse(g, 0.95, -0.55, 0.2, 0.08, 0.6); g.fill();
}

// ---------- the whole pig ----------
// opts: { skin, tiers, face, boosting, t, squash, flap, unit (px per body radius) }
export function drawPig(g, opts) {
  const { skin, tiers = {}, face = 'normal', boosting = false, t = 0, squash = 0, flap = 1 } = opts;
  unit = opts.unit || 20;
  g.save();
  g.scale(1 + squash, 1 - squash);
  g.lineJoin = 'round';
  if (skin.glow) {
    g.shadowColor = 'rgba(255,220,80,0.9)';
    g.shadowBlur = 0.9 * unit;
  }
  drawRocket(g, tiers.rocket || 0, boosting, t);
  // tail
  g.strokeStyle = INK; g.lineWidth = 0.09; g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < Math.PI * 3; a += 0.25) {
    const r = 0.08 + a * 0.03;
    const px = -1.2 - r + Math.cos(a) * r * 0.2 - a * 0.04;
    const py = -0.1 + Math.sin(a + t * 4) * r;
    if (a === 0) g.moveTo(-1.08, -0.1); else g.lineTo(px, py);
  }
  g.stroke();
  // back legs
  const kick = Math.sin(t * 14) * 0.08;
  for (const [lx, k] of [[-0.55, kick], [0.45, -kick]]) {
    g.beginPath(); g.roundRect(lx - 0.13 + k, 0.55, 0.26, 0.5, 0.1); outline(g, skin.shade);
    g.fillStyle = '#5a3a2e'; g.fillRect(lx - 0.13 + k, 0.93, 0.26, 0.12);
  }
  // body
  ellipse(g, 0, 0, 1.18, 0.96);
  const grad = g.createRadialGradient(-0.2, -0.45, 0.1, 0, 0, 1.3);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, skin.body);
  grad.addColorStop(1, skin.shade);
  outline(g, grad);
  g.shadowBlur = 0;
  drawSkinExtras(g, skin, t);
  // ear
  g.beginPath(); g.moveTo(0.3, -0.72); g.quadraticCurveTo(0.35, -1.3, 0.8, -1.05); g.quadraticCurveTo(0.75, -0.8, 0.62, -0.62); g.closePath();
  outline(g, skin.ear);
  // cheek
  g.fillStyle = 'rgba(255,90,120,0.35)';
  ellipse(g, 0.72, 0.15, 0.16, 0.1); g.fill();
  drawSnout(g, skin);
  if (skin.tusks) drawTusks(g);
  drawEye(g, face, skin, t);
  drawMouth(g, face);
  if ((tiers.wings ?? 0) >= 0) drawWings(g, tiers.wings || 0, t, flap);
  drawHelmet(g, tiers.helmet || 0);
  if (skin.bubble) drawBubble(g);
  g.restore();
}

// Small canvas icon of the pig (shop cards, records).
export function pigIcon(canvas, skin, tiers, face = 'happy') {
  const g = canvas.getContext('2d');
  const s = Math.min(canvas.width, canvas.height) / 5.2;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.save();
  g.translate(canvas.width * 0.55, canvas.height * 0.58);
  g.scale(s, s);
  drawPig(g, { skin, tiers, face, t: 0.3, unit: s });
  g.restore();
}
