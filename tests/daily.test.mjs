import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyStatus, claimDaily, chestReward, dayKey, STREAK_DAYS } from '../js/daily.js';
import { DEFAULT_SAVE, update, sanitize } from '../js/save.js';

test('a new player can open day 1 today', () => {
  const st = dailyStatus(DEFAULT_SAVE, '2026-09-25');
  assert.equal(st.available, true);
  assert.equal(st.day, 1);
  assert.equal(st.reward, chestReward(1, DEFAULT_SAVE));
});

test('claiming twice on the same day fails; next day continues the streak', () => {
  const r1 = claimDaily(DEFAULT_SAVE, '2026-09-25');
  assert.ok(r1.ok);
  const s1 = update(DEFAULT_SAVE, { daily: r1.daily });
  assert.equal(claimDaily(s1, '2026-09-25').ok, false);
  const st = dailyStatus(s1, '2026-09-25');
  assert.equal(st.available, false);
  assert.equal(st.tomorrowDay, 2);
  const r2 = claimDaily(s1, '2026-09-26');
  assert.equal(r2.day, 2);
  assert.ok(r2.coins > r1.coins);
});

test('streak crosses month ends and resets after a missed day', () => {
  const s = update(DEFAULT_SAVE, { daily: { last: '2026-09-30', streak: 3 } });
  assert.equal(dailyStatus(s, '2026-10-01').day, 4);
  assert.equal(dailyStatus(s, '2026-10-02').day, 1);
});

test('after day 7 the streak wraps to day 1 and rewards scale with progress', () => {
  const s = update(DEFAULT_SAVE, { daily: { last: '2026-09-25', streak: STREAK_DAYS } });
  assert.equal(dailyStatus(s, '2026-09-26').day, 1);
  const far = update(DEFAULT_SAVE, { best: { alt: 4000, dist: 0, speed: 0, coins: 0 } });
  assert.ok(chestReward(1, far) > chestReward(1, DEFAULT_SAVE));
});

test('bad daily data is sanitized', () => {
  for (const bad of [null, 'x', { last: 42, streak: -3 }, { last: '2026-13-99', streak: 99 }]) {
    const s = sanitize({ daily: bad });
    assert.ok(s.daily.streak >= 0 && s.daily.streak <= STREAK_DAYS);
    assert.equal(typeof s.daily.last, 'string');
  }
  assert.match(dayKey(new Date(2026, 0, 5)), /^2026-01-05$/);
});
