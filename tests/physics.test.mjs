import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP, MOON_ALT, LAUNCH_POS } from '../js/config.js';
import { createWorld } from '../js/world.js';
import { createFlight, stepFlight, simulateToEnd, summarize, canSkip, rebound, autopilot } from '../js/physics.js';
import { computeStats } from '../js/upgrades.js';

const idle = { pitch: 0, boost: false };

function fly(stats, input = () => idle, opts = { power: 1 }, seed = 7) {
  const world = createWorld(seed);
  const f = createFlight(stats, opts);
  for (let i = 0; i < 120 * 600 && !f.done; i++) {
    stepFlight(f, input(f), STEP, world);
    f.events.length = 0;
  }
  return f;
}

test('a default flight lands, ends and reports sane numbers', () => {
  const f = fly(computeStats({}));
  assert.equal(f.done, true);
  assert.ok(['landed', 'mud', 'splash'].includes(f.cause));
  const s = summarize(f);
  assert.ok(s.distance > 20 && s.distance < 400, `distance ${s.distance}`);
  assert.ok(s.maxAlt >= LAUNCH_POS.y && s.maxAlt < 80, `alt ${s.maxAlt}`);
  for (const v of Object.values(s)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
});

test('better wings glide farther from the same launch', () => {
  const low = fly(computeStats({ launcher: 3, wings: 0 }), autopilot);
  const high = fly(computeStats({ launcher: 3, wings: 6 }), autopilot);
  assert.ok(high.distance > low.distance * 1.3, `${high.distance} vs ${low.distance}`);
});

test('boosting burns fuel and climbs higher than not boosting', () => {
  const stats = computeStats({ rocket: 3, tank: 3, launcher: 3 });
  const noBoost = fly(stats);
  const boost = fly(stats, (f) => ({ pitch: f.angle < 1 ? 1 : 0, boost: true }));
  assert.equal(boost.fuel, 0);
  assert.ok(boost.maxAlt > noBoost.maxAlt * 2, `${boost.maxAlt} vs ${noBoost.maxAlt}`);
});

test('no NaN even with extreme inputs', () => {
  const stats = computeStats({ launcher: 7, wings: 6, rocket: 6, tank: 7, helmet: 4 });
  let flip = 1;
  const f = fly(stats, (fl) => {
    if (Math.floor(fl.t * 3) % 2 === 0) flip = -flip;
    return { pitch: flip, boost: true };
  });
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.vx) && Number.isFinite(f.vy));
});

test('holding nose-up spins the pig and counts flips', () => {
  const f = fly(computeStats({ launcher: 4 }), () => ({ pitch: 1, boost: false }));
  assert.ok(f.flips >= 1, `flips ${f.flips}`);
});

test('max gear with a steady climb reaches the Moon', () => {
  const stats = computeStats({ launcher: 7, wings: 6, rocket: 6, tank: 7, helmet: 4, magnet: 5 });
  let reached = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const f = fly(stats, (fl) => {
      const target = fl.fuel > 0 ? 1.1 : Math.atan2(fl.vy, fl.vx);
      const d = target - fl.angle;
      return { pitch: Math.abs(d) < 0.04 ? 0 : Math.sign(d), boost: fl.fuel > 0 };
    }, { power: 1, perfect: true }, seed * 101);
    if (f.moon) reached += 1;
  }
  assert.ok(reached >= 3, `reached ${reached}/6`);
  const f = fly(stats, () => ({ pitch: 0, boost: true }), { power: 1 }, 3);
  assert.ok(f.maxAlt <= MOON_ALT);
});

test('skip simulates the rest of the flight to a landing', () => {
  const stats = computeStats({ launcher: 5, wings: 4, rocket: 2, tank: 2 });
  const world = createWorld(11);
  const f = createFlight(stats, { power: 1 });
  let guard = 0;
  while (!canSkip(f) && !f.done && guard++ < 20000) stepFlight(f, { pitch: 0, boost: true }, STEP, world);
  assert.ok(canSkip(f), 'skip should become available after the burn');
  simulateToEnd(f, world);
  assert.equal(f.done, true);
  assert.ok(f.distance > 100);
});

test('second wind relaunches a finished flight', () => {
  const world = createWorld(3);
  const f = fly(computeStats({ launcher: 2 }));
  const before = f.distance;
  rebound(f, world);
  assert.equal(f.done, false);
  assert.ok(f.vy > 0);
  for (let i = 0; i < 120 * 120 && !f.done; i++) stepFlight(f, idle, STEP, world);
  assert.ok(f.distance > before);
  assert.equal(f.rebounded, true);
});

test('coins are collected while sliding along the ground', () => {
  const world = createWorld(7);
  const f = createFlight(computeStats({}), { power: 1 });
  const x = 60;
  const coin = { id: 'ground-coin', type: 'coin', x, y: world.terrain.height(x) + 1.6, r: 0.55, value: 1, star: false };
  const groundWorld = { ...world, query: (x0, y0, x1, y1, out = []) => { world.query(x0, y0, x1, y1, out); out.push(coin); return out; } };
  f.x = x - 6;
  f.y = world.terrain.height(f.x) + 0.9;
  f.vx = 12;
  f.vy = 0;
  f.grounded = true;
  for (let i = 0; i < 240 && !f.done && f.x < x + 2; i++) stepFlight(f, idle, STEP, groundWorld);
  assert.ok(f.taken.has('ground-coin'), 'sliding pig should pick up the coin it passes through');
});
