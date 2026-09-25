// Shop icons drawn with the same art as the game.

import { drawPig } from './pig.js';
import { drawLauncher } from './farm.js';
import { skinById } from '../upgrades.js';

const INK = '#3a2230';

function frame(canvas) {
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return g;
}

function pigAt(g, x, y, s, tiers, skin, face = 'happy', extra = {}) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  drawPig(g, { skin, tiers, face, t: 0.35, unit: s, ...extra });
  g.restore();
}

function magnet(g, W) {
  g.save();
  g.translate(W / 2, W / 2 + 6);
  g.lineWidth = W * 0.2;
  g.strokeStyle = INK;
  g.beginPath(); g.arc(0, 0, W * 0.24, Math.PI, 0); g.stroke();
  g.lineWidth = W * 0.14;
  g.strokeStyle = '#e63946';
  g.beginPath(); g.arc(0, 0, W * 0.24, Math.PI, 0); g.stroke();
  g.fillStyle = '#dee2e6';
  g.strokeStyle = INK; g.lineWidth = 3;
  for (const s of [-1, 1]) { g.beginPath(); g.rect(s * W * 0.24 - W * 0.08, 0, W * 0.16, W * 0.16); g.fill(); g.stroke(); }
  g.restore();
}

function tank(g, W) {
  g.save();
  g.translate(W / 2, W / 2);
  const r = W * 0.3;
  g.fillStyle = '#e63946'; g.strokeStyle = INK; g.lineWidth = 4;
  g.beginPath(); g.roundRect(-r * 0.75, -r * 0.8, r * 1.5, r * 1.75, r * 0.2); g.fill(); g.stroke();
  g.fillStyle = '#adb5bd';
  g.beginPath(); g.roundRect(-r * 0.3, -r * 1.15, r * 0.6, r * 0.4, 4); g.fill(); g.stroke();
  g.fillStyle = '#ffd166';
  g.beginPath(); g.moveTo(r * 0.1, -r * 0.5); g.lineTo(-r * 0.3, r * 0.15); g.lineTo(0, r * 0.15); g.lineTo(-r * 0.12, r * 0.65); g.lineTo(r * 0.32, 0); g.lineTo(0, 0); g.closePath(); g.fill();
  g.restore();
}

function spring(g, W) {
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i <= 12; i++) g.lineTo(W / 2 + (i % 2 ? 14 : -14), W * 0.92 - i * 3.2);
  g.stroke();
  g.restore();
  pigAt(g, W / 2, W * 0.4, W * 0.2, { wings: -1 }, skinById('pink'), 'happy', { squash: 0.12 });
}

function bank(g, W) {
  pigAt(g, W * 0.5, W * 0.62, W * 0.26, { wings: -1 }, skinById('golden'), 'happy');
  g.fillStyle = '#ffc233'; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.ellipse(W * 0.5, W * 0.2, W * 0.12, W * 0.12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
}

// Draws the icon for an upgrade at `level` (the level it would become).
export function upgradeIcon(canvas, id, level, tiers) {
  const g = frame(canvas);
  const W = canvas.width;
  const skin = skinById('pink');
  switch (id) {
    case 'launcher':
      g.save();
      g.translate(W * 0.55, W * 0.95);
      g.scale(W / 7.5, W / 7.5);
      drawLauncher(g, level, 0.2, 0.3, (px, py) => pigAt(g, px, py, 0.9, { wings: tiers.wings }, skin, 'determined'));
      g.restore();
      break;
    case 'wings': pigAt(g, W * 0.58, W * 0.64, W * 0.22, { wings: level }, skin); break;
    case 'rocket': pigAt(g, W * 0.64, W * 0.56, W * 0.2, { rocket: level, wings: -1 }, skin, 'determined', { boosting: level > 0 }); break;
    case 'helmet': pigAt(g, W * 0.42, W * 0.62, W * 0.28, { helmet: level, wings: -1 }, skin); break;
    case 'tank': tank(g, W); break;
    case 'belly': spring(g, W); break;
    case 'magnet': magnet(g, W); break;
    default: bank(g, W);
  }
}

export function skinIcon(canvas, skin, tiers) {
  const g = frame(canvas);
  pigAt(g, canvas.width * 0.52, canvas.height * 0.58, canvas.height * 0.24, tiers, skin, 'happy');
}
