// What happens when the pig touches sky objects and ground features.
// Mutates the flight state `f` (the simulation's single mutable record).

import { LAYERS, layerIndexAt, scaleAt, PIG_R, clamp } from './config.js';

const SPEED_KEEP = { goose: 0.75, thunder: 0.7, satellite: 0.75, asteroid: 0.75, plane: 0.7 };
const FIELD_LIMIT = { updraft: 1.6, jetstream: 3 };
const TWO_PI = Math.PI * 2;
const TNT_KICK_X = 12;
const TNT_KICK_Y = 22;
const TNT_COINS = 5;

// Flap energy (seconds) gained from pickups, capped at the pig's maximum.
export function refillFlap(f, seconds) {
  if (f.flapMax) f.flap = Math.min(f.flapMax, (f.flap || 0) + seconds);
}

export function emit(f, type, data = {}) {
  if (!f.quiet) f.events.push({ type, ...data });
}

export function setFace(f, face, t) {
  f.face = face;
  f.faceT = t;
}

const objScale = (o) => LAYERS[layerIndexAt(o.y)].scale;

function scaleSpeed(f, k) {
  f.vx *= k;
  f.vy *= k;
}

function reflect(f, nx, ny, restitution) {
  const vn = f.vx * nx + f.vy * ny;
  if (vn >= 0) return;
  f.vx -= (1 + restitution) * vn * nx;
  f.vy -= (1 + restitution) * vn * ny;
}

function hitHazard(f, o, nx, ny) {
  f.taken.add(o.id);
  if (f.hitCd > 0) return;
  scaleSpeed(f, SPEED_KEEP[o.type] || 0.75);
  if (o.type === 'satellite' || o.type === 'asteroid') reflect(f, nx, ny, 0.4);
  if (o.type === 'thunder') f.spinV = (Math.floor(f.t * 7) % 2 ? -1 : 1) * 9;
  if (o.type === 'goose' || o.type === 'plane') f.vy -= 4;
  f.dizzy = o.type === 'thunder' ? 1.5 : 1.1;
  f.hitCd = 0.6;
  f.hazards += 1;
  setFace(f, 'dizzy', 1.4);
  emit(f, 'hit', { kind: o.type, x: f.x, y: f.y });
}

function popBalloon(f, o) {
  f.taken.add(o.id);
  f.vy = Math.max(f.vy, 0) + (o.type === 'wballoon' ? 28 : 13);
  refillFlap(f, 0.8);
  f.balloons += 1;
  f.chainN = f.t - f.chainT < 3 ? f.chainN + 1 : 1;
  f.chainT = f.t;
  if (f.chainN >= 3) f.chainBonus += 5;
  setFace(f, 'happy', 0.7);
  emit(f, 'pop', { x: o.x, y: o.y, color: o.color || '#ffffff', chain: f.chainN, big: o.type === 'wballoon' });
}

function fieldPush(f, o, dt) {
  const used = f.fieldTime.get(o.id) || 0;
  if (used >= FIELD_LIMIT[o.type]) return;
  f.fieldTime.set(o.id, used + dt);
  if (used === 0) emit(f, 'wind', { kind: o.type, x: f.x, y: f.y });
  if (o.type === 'updraft') f.vy += o.power * dt;
  else f.vx += o.power * dt;
}

// Lucky gift box: one of four random rewards (the roll is stored on the box).
export const GIFTS = ['coins', 'zoom', 'fuel', 'double'];
export const DOUBLE_TIME = 6;
function openGift(f, o) {
  f.taken.add(o.id);
  refillFlap(f, 1.2);
  f.gifts += 1;
  let kind = o.reward;
  if (kind === 'fuel' && f.fuelMax <= 0) kind = 'coins';
  let coins = 0;
  if (kind === 'coins') {
    coins = Math.round(12 * objScale(o) + f.stats.launchSpeed * 0.4);
    f.coins += coins;
  } else if (kind === 'zoom') {
    const s = Math.hypot(f.vx, f.vy) || 1;
    const kick = 16 + s * 0.15;
    f.vx += (f.vx / s) * kick;
    f.vy = Math.max(f.vy, 0) + 10;
  } else if (kind === 'fuel') {
    f.fuel = f.fuelMax;
  } else {
    f.doubleUntil = f.t + DOUBLE_TIME;
  }
  setFace(f, 'happy', 1);
  emit(f, 'gift', { x: o.x, y: o.y, kind, coins });
}

