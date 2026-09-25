// Heuristic pilot used by the balance simulator and the ?debug autoplay.

import { wrapAngle } from './config.js';
import { autopilot } from './physics.js';
import { PERFECT_FROM } from './launch.js';

const CLIMB = 1.0;

export function botInput(f, skill = 'skilled') {
  const gamma = Math.atan2(f.vy, f.vx);
  if (f.fuel > 0 && f.fuelMax > 0) {
    const target = skill === 'skilled' ? CLIMB : 0.7;
    const diff = wrapAngle(target - f.angle);
    return { pitch: Math.abs(diff) < 0.04 ? 0 : Math.sign(diff), boost: true };
  }
  if (f.vy > 0) {
    const diff = wrapAngle(gamma + (skill === 'skilled' ? 0.02 : 0.12) - f.angle);
    return { pitch: Math.abs(diff) < 0.04 ? 0 : Math.sign(diff), boost: false };
  }
  return autopilot(f);
}

// Needle value the bot "taps" at.
export function botLaunch(rng, skill = 'skilled') {
  if (skill === 'skilled') return rng() < 0.6 ? PERFECT_FROM + 0.05 : 0.6 + rng() * 0.3;
  return 0.3 + rng() * 0.68;
}
