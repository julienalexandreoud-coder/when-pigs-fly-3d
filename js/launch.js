// The swinging power needle on the launch screen.

export const PERFECT_FROM = 0.9;
export const GOOD_FROM = 0.5;

// Needle position 0..1 as a triangle wave (constant speed, fair timing).
export function needleAt(t, period) {
  const p = ((t % period) + period) % period / period;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

export function meterPeriod(flights) {
  return flights < 2 ? 1.9 : 1.4;
}

export function launchZone(v) {
  if (v >= PERFECT_FROM) return 'perfect';
  if (v >= GOOD_FROM) return 'good';
  return 'weak';
}

// Launch power multiplier for a needle value. PERFECT adds its bonus in physics.
export function launchPower(v) {
  const x = Math.max(0, Math.min(1, v));
  if (x >= PERFECT_FROM) return 1;
  return 0.55 + 0.4 * (x / PERFECT_FROM);
}
