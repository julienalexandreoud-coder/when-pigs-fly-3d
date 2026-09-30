import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nudges } from '../js/nudge.js';
import { DEFAULT_SAVE, update } from '../js/save.js';

const flight = (o = {}) => ({ maxAlt: 40, distance: 150, ...o });

test('near a height record: says how many metres were missing', () => {
  const save = update(DEFAULT_SAVE, { coins: 0, lastPayout: 10, goal: 0 });
  const out = nudges(flight({ maxAlt: 90 }), save, { alt: 100, dist: 1000 });
  assert.match(out[0], /Only 10 m short of your height record/);
});

test('no record nudge when far from the record or when it was beaten', () => {
  const save = update(DEFAULT_SAVE, { coins: 0, lastPayout: 10, goal: 0 });
  assert.ok(!nudges(flight({ maxAlt: 40 }), save, { alt: 100, dist: 10000 }).some((t) => /record/.test(t)));
  assert.ok(!nudges(flight({ maxAlt: 120 }), save, { alt: 100, dist: 10000 }).some((t) => /record/.test(t)));
});

test('an affordable upgrade or a nearly affordable one is pointed out', () => {
  const rich = update(DEFAULT_SAVE, { coins: 20, lastPayout: 10 });
  assert.ok(nudges(flight(), rich, { alt: 0, dist: 0 }).some((t) => /right now/.test(t)));
  const close = update(DEFAULT_SAVE, { coins: 5, lastPayout: 10 });
  assert.ok(nudges(flight(), close, { alt: 0, dist: 0 }).some((t) => /Only 10 coins to/.test(t)));
});

test('a goal that was nearly reached is shown with the result', () => {
  const save = update(DEFAULT_SAVE, { coins: 0, lastPayout: 0, goal: 0 });
  const out = nudges(flight({ distance: 80 }), save, { alt: 0, dist: 0 }, 3);
  assert.ok(out.some((t) => /Next goal: FLY 100 m FAR\. You did 80 m!/.test(t)), out.join(' | '));
});

test('at most `max` nudges', () => {
  const save = update(DEFAULT_SAVE, { coins: 20, lastPayout: 10, goal: 0 });
  assert.ok(nudges(flight({ maxAlt: 90, distance: 80 }), save, { alt: 100, dist: 0 }).length <= 2);
});
