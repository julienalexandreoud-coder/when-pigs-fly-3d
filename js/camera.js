// Camera: follows the pig with look-ahead and zooms out with speed and
// altitude so fast flights still show what is coming.

import { HILL, scaleAt, clamp } from './config.js';

const READY = { x: -0.5, y: HILL + 4.2, span: 23 };

export function createCamera() {
  return { x: READY.x, y: READY.y, span: READY.span, z: 20 };
}

export function snapToReady(cam, W = 16, H = 9) {
  cam.x = READY.x;
  cam.y = READY.y - (H > W ? READY.span * 0.14 : 0);
  cam.span = READY.span;
}

// View span (metres across the longer screen axis) for a flight state.
// Capped per layer so objects stay readable: fast flights feel fast instead
// of turning the sky into specks.
export function targetSpan(speed, alt) {
  const s = scaleAt(alt);
  return clamp(Math.max(30 * s, speed * 2.3), 30, 85 * s);
}

export function updateCamera(cam, W, H, dt, { mode, pig, groundAt }) {
  // Portrait phones: measure the span on a shortened long axis and look
  // further ahead so there is room to see what is coming.
  const portrait = H > W;
  const long = portrait ? Math.max(W * 1.2, H * 0.62) : Math.max(W, H * 0.75);
  let tx = READY.x;
  // Portrait: frame the launcher higher so the missions list below does not cover Pip.
  let ty = READY.y - (H > W ? (READY.span * H) / long * 0.14 : 0);
  let span = READY.span;
  if (mode !== 'ready' && pig) {
    const speed = Math.hypot(pig.vx, pig.vy);
    span = targetSpan(speed, pig.y);
    const viewW = (span * W) / long;
    const viewH = (span * H) / long;
    const look = Math.min(1, speed / 60) * (portrait ? 0.4 : 0.28);
    tx = pig.x + clamp(pig.vx * 0.5, -viewW * look, viewW * look);
    ty = pig.y + clamp(pig.vy * 0.5, -viewH * look, viewH * look);
    // Keep the ground in the lower part of the screen near the surface.
    const ground = groundAt(pig.x);
    ty = Math.max(ty, ground + viewH * 0.22);
  }
  const kz = 1 - Math.exp(-dt * 2.2);
  const kp = 1 - Math.exp(-dt * 7);
  cam.span += (span - cam.span) * kz;
  cam.x += (tx - cam.x) * kp;
  cam.y += (ty - cam.y) * kp;
  cam.z = long / cam.span;
  if (pig && mode !== 'ready') {
    // Never let the pig leave the middle 70% of the screen.
    const hw = (W / cam.z) * 0.35;
    const hh = (H / cam.z) * 0.35;
    cam.x = clamp(cam.x, pig.x - hw, pig.x + hw);
    cam.y = clamp(cam.y, pig.y - hh, pig.y + hh);
  }
  return cam;
}
