import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP } from '../js/config.js';
import { createWorld } from '../js/world.js';
import { createFlight, stepFlight, autopilot, simulateToEnd } from '../js/physics.js';
import { comboFor, COMBO_GAP } from '../js/collide.js';
import { computeStats } from '../js/upgrades.js';
import { createCoach, landingCue, timeToImpact } from '../js/coach.js';
import { trickCoins } from '../js/economy.js';

function fly(policy, seed = 7, stats = computeStats({})) {
  const world = createWorld(seed);
  const f = createFlight(stats, { power: 1 });
  for (let i = 0; i < 120 * 600 && !f.done; i++) {
    stepFlight(f, policy(f, world), STEP, world);
    f.events.length = 0;
  }
  return f;
}

// Taps just before every touchdown, like a good player.
function flarePilot(f, world) {
  const a = autopilot(f);
  const tti = timeToImpact(f, world.terrain.height);
  const fresh = f.t - f.pressT > 0.5;
  return { ...a, pressed: fresh && (tti < 0.2 || f.grounded) };
}

test('tapping before touchdown bounces the pig and flies farther', () => {
  const glide = fly((f) => autopilot(f));
  const flare = fly(flarePilot);
  assert.equal(glide.flares, 0);
  assert.ok(flare.flares >= 2, `flares ${flare.flares}`);
  assert.ok(flare.distance > glide.distance * 1.5, `${flare.distance} vs ${glide.distance}`);
});

test('flares always lose some speed, so a flight still ends', () => {
  const f = fly(flarePilot, 3, computeStats({ launcher: 6, wings: 5 }));
  assert.equal(f.done, true);
  assert.ok(f.t < 120, `t ${f.t}`);
});

test('holding a tap for long does not flare (only fresh presses count)', () => {
  let first = true;
  const f = fly((fl) => {
    const p = first;
    first = false;
    return { ...autopilot(fl), pressed: p };
  });
  assert.equal(f.flares, 0);
});

test('the skip autopilot never flares', () => {
  const world = createWorld(7);
  const f = createFlight(computeStats({ launcher: 3 }), { power: 1 });
  for (let i = 0; i < 240; i++) stepFlight(f, { pitch: 0, boost: false }, STEP, world);
  simulateToEnd(f, world);
  assert.equal(f.flares, 0);
});

test('a flip gives a forward kick', () => {
  const world = createWorld(7);
  const f = createFlight(computeStats({ launcher: 4 }), { power: 1 });
  let before = 0;
  let after = 0;
  for (let i = 0; i < 120 * 30 && !f.done && f.flips === 0; i++) {
    before = Math.hypot(f.vx, f.vy);
    stepFlight(f, { pitch: 1, boost: false }, STEP, world);
    after = Math.hypot(f.vx, f.vy);
  }
  assert.equal(f.flips, 1);
  assert.ok(after > before + 3, `${before} -> ${after}`);
});

test('coin combo multiplier grows with the chain and caps at 3x', () => {
  assert.equal(comboFor(1), 1);
  assert.equal(comboFor(6), 1.5);
  assert.equal(comboFor(12), 2);
  assert.equal(comboFor(100), 3);
  assert.ok(COMBO_GAP > 0.5);
});

test('flares pay trick coins', () => {
  const base = { flips: 0, surfs: 0, balloons: 0, chainBonus: 0, abductions: 0, perfect: false, bounces: 0 };
  assert.equal(trickCoins({ ...base, flares: 3 }) > trickCoins(base), true);
  assert.equal(trickCoins(base), 0);
});

test('landing cue turns on near the ground and says "now" inside the flare window', () => {
  const ground = () => 0;
  const falling = { vx: 10, vy: -10, y: 0.9 + 3, x: 0, done: false, grounded: false, abduct: null };
  const cue = landingCue(falling, ground);
  assert.equal(cue.now, true);
  assert.equal(landingCue({ ...falling, y: 0.9 + 50 }, ground), null);
  assert.equal(landingCue({ ...falling, vy: 5 }, ground), null);
  assert.equal(landingCue({ ...falling, grounded: true, vx: 12 }, ground).hop, true);
});

function fakeUi() {
  const calls = [];
  return { calls, coach: (title) => calls.push(title) };
}

test('coach slows time until the player holds, then teaches letting go', () => {
  const ui = fakeUi();
  const coach = createCoach(ui);
  coach.start(['launch'], true);
  const f = { t: 2, vx: 15, vy: 2, y: 30, x: 10, grounded: false, abduct: null, done: false };
  const ground = () => 0;
  let r = coach.update(f, {}, false, 1 / 60, ground);
  assert.ok(r.scale < 0.2);
  assert.equal(ui.calls.at(-1), 'HOLD TO FLY UP');
  r = coach.update(f, {}, true, 1 / 60, ground);
  assert.equal(r.scale, 1);
  coach.update(f, {}, false, 1 / 60, ground);
  let done = [];
  for (let i = 0; i < 120 && !done.length; i++) done = coach.update(f, {}, false, 1 / 60, ground).done;
  assert.deepEqual(done, ['hold']);
  assert.equal(coach.active, false);
});

test('coach asks for a tap right before landing and marks the tip on tap', () => {
  const ui = fakeUi();
  const coach = createCoach(ui);
  coach.start(['launch', 'hold'], false);
  const f = { t: 3, vx: 12, vy: -12, y: 0.9 + 2, x: 10, grounded: false, abduct: null, done: false };
  const r = coach.update(f, {}, false, 1 / 60, () => 0);
  assert.ok(r.scale < 0.1);
  assert.equal(ui.calls.at(-1), 'TAP NOW!');
  const r2 = coach.update(f, { pressed: true }, true, 1 / 60, () => 0);
  assert.deepEqual(r2.done, ['flare']);
});
