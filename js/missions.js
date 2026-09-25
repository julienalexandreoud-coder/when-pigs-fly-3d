// Three active single-flight missions, scaled to the player's records.

import { formatDistance, kmh } from './config.js';
import { mulberry32, hash } from './rng.js';

export const SLOTS = 3;

// Rounds up to 2 significant digits: 137 -> 140, 1234 -> 1300.
export function niceUp(n) {
  if (!(n > 0)) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.ceil(n / step) * step;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const KINDS = Object.freeze({
  alt: {
    text: (t) => `Reach ${formatDistance(t)} altitude`,
    value: (s) => s.maxAlt,
    target: (lv, c) => niceUp(Math.max(40, c.best.alt * 1.15 + 25)),
  },
  dist: {
    text: (t) => `Fly ${formatDistance(t)} far`,
    value: (s) => s.distance,
    target: (lv, c) => niceUp(Math.max(80, c.best.dist * 1.15 + 30)),
  },
  speed: {
    text: (t) => `Hit ${t} km/h`,
    value: (s) => kmh(s.topSpeed),
    target: (lv, c) => niceUp(Math.max(70, c.best.speed * 3.6 * 1.1 + 10)),
  },
  flips: {
    text: (t) => (t === 1 ? 'Do a flip in the air' : `Do ${t} flips in one flight`),
    value: (s) => s.flips,
    target: (lv) => Math.min(1 + Math.floor(lv / 4), 8),
  },
  balloons: {
    text: (t) => `Pop ${plural(t, 'balloon')} in one flight`,
    value: (s) => s.balloons,
    target: (lv) => Math.min(1 + Math.floor(lv / 3), 12),
    when: (c) => c.best.alt >= 25,
  },
  coins: {
    text: (t) => `Grab ${t} coins in one flight`,
    value: (s) => s.coins,
    target: (lv, c) => niceUp(Math.max(10, c.best.coins * 1.1 + 5)),
  },
  perfect: {
    text: () => 'Nail a PERFECT launch',
    value: (s) => (s.perfect ? 1 : 0),
    target: () => 1,
  },
  bounces: {
    text: (t) => `Bounce ${plural(t, 'time')} in one flight`,
    value: (s) => s.bounces,
    target: (lv) => Math.min(2 + Math.floor(lv / 4), 10),
  },
  glide: {
    text: (t) => `Glide ${formatDistance(t)} without boosting`,
    value: (s) => s.glideDist,
    target: (lv, c) => niceUp(Math.max(100, c.best.dist * 0.6)),
    when: (c) => c.hasRocket,
  },
  fuel: {
    text: (t) => `Grab ${plural(t, 'fuel can')} in one flight`,
    value: (s) => s.fuelCans,
    target: (lv) => Math.min(1 + Math.floor(lv / 6), 5),
    when: (c) => c.hasRocket && c.best.alt >= 100,
  },
  surf: {
    text: () => 'Surf on an airplane',
    value: (s) => s.surfs,
    target: () => 1,
    when: (c) => c.best.alt >= 1500,
  },
  abduct: {
    text: () => 'Get abducted by a UFO',
    value: (s) => s.abductions,
    target: () => 1,
    when: (c) => c.best.alt >= 3500,
  },
});

export const missionText = (m) => KINDS[m.kind].text(m.target);
export const missionValue = (m, summary) => KINDS[m.kind].value(summary);
export const missionDone = (m, summary) => missionValue(m, summary) >= m.target;

export function missionReward(level, lastPayout) {
  const raw = 20 + level * 4 + 0.45 * Math.max(0, lastPayout);
  return Math.max(25, Math.min(6000, Math.round(raw / 5) * 5));
}

// ctx: { best: {alt, dist, speed, coins}, hasRocket, lastPayout }
export function generateMission(level, ctx, seed, excludeKinds = []) {
  const rng = mulberry32(hash(seed, level, 991));
  const eligible = Object.keys(KINDS).filter((k) => !excludeKinds.includes(k) && (!KINDS[k].when || KINDS[k].when(ctx)));
  const pool = eligible.length ? eligible : Object.keys(KINDS).filter((k) => !KINDS[k].when);
  const kind = pool[Math.floor(rng() * pool.length) % pool.length];
  return Object.freeze({
    kind,
    target: KINDS[kind].target(level, ctx),
    reward: missionReward(level, ctx.lastPayout),
  });
}

// Fills empty slots so there are always SLOTS missions with distinct kinds.
export function fillMissions(state, ctx) {
  let { level } = state;
  const active = [...state.active];
  while (active.length < SLOTS) {
    active.push(generateMission(level, ctx, state.seed, active.map((m) => m.kind)));
    level += 1;
  }
  return Object.freeze({ level, seed: state.seed, active: Object.freeze(active) });
}

// Splits missions into completed / remaining for a finished flight.
export function settleMissions(state, summary) {
  const done = state.active.filter((m) => missionDone(m, summary));
  const remaining = state.active.filter((m) => !missionDone(m, summary));
  return { done, state: Object.freeze({ ...state, active: Object.freeze(remaining) }) };
}
