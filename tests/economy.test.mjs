import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, SKINS, computeStats, glideRatio, statText, maxLevel } from '../js/upgrades.js';
import { payout, distanceCoins, newMedals, nextMedal, shopOptions, affordableCount, nextGoal, MEDALS } from '../js/economy.js';
import { DEFAULT_SAVE, update } from '../js/save.js';
import { MOON_ALT } from '../js/config.js';

const summary = (o = {}) => ({
  distance: 0, maxAlt: 0, topSpeed: 0, coins: 0, flips: 0, balloons: 0, chainBonus: 0, surfs: 0, abductions: 0,
  bounces: 0, glideDist: 0, fuelCans: 0, perfect: false, moon: false, ...o,
});

test('every upgrade line has one cost per level step and rising costs', () => {
  for (const u of UPGRADES) {
    assert.equal(u.costs.length, maxLevel(u), u.id);
    for (let i = 1; i < u.costs.length; i++) assert.ok(u.costs[i] > u.costs[i - 1], `${u.id} costs rise`);
  }
});

test('every upgrade level improves its stat', () => {
  const stat = { launcher: 'launchSpeed', rocket: 'thrust', tank: 'fuel', belly: 'restitution', magnet: 'magnet', bank: 'payMult' };
  for (const u of UPGRADES) {
    for (let lv = 1; lv <= maxLevel(u); lv++) {
      const ups = { rocket: 1, [u.id]: lv };
      const prev = computeStats({ rocket: 1, [u.id]: lv - 1 });
      const cur = computeStats(ups);
      if (u.id === 'wings') assert.ok(glideRatio(cur) > glideRatio(prev), `wings ${lv}`);
      else if (u.id === 'helmet') assert.ok(cur.cdBody < prev.cdBody, `helmet ${lv}`);
      else if (u.id === 'rocket') assert.ok(cur.thrust > prev.thrust || lv === 1, `rocket ${lv}`);
      else assert.ok(cur[stat[u.id]] > prev[stat[u.id]], `${u.id} ${lv}`);
      assert.ok(statText(u.id, lv).length > 0);
    }
  }
});

test('payout adds up the lines and applies the Piggy Bank multiplier', () => {
  const s = summary({ distance: 500, maxAlt: 100, topSpeed: 20, coins: 12, flips: 2, perfect: true });
  const p = payout(s, 1);
  assert.equal(p.subtotal, p.lines.reduce((a, l) => a + l.amount, 0));
  assert.equal(p.total, p.subtotal);
  assert.equal(p.lines.find((l) => l.id === 'distance').amount, 50);
  assert.equal(p.lines.find((l) => l.id === 'altitude').amount, 25);
  assert.equal(p.lines.find((l) => l.id === 'tricks').amount, 2 * 8 + 5);
  assert.equal(payout(s, 1.5).total, Math.round(p.subtotal * 1.5));
});

test('long glides pay less per metre past 2 km', () => {
  assert.equal(distanceCoins(1000), 100);
  assert.equal(distanceCoins(2000), 200);
  assert.equal(distanceCoins(6000), 300);
});

test('medals are awarded once and the Moon medal needs the Moon', () => {
  const got = newMedals(summary({ maxAlt: 1200, distance: 600, topSpeed: 50 }), []);
  assert.deepEqual(got.map((m) => m.id).sort(), ['a100', 'a1k', 'a500', 'd500', 's150'].sort());
  assert.equal(newMedals(summary({ maxAlt: 1200 }), got.map((m) => m.id)).length, 0);
  assert.ok(newMedals(summary({ maxAlt: MOON_ALT, moon: true }), []).some((m) => m.id === 'moon'));
  assert.equal(nextMedal(['a100'], 'alt').id, 'a500');
  assert.equal(MEDALS.filter((m) => m.id === 'moon').length, 1);
});

test('shop options, badge count and next goal follow the wallet', () => {
  const poor = DEFAULT_SAVE;
  assert.equal(affordableCount(poor), 0);
  assert.ok(!shopOptions(poor).some((o) => o.id === 'tank'), 'fuel tank locked without a rocket');
  const rich = update(DEFAULT_SAVE, { coins: 50 });
  assert.ok(affordableCount(rich) >= 3);
  const goal = nextGoal(rich);
  assert.ok(goal.cost > 50);
  assert.ok(SKINS.some((s) => s.cost === null), 'golden pig is not for sale');
});