function surfPlane(f, o) {
  f.taken.add(o.id);
  f.vy = Math.abs(f.vy) * 0.4 + 22;
  f.vx += 14;
  f.surfs += 1;
  setFace(f, 'happy', 1);
  emit(f, 'surf', { x: f.x, y: f.y });
}

function startAbduction(f, o) {
  f.taken.add(o.id);
  f.abductions += 1;
  f.abduct = { t: 0, dur: 1.9, x0: f.x, y0: f.y, x1: o.x, y1: f.y + 450, ufo: o };
  setFace(f, 'scared', 2);
  emit(f, 'abduct', { x: o.x, y: o.y });
}

// Coin combo: pickups less than COMBO_GAP apart build a chain; every
// COMBO_STEP coins in a row add +0.5x to coin value (max COMBO_MAX).
export const COMBO_GAP = 1.4;
const COMBO_STEP = 6;
const COMBO_MAX = 3;
export const comboFor = (chain) => Math.min(COMBO_MAX, 1 + Math.floor(chain / COMBO_STEP) * 0.5);

function comboUp(f) {
  f.coinChain = f.t - f.coinStreakT < COMBO_GAP ? f.coinChain + 1 : 1;
  f.coinStreakT = f.t;
  const mult = comboFor(f.coinChain);
  if (mult > f.comboMult) emit(f, 'combo', { mult, x: f.x, y: f.y });
  f.comboMult = mult;
  f.bestCombo = Math.max(f.bestCombo, mult);
  return mult;
}

export function collideSky(f, world, dt, scratch) {
  if (f.comboMult > 1 && f.t - f.coinStreakT >= COMBO_GAP) {
    f.comboMult = 1;
    f.coinChain = 0;
    emit(f, 'comboEnd', {});
  }
  const pr = PIG_R * scaleAt(f.y);
  const reach = 30 * scaleAt(f.y) + f.stats.magnet * 5;
  scratch.length = 0;
  const objs = world.query(f.x - reach, f.y - reach, f.x + reach, f.y + reach, scratch);
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.type === 'updraft' || o.type === 'jetstream') {
      if (f.x >= o.x0 && f.x <= o.x1 && f.y >= o.y0 && f.y <= o.y1) fieldPush(f, o, dt);
      continue;
    }
    if (f.taken.has(o.id)) continue;
    const dx = f.x - o.x;
    const dy = f.y - o.y;
    if (o.type === 'plane') {
      if (Math.abs(dx) < o.w / 2 + pr && Math.abs(dy) < o.h / 2 + pr) {
        if (dy > o.h * 0.15) surfPlane(f, o);
        else hitHazard(f, o, 0, -1);
      }
      continue;
    }
    if (o.type === 'ufo') {
      if (Math.abs(dx) < o.r * 1.3 && dy < 0 && dy > -o.beam) startAbduction(f, o);
      continue;
    }
    const d = Math.hypot(dx, dy) || 1e-6;
    const S = objScale(o);
    if (o.type === 'coin') {
      if (d < o.r + pr + f.stats.magnet * S) {
        f.taken.add(o.id);
        const mult = comboUp(f) * (f.t < f.doubleUntil ? 2 : 1);
        const value = Math.round(o.value * mult);
        f.coins += value;
        refillFlap(f, 0.06);
        setFace(f, 'happy', 0.4);
        emit(f, 'coin', { x: o.x, y: o.y, value, star: o.star, mult, chain: f.coinChain });
      }
    } else if (o.type === 'gift') {
      if (d < o.r + pr + 0.8 * S) openGift(f, o);
    } else if (o.type === 'fuel') {
      if (d < o.r + pr + 0.6 * S) {
        f.taken.add(o.id);
        if (f.fuelMax > 0) {
          f.fuel = Math.min(f.fuelMax, f.fuel + f.fuelMax * 0.4);
          f.fuelCans += 1;
          emit(f, 'fuel', { x: o.x, y: o.y });
        } else {
          f.coins += 3;
          emit(f, 'coin', { x: o.x, y: o.y, value: 3 });
        }
      }
    } else if (o.type === 'balloon' || o.type === 'wballoon') {
      if (d < o.r + pr) popBalloon(f, o);
    } else if (o.type === 'hotair') {
      if (d < o.r + pr) {
        f.taken.add(o.id);
        reflect(f, dx / d, dy / d, 0.9);
        f.vy += 10;
        f.bounces += 1;
        emit(f, 'boing', { x: f.x, y: f.y });
      }
    } else if (d < o.r + pr) {
      hitHazard(f, o, dx / d, dy / d);
    }
  }
}

