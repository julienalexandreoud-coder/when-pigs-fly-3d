// Daily chest: a 7-day login streak. Pure logic (dates are passed in as
// local "YYYY-MM-DD" strings) so it can be unit tested.

const BASE = [50, 80, 120, 160, 220, 300, 500];
export const STREAK_DAYS = BASE.length;

// Local calendar day, e.g. "2026-09-25".
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

// Rewards grow with progress so the chest stays worth opening late in the game.
function scaleFor(save) {
  return Math.min(20, Math.max(1, Math.round((save.best?.alt || 0) / 400)));
}

export function chestReward(day, save) {
  const i = Math.max(1, Math.min(STREAK_DAYS, day)) - 1;
  return BASE[i] * scaleFor(save);
}

// { available, day (1..7, the chest you can open now or next), reward, tomorrow }
export function dailyStatus(save, today) {
  const { last = '', streak = 0 } = save.daily || {};
  const claimedToday = last === today;
  const continues = last !== '' && last === previousDay(today);
  const day = claimedToday ? streak : continues ? (streak % STREAK_DAYS) + 1 : 1;
  const nextDay = claimedToday ? (streak % STREAK_DAYS) + 1 : (day % STREAK_DAYS) + 1;
  return {
    available: !claimedToday,
    day,
    reward: chestReward(day, save),
    tomorrowDay: nextDay,
    tomorrow: chestReward(nextDay, save),
  };
}

// Returns { ok, coins, day, daily } where `daily` is the new save.daily value.
export function claimDaily(save, today) {
  const st = dailyStatus(save, today);
  if (!st.available) return { ok: false, coins: 0, day: st.day, daily: save.daily };
  return { ok: true, coins: st.reward, day: st.day, daily: { last: today, streak: st.day } };
}
