// In-flight surprises: every few seconds a "coin rush" arc or a lucky gift box
// appears right on the pig's predicted path, so there is always something
// coming up to steer for.

import { scaleAt } from './config.js';
import { GIFTS } from './collide.js';

export const RUSH_EVERY = 5;
const FIRST_RUSH = 2;
const LOOK = 1.4;
const ARC_COINS = 9;
const MIN_SPEED = 10;

function ahead(f, world, t) {
  const s = scaleAt(f.y);
  const x = f.x + f.vx * t + 6 * s;
  const y = f.y + f.vy * t - 4.9 * t * t;
  return { x, y: Math.max(y, world.terrain.height(x) + 4 * s), s };
}

// Call once per frame during a flight; returns the kind spawned or null.
export function updateRush(f, world, dt, rand = Math.random) {
  if (f.done || f.grounded || f.abduct || Math.hypot(f.vx, f.vy) < MIN_SPEED) return null;
  f.rushT += dt;
  if (f.rushT < (f.rushN === 0 ? FIRST_RUSH : RUSH_EVERY)) return null;
  f.rushT = 0;
  f.rushN += 1;
  const id = (k) => `rush:${f.rushN}:${k}`;
  if (f.rushN % 2 === 1) {
    for (let k = 0; k < ARC_COINS; k++) {
      const p = ahead(f, world, LOOK + k * 0.12);
      world.spawn({ id: id(k), type: 'coin', x: p.x, y: p.y + Math.sin((k / (ARC_COINS - 1)) * Math.PI) * 2.5 * p.s, r: 0.6 * p.s, value: Math.max(1, Math.round(p.s)), star: false });
    }
    return 'coins';
  }
  const p = ahead(f, world, LOOK + 0.3);
  world.spawn({ id: id('gift'), type: 'gift', x: p.x, y: p.y + 2 * p.s, r: 1.2 * p.s, reward: GIFTS[Math.floor(rand() * GIFTS.length)] });
  return 'gift';
}