// Haystacks and trampolines near the pig. Returns true if it bounced.
export function collideGroundFeatures(f, terrain) {
  if (f.y > 40) return false;
  const pr = PIG_R;
  for (const seg of terrain.segments(f.x - 8, f.x + 8)) {
    const ft = seg.feature;
    if (!ft || f.featureCd.get(seg.i) > f.t) continue;
    if (ft.type === 'haystack') {
      const hy = terrain.height(ft.x) + 1.3;
      const dx = f.x - ft.x;
      const dy = f.y - hy;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (d < ft.r + pr) {
        reflect(f, dx / d, dy / d, 0.75);
        f.vy = Math.max(f.vy, 8);
        return bounced(f, seg, 'hay');
      }
    } else if (ft.type === 'tnt') {
      // TNT barrel: blows up once and launches the pig up and forward.
      if (f.blown.has(seg.i)) continue;
      const hy = terrain.height(ft.x) + 0.9;
      const d = Math.hypot(f.x - ft.x, f.y - hy);
      if (d < ft.r + pr + 0.6) {
        f.blown.add(seg.i);
        f.vx = Math.max(f.vx, 10) + TNT_KICK_X;
        f.vy = Math.max(f.vy, 0) + TNT_KICK_Y;
        f.coins += TNT_COINS;
        f.tnts += 1;
        refillFlap(f, 1);
        f.y = Math.max(f.y, hy + ft.r + pr);
        emit(f, 'tnt', { x: ft.x, y: hy, seg: seg.i, coins: TNT_COINS });
        return bounced(f, seg, 'kaboom');
      }
    } else if (ft.type === 'trampoline') {
      const top = terrain.height(ft.x) + 1.4;
      if (Math.abs(f.x - ft.x) < ft.w / 2 && f.y - pr < top && f.y > top - 2.5 && f.vy <= 0.5) {
        f.vy = Math.max(-f.vy * 1.05, 16);
        f.vx = Math.max(f.vx, 8);
        f.y = top + pr;
        return bounced(f, seg, 'boing');
      }
    }
  }
  return false;
}

function bounced(f, seg, kind) {
  f.featureCd.set(seg.i, f.t + 0.5);
  f.grounded = false;
  f.bounces += 1;
  f.rotAcc = 0;
  setFace(f, 'happy', 0.8);
  emit(f, kind, { x: f.x, y: f.y });
  return true;
}

export function stepAbduction(f, dt) {
  const a = f.abduct;
  a.t += dt;
  const k = clamp(a.t / a.dur, 0, 1);
  const ease = k * k * (3 - 2 * k);
  f.x = a.x0 + (a.x1 - a.x0) * Math.min(1, k * 3);
  f.y = a.y0 + (a.y1 - a.y0) * ease;
  f.angle += dt * TWO_PI * 0.8;
  if (k >= 1) {
    f.abduct = null;
    f.vx = Math.max(f.vx, 30);
    f.vy = 12;
    f.angle = 0.3;
    f.rotAcc = 0;
    setFace(f, 'happy', 1);
    emit(f, 'dropped', { x: f.x, y: f.y });
  }
}
