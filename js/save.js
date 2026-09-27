// Save data: validated on load, updated immutably, persisted through the
// CrazyGames data module (account sync) or localStorage.

import { UPGRADES, SKINS, maxLevel, upgradeById, isLocked, computeStats } from './upgrades.js';
import { MEDALS, payout, newMedals } from './economy.js';
import { KINDS, SLOTS, fillMissions, settleMissions } from './missions.js';

export const SAVE_KEY = 'whenpigsfly.save.v1';
const MAX_COINS = 1e9;
const TIPS = ['launch', 'pitch', 'boost', 'skip', 'hold', 'flare'];

const num = (n, max = MAX_COINS) => (Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0);
const int = (n, max) => Math.floor(num(n, max));

export const DEFAULT_SAVE = sanitize({});

function sanitizeMissions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const active = Array.isArray(src.active)
    ? src.active
      .filter((m) => m && KINDS[m.kind] && Number.isFinite(m.target) && m.target > 0 && Number.isFinite(m.reward))
      .slice(0, SLOTS)
      .map((m) => Object.freeze({ kind: m.kind, target: m.target, reward: int(m.reward, 1e6) }))
    : [];
  const unique = active.filter((m, i) => active.findIndex((o) => o.kind === m.kind) === i);
  return { level: int(src.level, 1e6), seed: int(src.seed, 2 ** 31) || 1, active: unique };
}

function sanitizeDaily(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const last = typeof d.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.last) ? d.last : '';
  return Object.freeze({ last, streak: last ? Math.min(int(d.streak, 99), 7) : 0 });
}

export function sanitize(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawUp = src.upgrades && typeof src.upgrades === 'object' ? src.upgrades : {};
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = Math.min(int(rawUp[u.id], 99), maxLevel(u));
  const skinIds = new Set(SKINS.map((s) => s.id));
  const moon = src.moon === true;
  const owned = [...new Set(['pink', ...(Array.isArray(src.owned) ? src.owned : []).filter((id) => skinIds.has(id))])]
    .filter((id) => id !== 'golden' || moon);
  if (moon && !owned.includes('golden')) owned.push('golden');
  const best = src.best && typeof src.best === 'object' ? src.best : {};
  const medalIds = new Set(MEDALS.map((m) => m.id));
  const medals = Array.isArray(src.medals) ? [...new Set(src.medals.filter((id) => medalIds.has(id)))] : [];
  const tips = Array.isArray(src.tips) ? [...new Set(src.tips.filter((t) => TIPS.includes(t)))] : [];
  const base = {
    coins: int(src.coins),
    upgrades: Object.freeze(upgrades),
    skin: owned.includes(src.skin) ? src.skin : 'pink',
    owned: Object.freeze(owned),
    best: Object.freeze({ alt: num(best.alt, 1e6), dist: num(best.dist, 1e8), speed: num(best.speed, 1e5), coins: int(best.coins, 1e8) }),
    medals: Object.freeze(medals),
    flights: int(src.flights, 1e8),
    moon,
    lastPayout: int(src.lastPayout),
    muted: src.muted === true,
    tips: Object.freeze(tips),
    daily: sanitizeDaily(src.daily),
  };
  const missions = fillMissions(sanitizeMissions(src.missions), missionCtx(base));
  return Object.freeze({ ...base, missions });
}

export function missionCtx(save) {
  return { best: save.best, hasRocket: (save.upgrades.rocket || 0) > 0, lastPayout: save.lastPayout };
}

export function update(save, patch) {
  return sanitize({ ...save, ...patch });
}

export const statsOf = (save) => computeStats(save.upgrades);

export function buyUpgrade(save, id) {
  const u = upgradeById(id);
  if (!u) return { ok: false, save, reason: 'unknown' };
  if (isLocked(save.upgrades, u)) return { ok: false, save, reason: 'locked' };
  const lv = save.upgrades[id] || 0;
  if (lv >= maxLevel(u)) return { ok: false, save, reason: 'max' };
  const cost = u.costs[lv];
  if (save.coins < cost) return { ok: false, save, reason: 'poor' };
  return { ok: true, save: update(save, { coins: save.coins - cost, upgrades: { ...save.upgrades, [id]: lv + 1 } }) };
}

export function buySkin(save, id) {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) return { ok: false, save, reason: 'unknown' };
  if (save.owned.includes(id)) return { ok: true, save: update(save, { skin: id }) };
  if (skin.cost === null) return { ok: false, save, reason: 'locked' };
  if (save.coins < skin.cost) return { ok: false, save, reason: 'poor' };
  return { ok: true, save: update(save, { coins: save.coins - skin.cost, owned: [...save.owned, id], skin: id }) };
}

export const addCoins = (save, amount) => update(save, { coins: save.coins + Math.max(0, Math.floor(amount)) });
export const markTip = (save, tip) => (save.tips.includes(tip) ? save : update(save, { tips: [...save.tips, tip] }));

// Commits a finished flight: pays out, awards medals, settles missions, updates records.
// A flight continued with "Second wind" passes the payout already banked
// (`banked`), so only the difference is paid and the flight is not counted twice.
export function recordFlight(save, summary, { banked = null } = {}) {
  const pay = payout(summary, statsOf(save).payMult);
  const earned = banked === null ? pay.total : Math.max(0, pay.total - banked);
  const medals = newMedals(summary, save.medals);
  const settled = settleMissions(save.missions, summary);
  const medalCoins = medals.reduce((s, m) => s + m.reward, 0);
  const missionCoins = settled.done.reduce((s, m) => s + m.reward, 0);
  const records = {
    alt: summary.maxAlt > save.best.alt,
    dist: summary.distance > save.best.dist,
    speed: summary.topSpeed > save.best.speed,
  };
  const next = update(save, {
    coins: save.coins + earned + medalCoins + missionCoins,
    best: {
      alt: Math.max(save.best.alt, summary.maxAlt),
      dist: Math.max(save.best.dist, summary.distance),
      speed: Math.max(save.best.speed, summary.topSpeed),
      coins: Math.max(save.best.coins, summary.coins),
    },
    medals: [...save.medals, ...medals.map((m) => m.id)],
    missions: settled.state,
    flights: save.flights + (banked === null ? 1 : 0),
    moon: save.moon || summary.moon,
    lastPayout: pay.total,
  });
  return {
    save: next, payout: pay, earned, medals, medalCoins, missions: settled.done, missionCoins, records,
    firstMoon: summary.moon && !save.moon,
  };
}

export function createStorage(backend) {
  return {
    load() {
      try {
        const text = backend.getItem(SAVE_KEY);
        return text ? sanitize(JSON.parse(text)) : DEFAULT_SAVE;
      } catch (err) {
        console.warn('[save] load failed, using defaults', err);
        return DEFAULT_SAVE;
      }
    },
    persist(save) {
      try {
        backend.setItem(SAVE_KEY, JSON.stringify(save));
      } catch (err) {
        console.warn('[save] persist failed', err);
      }
    },
  };
}
