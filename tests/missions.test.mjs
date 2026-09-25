import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceUp, generateMission, fillMissions, settleMissions, missionText, missionDone, KINDS, SLOTS } from '../js/missions.js';
import { needleAt, launchZone, launchPower, PERFECT_FROM } from '../js/launch.js';

const ctx = (o = {}) => ({ best: { alt: 0, dist: 0, speed: 0, coins: 0 }, hasRocket: false, lastPayout: 0, ...o });

test('niceUp rounds up to two significant digits', () => {
  assert.equal(niceUp(137), 140);
  assert.equal(niceUp(1234), 1300);
  assert.equal(niceUp(40), 40);
  assert.equal(niceUp(0), 0);
});

test('missions scale with records and respect unlock conditions', () => {
  const early = ctx();
  for (let lv = 0; lv < 40; lv++) {
    const m = generateMission(lv, early, 1);
    assert.ok(!['glide', 'fuel', 'surf', 'abduct'].includes(m.kind), `${m.kind} too early`);
    assert.ok(m.target > 0 && m.reward >= 25);
    assert.ok(missionText(m).length > 5);
  }
  const late = ctx({ best: { alt: 5000, dist: 20000, speed: 300, coins: 300 }, hasRocket: true, lastPayout: 3000 });
  const alt = KINDS.alt.target(10, late);
  assert.ok(alt > 5000);
  assert.ok(generateMission(3, late, 1).reward > generateMission(3, early, 1).reward);
});

test('fillMissions keeps three distinct kinds', () => {
  const state = fillMissions({ level: 0, seed: 1, active: [] }, ctx());
  assert.equal(state.active.length, SLOTS);
  assert.equal(new Set(state.active.map((m) => m.kind)).size, SLOTS);
  assert.equal(state.level, SLOTS);
});

test('settleMissions splits completed from remaining', () => {
  const state = { level: 3, seed: 1, active: [{ kind: 'flips', target: 1, reward: 30 }, { kind: 'alt', target: 500, reward: 40 }] };
  const summary = { flips: 2, maxAlt: 100 };
  assert.equal(missionDone(state.active[0], summary), true);
  const r = settleMissions(state, summary);
  assert.deepEqual(r.done.map((m) => m.kind), ['flips']);
  assert.deepEqual(r.state.active.map((m) => m.kind), ['alt']);
});

test('launch meter: triangle needle, zones and power', () => {
  assert.equal(needleAt(0, 2), 0);
  assert.equal(needleAt(1, 2), 1);
  assert.ok(Math.abs(needleAt(0.5, 2) - 0.5) < 1e-9);
  assert.equal(launchZone(0.95), 'perfect');
  assert.equal(launchZone(PERFECT_FROM), 'perfect');
  assert.equal(launchZone(0.7), 'good');
  assert.equal(launchZone(0.1), 'weak');
  assert.equal(launchPower(1), 1);
  assert.ok(launchPower(0) >= 0.5 && launchPower(0.5) < launchPower(0.85));
});
