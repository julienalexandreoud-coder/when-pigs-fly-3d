// Coins earned per flight, medals and the "next goal" helpers.

import { MOON_ALT, formatDistance, kmh } from './config.js';
import { UPGRADES, SKINS, maxLevel, isLocked } from './upgrades.js';

export const RATES = Object.freeze({ distance: 0.1, farDistance: 0.025, farFrom: 2000, altitude: 0.25, speed: 0.05 });

// Long glides still pay, but less per metre past 2 km so altitude stays the goal.
export const distanceCoins = (d) => Math.floor(Math.min(d, RATES.farFrom) * RATES.distance + Math.max(0, d - RATES.farFrom) * RATES.farDistance);
export const TRICKS = Object.freeze({ flip: 8, surf: 15, balloon: 2, abduct: 30, perfect: 5, bounce: 1, flare: 4 });

export function trickCoins(s) {
  return s.flips * TRICKS.flip + s.surfs * TRICKS.surf + s.balloons * TRICKS.balloon + s.chainBonus
    + s.abductions * TRICKS.abduct + (s.perfect ? TRICKS.perfect : 0) + s.bounces * TRICKS.bounce + (s.flares || 0) * TRICKS.flare;
}

// Returns the result lines (for the count-up) and the total.
export function payout(summary, payMult) {
  const lines = [
    { id: 'distance', label: 'Distance', detail: formatDistance(summary.distance), amount: distanceCoins(summary.distance) },
    { id: 'altitude', label: 'Max altitude', detail: formatDistance(summary.maxAlt), amount: Math.floor(summary.maxAlt * RATES.altitude) },
    { id: 'speed', label: 'Top speed', detail: `${kmh(summary.topSpeed)} km/h`, amount: Math.floor(kmh(summary.topSpeed) * RATES.speed) },
    { id: 'coins', label: 'Coins grabbed', detail: '', amount: summary.coins },
    { id: 'tricks', label: 'Tricks', detail: trickDetail(summary), amount: trickCoins(summary) },
  ];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const mult = payMult > 1 ? payMult : 1;
  return { lines, subtotal, mult, total: Math.round(subtotal * mult) };
}

function trickDetail(s) {
  const parts = [];
  if (s.tnts) parts.push(`${s.tnts} kaboom${s.tnts > 1 ? 's' : ''}`);
  if (s.flares) parts.push(`${s.flares} bounce${s.flares > 1 ? 's' : ''}`);
  if (s.flips) parts.push(`${s.flips} flip${s.flips > 1 ? 's' : ''}`);
  if (s.balloons) parts.push(`${s.balloons} pop${s.balloons > 1 ? 's' : ''}`);
  if (s.surfs) parts.push(`${s.surfs} surf${s.surfs > 1 ? 's' : ''}`);
  if (s.abductions) parts.push('abducted');
  if (s.perfect) parts.push('perfect');
  return parts.slice(0, 3).join(', ');
}

export const MEDALS = Object.freeze([
  { id: 'a100', kind: 'alt', v: 100, name: 'Treetop', reward: 40 },
  { id: 'a500', kind: 'alt', v: 500, name: 'Bird Buddy', reward: 120 },
  { id: 'a1k', kind: 'alt', v: 1000, name: 'Cloud Hopper', reward: 260 },
  { id: 'a1500', kind: 'alt', v: 1500, name: 'Jet Setter', reward: 650 },
  { id: 'a3500', kind: 'alt', v: 3500, name: 'Stratonaut', reward: 1600 },
  { id: 'a6500', kind: 'alt', v: 6500, name: 'Space Pig', reward: 3500 },
  { id: 'moon', kind: 'alt', v: MOON_ALT, name: 'Moon Pig', reward: 10000 },
  { id: 'd500', kind: 'dist', v: 500, name: 'Far Flier', reward: 80 },
  { id: 'd2k', kind: 'dist', v: 2000, name: 'Cross Country', reward: 320 },
  { id: 'd5k', kind: 'dist', v: 5000, name: 'Long Haul', reward: 900 },
  { id: 'd15k', kind: 'dist', v: 15000, name: 'Globetrotter', reward: 2500 },
  { id: 's150', kind: 'speed', v: 150, name: 'Speedy Snout', reward: 60 },
  { id: 's400', kind: 'speed', v: 400, name: 'Hog Rocket', reward: 260 },
  { id: 's800', kind: 'speed', v: 800, name: 'Bacon Blur', reward: 800 },
  { id: 'sonic', kind: 'speed', v: 1235, name: 'Sonic Boom', reward: 2000 },
]);

export function medalValue(kind, summary) {
  if (kind === 'alt') return summary.moon ? MOON_ALT : summary.maxAlt;
  if (kind === 'dist') return summary.distance;
  return kmh(summary.topSpeed);
}

export function medalText(m) {
  if (m.kind === 'alt') return m.id === 'moon' ? 'Reach the Moon' : `Reach ${formatDistance(m.v)} up`;
  if (m.kind === 'dist') return `Fly ${formatDistance(m.v)} far`;
  return `Hit ${m.v.toLocaleString('en-US')} km/h`;
}

export function newMedals(summary, owned) {
  return MEDALS.filter((m) => !owned.includes(m.id) && medalValue(m.kind, summary) >= m.v);
}

export function nextMedal(owned, kind = 'alt') {
  return MEDALS.find((m) => m.kind === kind && !owned.includes(m.id)) || null;
}

// Everything purchasable right now, cheapest first.
export function shopOptions(save) {
  const ups = UPGRADES.filter((u) => !isLocked(save.upgrades, u) && (save.upgrades[u.id] || 0) < maxLevel(u))
    .map((u) => ({ kind: 'upgrade', id: u.id, name: u.levels[(save.upgrades[u.id] || 0) + 1].name, cost: u.costs[save.upgrades[u.id] || 0] }));
  const skins = SKINS.filter((s) => s.cost !== null && !save.owned.includes(s.id))
    .map((s) => ({ kind: 'skin', id: s.id, name: s.name, cost: s.cost }));
  return [...ups, ...skins].sort((a, b) => a.cost - b.cost);
}

export const affordableCount = (save) => shopOptions(save).filter((o) => o.kind === 'upgrade' && o.cost <= save.coins).length;

export function nextGoal(save) {
  const ups = shopOptions(save).filter((o) => o.kind === 'upgrade');
  return ups.find((o) => o.cost > save.coins) || null;
}
