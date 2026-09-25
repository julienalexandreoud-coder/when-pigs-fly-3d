// Shared constants: physics, sky layers and the Moon goal.

export const STEP = 1 / 120;
export const G0 = 9.81;
export const RHO_SCALE = 2500;
export const MOON_ALT = 10000;
export const LAUNCH_ANGLE = (38 * Math.PI) / 180;
export const HILL = 24;
export const LAUNCH_POS = Object.freeze({ x: 0, y: HILL + 3 });
export const PIG_R = 0.9;
export const END_SPEED = 1.5;
export const TURN_RATE = 3.0;
export const WEATHERVANE = 2.2;
export const MAX_SPEED = 2500;
export const MAX_LIFT = 80;
export const PERFECT_BONUS = 1.12;
export const MAX_FLIGHT_TIME = 600;

// `scale` grows object sizes, spacing and pickup reach with altitude, so
// fast, zoomed-out flights still read well and still meet things.
export const LAYERS = Object.freeze([
  { id: 'farm', name: 'The Farm', from: 0, to: 100, cell: 70, scale: 1, top: '#7cc8ff', bottom: '#dff4ff' },
  { id: 'sky', name: 'Blue Sky', from: 100, to: 500, cell: 110, scale: 1.5, top: '#4aa8f5', bottom: '#b9e4ff' },
  { id: 'clouds', name: 'Cloud Kingdom', from: 500, to: 1500, cell: 170, scale: 2.2, top: '#5a8ff0', bottom: '#e6d8ff' },
  { id: 'jet', name: 'Jet Lane', from: 1500, to: 3500, cell: 250, scale: 3.2, top: '#2c5fc9', bottom: '#86b6f2' },
  { id: 'strato', name: 'Stratosphere', from: 3500, to: 6500, cell: 340, scale: 4.4, top: '#101f55', bottom: '#3b5cae' },
  { id: 'space', name: 'Outer Space', from: 6500, to: MOON_ALT, cell: 450, scale: 5.8, top: '#02030a', bottom: '#0a0f2c' },
]);

// Continuous version of the layer scale, used for the pig itself.
const SCALE_POINTS = [[0, 1], [100, 1], [500, 1.5], [1500, 2.2], [3500, 3.2], [6500, 4.4], [MOON_ALT, 5.8]];
export function scaleAt(h) {
  if (h <= 0) return 1;
  for (let i = 1; i < SCALE_POINTS.length; i++) {
    const [h1, s1] = SCALE_POINTS[i];
    if (h <= h1) {
      const [h0, s0] = SCALE_POINTS[i - 1];
      return s0 + ((s1 - s0) * (h - h0)) / (h1 - h0);
    }
  }
  return SCALE_POINTS[SCALE_POINTS.length - 1][1];
}

export function layerIndexAt(h) {
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    if (h >= LAYERS[i].from) return i;
  }
  return 0;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export const densityAt = (h) => Math.exp(-Math.max(0, h) / RHO_SCALE);
export const gravityAt = (h) => G0 * (1 - 0.55 * clamp((h - 2000) / (MOON_ALT - 2000), 0, 1));

// Wraps an angle to [-PI, PI].
export function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  else if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function formatDistance(m) {
  if (m >= 10000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.floor(m)} m`;
}

export const kmh = (ms) => Math.round(ms * 3.6);
export const formatInt = (n) => Math.floor(n).toLocaleString('en-US');
