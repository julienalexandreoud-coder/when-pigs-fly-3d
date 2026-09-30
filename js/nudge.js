// "One more flight" nudges shown after a crash: how close the player came to
// a record, an upgrade or the next goal. Pure, so it can be unit tested.

import { nextGoal, bestAffordable } from './economy.js';
import { goalAt, goalValue, goalText } from './goals.js';

const NEAR_RECORD = 0.8;
const NEAR_GOAL = 0.6;

// summary: the finished flight; save: the save after it was recorded;
// prev: the records before the flight ({ alt, dist }).
// Returns up to `max` short sentences, most motivating first.
export function nudges(summary, save, prev, max = 2) {
  const out = [];
  const m = (v) => Math.max(1, Math.ceil(v));
  if (prev.alt >= 30 && summary.maxAlt < prev.alt && summary.maxAlt >= prev.alt * NEAR_RECORD) {
    out.push(`So close! Only ${m(prev.alt - summary.maxAlt)} m short of your height record`);
  } else if (prev.dist >= 60 && summary.distance < prev.dist && summary.distance >= prev.dist * NEAR_RECORD) {
    out.push(`So close! Only ${m(prev.dist - summary.distance)} m short of your distance record`);
  }
  const ready = bestAffordable(save);
  if (ready) {
    out.push(`You can buy ${ready.name} right now!`);
  } else {
    const goal = nextGoal(save);
    const gap = goal ? goal.cost - save.coins : 0;
    if (goal && gap <= Math.max(20, save.lastPayout * 1.5)) out.push(`Only ${m(gap)} coins to ${goal.name}! One more flight`);
  }
  const g = goalAt(save.goal);
  const got = goalValue(g, { maxAlt: summary.maxAlt, distance: summary.distance });
  if (got >= g.v * NEAR_GOAL && got < g.v) out.push(`Next goal: ${goalText(g)}. You did ${m(got)} m!`);
  return out.slice(0, max);
}
