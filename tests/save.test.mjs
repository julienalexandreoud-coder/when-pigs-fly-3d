import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SAVE, sanitize, update, buyUpgrade, buySkin, recordFlight, addCoins, markTip, createStorage, SAVE_KEY,
} from '../js/save.js';
import { MOON_ALT } from '../js/config.js';
import { UPGRADES } from '../js/upgrades.js';

const summary = (o = {}) => ({
  distance: 100, maxAlt: 40, topSpeed: 20, coins: 10, flips: 0, balloons: 0, chainBonus: 0, surfs: 0, abductions: 0,
  bounces: 1, glideDist: 80, fuelCans: 0, perfect: false, moon: false, ...o,
});

test('sanitize rejects garbage and clamps values', () => {
  for (const bad of [null, 42, 'x', [], { coins: -5 }, { coins: 'lots' }, { upgrades: { launcher: 999 } }]) {
    const s = sanitize(bad);
    assert.ok(s.coins >= 0 && Number.isFinite(s.coins));
    assert.ok(s.upgrades.launcher <= 7);
    assert.equal(s.missions.active.length, 3);
  }
  const s = sanitize({ owned: ['pink', 'golden', 'nope'], skin: 'golden', moon: false, medals: ['a100', 'fake'] });
  assert.deepEqual([...s.owned], ['pink']);
  assert.equal(s.skin, 'pink');
  assert.deepEqual([...s.medals], ['a100']);
});

test('valid data survives a round trip', () => {
  let s = update(DEFAULT_SAVE, { coins: 500, skin: 'pink' });
  s = buyUpgrade(s, 'launcher').save;
  const again = sanitize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(again, s);
});

test('updates are immutable', () => {
  const s = update(DEFAULT_SAVE, { coins: 100 });
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.upgrades) && Object.isFrozen(s.best));
  const next = addCoins(s, 50);
  assert.equal(s.coins, 100);
  assert.equal(next.coins, 150);
  assert.throws(() => { 'use strict'; s.coins = 1; });
});

test('buying upgrades checks money, locks and max level', () => {
  const s = update(DEFAULT_SAVE, { coins: 60 });
  assert.equal(buyUpgrade(s, 'tank').reason, 'locked');
  assert.equal(buyUpgrade(DEFAULT_SAVE, 'launcher').reason, 'poor');
  assert.equal(buyUpgrade(s, 'nope').reason, 'unknown');
  const r = buyUpgrade(s, 'launcher');
  assert.ok(r.ok);
  assert.equal(r.save.upgrades.launcher, 1);
  assert.equal(r.save.coins, 60 - UPGRADES.find((u) => u.id === 'launcher').costs[0]);
  const maxed = update(DEFAULT_SAVE, { coins: 1e6, upgrades: { launcher: 7 } });
  assert.equal(buyUpgrade(maxed, 'launcher').reason, 'max');
});

test('skins: buy, equip, and the golden pig only via the Moon', () => {
  const s = update(DEFAULT_SAVE, { coins: 400 });
  const r = buySkin(s, 'spotted');
  assert.ok(r.ok);
  assert.equal(r.save.skin, 'spotted');
  assert.equal(buySkin(r.save, 'pink').save.skin, 'pink');
  assert.equal(buySkin(s, 'golden').reason, 'locked');
  const moon = recordFlight(s, summary({ maxAlt: MOON_ALT, moon: true })).save;
  assert.ok(moon.owned.includes('golden'));
});

test('recordFlight pays out, updates records, medals and missions', () => {
  const res = recordFlight(DEFAULT_SAVE, summary({ maxAlt: 120, distance: 600 }));
  assert.equal(res.save.flights, 1);
  assert.ok(res.records.alt && res.records.dist);
  assert.ok(res.medals.some((m) => m.id === 'a100'));
  assert.equal(res.save.coins, res.earned + res.medalCoins + res.missionCoins);
  assert.equal(res.save.best.alt, 120);
  assert.equal(res.save.missions.active.length, 3);
});

test('a second-wind continuation only pays the difference and does not count a new flight', () => {
  const first = recordFlight(DEFAULT_SAVE, summary());
  const cont = recordFlight(first.save, summary({ distance: 300, maxAlt: 60 }), { banked: first.payout.total });
  assert.equal(cont.save.flights, 1);
  assert.equal(cont.earned, cont.payout.total - first.payout.total);
});

test('tips are remembered once', () => {
  const s = markTip(markTip(DEFAULT_SAVE, 'pitch'), 'pitch');
  assert.deepEqual([...s.tips], ['pitch']);
});

test('storage falls back to defaults on corrupt data', () => {
  const store = new Map([[SAVE_KEY, '{not json']]);
  const st = createStorage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  const orig = console.warn;
  console.warn = () => {};
  assert.deepEqual(st.load(), DEFAULT_SAVE);
  console.warn = orig;
  st.persist(update(DEFAULT_SAVE, { coins: 7 }));
  assert.equal(st.load().coins, 7);
});
