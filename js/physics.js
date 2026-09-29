// Flight simulation: aerodynamics, thrust, ground contact, flips, the Moon.
// Pure logic (no DOM) so the balance bot and tests can run it in Node.

import {
  STEP, LAUNCH_ANGLE, LAUNCH_POS, PIG_R, END_SPEED, TURN_RATE, WEATHERVANE, MAX_SPEED, MAX_LIFT,
  PERFECT_BONUS, MAX_FLIGHT_TIME, MOON_ALT, densityAt, gravityAt, wrapAngle, layerIndexAt, scaleAt, clamp,
} from './config.js';
import { collideSky, collideGroundFeatures, stepAbduction, emit, setFace, refillFlap } from './collide.js';

const TWO_PI = Math.PI * 2;
const SONIC = 343;
// Grass stops a sliding pig quickly so a flight never ends in a long crawl.
const GRASS_FRICTION = 11;
// Automatic skims off the ground need real speed and a shallow angle.
const SKIM_SPEED = 14;
const SKIM_ANGLE = 0.45;
// Flare: tapping just before touching down turns a crash into a bounce.
export const FLARE_WINDOW = 0.45;
const FLARE_MIN_SPEED = 7;
const FLARE_KEEP = 0.88;
const FLARE_ANGLE = 0.6;
const HOP_MIN_SPEED = 8;
// Flapping: holding "fly up" makes Pip flap and really climb, on a small
// energy bar (seconds) that refills from balloons, coins, gifts and TNT.
// Only real input flaps (`input.flap`); the autopilot and bot never do.
export const FLAP_BASE = 2.4;
export const FLAP_PER_WING = 0.45;
const FLAP_ACC = 17;
const FLAP_MAX_CLIMB = 16;
const FLAP_ANGLE = 0.75;
// Every full flip kicks the pig forward a little.
const FLIP_KICK = 7;
const FLIP_KICK_FRAC = 0.05;

// `starterBlasts`: surprise TNT blasts off the ground for a new player's first flights.
export function createFlight(stats, { power = 1, perfect = false, golden = false, starterBlasts = 0 } = {}) {
  const speed = stats.launchSpeed * power * (perfect ? PERFECT_BONUS : 1);
  const fuelMax = stats.thrust > 0 ? stats.fuel * (golden ? 2 : 1) : 0;
  return {
    stats,
    x: LAUNCH_POS.x,
    y: LAUNCH_POS.y,
    vx: Math.cos(LAUNCH_ANGLE) * speed,
    vy: Math.sin(LAUNCH_ANGLE) * speed,
    angle: LAUNCH_ANGLE,
    spinV: 0,
    rotAcc: 0,
    fuel: fuelMax,
    fuelMax,
    flap: FLAP_BASE + FLAP_PER_WING * (stats.tiers.wings || 0),
    flapMax: FLAP_BASE + FLAP_PER_WING * (stats.tiers.wings || 0),
    flapping: false,
    boosting: false,
    grounded: false,
    done: false,
    cause: null,
    t: 0,
    maxAlt: LAUNCH_POS.y,
    distance: 0,
    topSpeed: speed,
    coins: 0,
    flips: 0,
    balloons: 0,
    chainN: 0,
    chainT: -9,
    chainBonus: 0,
    surfs: 0,
    abductions: 0,
    bounces: 0,
    glideDist: 0,
    fuelCans: 0,
    hazards: 0,
    perfect,
    power,
    golden,
    moon: false,
    rebounded: false,
    sonic: false,
    maxLayer: 0,
    dizzy: 0,
    hitCd: 0,
    face: 'happy',
    faceT: 0.8,
    abduct: null,
    coinStreakT: -9,
    coinChain: 0,
    comboMult: 1,
    bestCombo: 1,
    pressT: -9,
    upHeld: false,
    flares: 0,
    starterBlasts,
    tnts: 0,
    gifts: 0,
    doubleUntil: -9,
    rushT: 0,
    rushN: 0,
    blown: new Set(),
    milestone: 0,
    taken: new Set(),
    fieldTime: new Map(),
    featureCd: new Map(),
    events: [],
    quiet: false,
    scratch: [],
  };
}

function end(f, cause) {
  f.done = true;
  f.cause = cause;
  f.boosting = false;
  emit(f, 'end', { cause, x: f.x, y: f.y });
}

function countFlips(f, dTheta) {
  f.rotAcc += dTheta;
  if (Math.abs(f.rotAcc) >= TWO_PI) {
    f.rotAcc -= Math.sign(f.rotAcc) * TWO_PI;
    f.flips += 1;
    const kick = FLIP_KICK + FLIP_KICK_FRAC * Math.hypot(f.vx, f.vy);
    f.vx += Math.cos(f.angle) * kick;
    f.vy += Math.sin(f.angle) * kick;
    setFace(f, 'happy', 0.8);
    emit(f, 'flip', { x: f.x, y: f.y, n: f.flips });
  }
}

function steer(f, input, gamma, rho, s, dt) {
  const control = f.dizzy > 0 ? 0.35 : 1;
  let dTheta;
  if (f.flapping) {
    // While flapping the nose points up the climb instead of spinning in loops.
    dTheta = wrapAngle(FLAP_ANGLE - f.angle) * Math.min(1, 6 * dt);
  } else if (input.pitch) {
    dTheta = clamp(input.pitch, -1, 1) * TURN_RATE * control * dt;
  } else {
    const vane = WEATHERVANE * clamp((rho * s) / 15, 0, 1);
    dTheta = wrapAngle(gamma - f.angle) * Math.min(1, vane * dt);
  }
  dTheta += f.spinV * dt;
  f.spinV *= Math.max(0, 1 - 3 * dt);
  f.angle = wrapAngle(f.angle + dTheta);
  countFlips(f, dTheta);
}

function stepAir(f, input, dt, world) {
  const st = f.stats;
  const h = Math.max(0, f.y);
  const rho = densityAt(h);
  let s = Math.hypot(f.vx, f.vy);
  const gamma = Math.atan2(f.vy, f.vx);
  f.flapping = Boolean(input.flap) && f.flap > 0 && !(input.boost && f.fuel > 0);
  steer(f, input, gamma, rho, s, dt);

  if (s > 0.05) {
    const alpha = wrapAngle(f.angle - gamma);
    const cl = Math.sin(2 * alpha);
    const brake = Math.max(0, Math.abs(Math.sin(alpha)) - 0.6);
    const q = rho * s * s;
    // Lift turns the velocity without changing its length (no free energy).
    const lift = clamp(q * st.qL * cl, -MAX_LIFT, MAX_LIFT);
    const turn = (lift * dt) / s;
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    const vx = f.vx * c - f.vy * sn;
    f.vy = f.vx * sn + f.vy * c;
    f.vx = vx;
    // Drag, integrated implicitly so it stays stable at any speed.
    const k = rho * (st.cdBody + st.qL * (st.K * cl * cl + 1.2 * brake * brake));
    const damp = 1 / (1 + k * s * dt);
    f.vx *= damp;
    f.vy *= damp;
  }

  f.boosting = Boolean(input.boost) && f.fuel > 0;
  if (f.boosting) {
    f.vx += Math.cos(f.angle) * st.thrust * dt;
    f.vy += Math.sin(f.angle) * st.thrust * dt;
    f.fuel = Math.max(0, f.fuel - dt);
    if (f.fuel === 0) emit(f, 'empty', {});
  }
  if (f.flapping) {
    if (f.vy < FLAP_MAX_CLIMB) f.vy += FLAP_ACC * dt;
    f.vx += 2 * dt;
    f.flap = Math.max(0, f.flap - dt);
    if (f.flap === 0) emit(f, 'tired', {});
  }
  f.vy -= gravityAt(h) * dt;

  s = Math.hypot(f.vx, f.vy);
  if (s > MAX_SPEED) {
    f.vx *= MAX_SPEED / s;
    f.vy *= MAX_SPEED / s;
  }
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (!f.boosting) f.glideDist += Math.max(0, f.vx) * dt;

  collideSky(f, world, dt, f.scratch);
  if (f.abduct) return;
  collideGroundFeatures(f, world.terrain);
  groundContact(f, world.terrain);
}

function groundContact(f, terrain) {
  const gy = terrain.height(f.x);
  if (f.y - PIG_R > gy) return;
  f.y = gy + PIG_R;
  const slope = terrain.slope(f.x);
  const len = Math.hypot(1, slope);
  const nx = -slope / len;
  const ny = 1 / len;
  const vn = f.vx * nx + f.vy * ny;
  if (vn >= 0) return;
  const vt = f.vx * ny - f.vy * nx;
  const speed = Math.hypot(f.vx, f.vy);
  const impact = Math.atan2(-vn, Math.abs(vt));
  const surface = terrain.surface(f.x);
  f.rotAcc = 0;
  if (flareReady(f) && speed >= FLARE_MIN_SPEED) {
    flare(f, Math.atan(slope), speed, 'flare');
    return;
  }
  if (f.starterBlasts > 0 && surface !== 'pond') {
    starterBlast(f, gy);
    return;
  }

  if (surface === 'mud') {
    f.vx = 0;
    f.vy = 0;
    setFace(f, 'splat', 9);
    emit(f, 'mud', { x: f.x, y: f.y });
    end(f, 'mud');
    return;
  }
  if (surface === 'pond') {
    if (speed > 12 && impact < 0.35) {
      bounce(f, nx, ny, vn, vt, 0.6, 0.85, 'skip');
      return;
    }
    emit(f, 'splash', { x: f.x, y: f.y, big: true });
    f.vx = 0;
    f.vy = 0;
    end(f, 'splash');
    return;
  }
  const skim = speed > SKIM_SPEED && impact < SKIM_ANGLE;
  if (skim) {
    bounce(f, nx, ny, vn, vt, f.stats.restitution, 0.92, 'bounce');
    if (Math.abs(f.vx * nx + f.vy * ny) > 2) return;
  } else {
    emit(f, 'thud', { x: f.x, y: f.y, speed });
  }
  // Face-plant or a skid: slide along the ground from here.
  f.grounded = true;
  const along = f.vx * ny - f.vy * nx;
  f.vx = along * ny * (skim ? 1 : 0.6);
  f.vy = 0;
  setFace(f, 'splat', 9);
}

const flareReady = (f) => f.t - f.pressT <= FLARE_WINDOW;

// A hidden TNT charge goes off where the pig lands (first flights only):
// the new player's first touchdown is an explosion, not a flop.
const STARTER_KICK_X = 16;
const STARTER_KICK_Y = 20;
const STARTER_COINS = 5;
function starterBlast(f, groundY) {
  f.starterBlasts -= 1;
  f.vx = Math.max(f.vx, 8) + STARTER_KICK_X;
  f.vy = Math.max(f.vy, 0) + STARTER_KICK_Y;
  f.y = groundY + PIG_R + 0.3;
  f.grounded = false;
  f.rotAcc = 0;
  f.coins += STARTER_COINS;
  f.tnts += 1;
  refillFlap(f, 1);
  setFace(f, 'scared', 1.2);
  emit(f, 'tnt', { x: f.x, y: groundY + 0.9, coins: STARTER_COINS, surprise: true });
}

// Perfect bounce off the ground at a fixed climb angle, keeping most speed.
function flare(f, groundAngle, speed, kind) {
  const s = speed * FLARE_KEEP;
  const a = groundAngle + FLARE_ANGLE;
  f.vx = Math.cos(a) * s;
  f.vy = Math.sin(a) * s;
  f.angle = a;
  f.grounded = false;
  f.pressT = -9;
  f.flares += 1;
  f.bounces += 1;
  f.y += 0.05;
  setFace(f, 'happy', 0.9);
  emit(f, kind, { x: f.x, y: f.y, n: f.flares, speed: s });
}

function bounce(f, nx, ny, vn, vt, restitution, keepT, kind) {
  const vn2 = -vn * restitution;
  const vt2 = vt * keepT;
  f.vx = vt2 * ny + vn2 * nx;
  f.vy = -vt2 * nx + vn2 * ny;
  f.bounces += 1;
  setFace(f, 'happy', 0.5);
  emit(f, kind, { x: f.x, y: f.y, speed: Math.hypot(f.vx, f.vy) });
}

function stepGround(f, dt, world) {
  const terrain = world.terrain;
  const surface = terrain.surface(f.x);
  if (surface === 'mud') {
    f.vx = 0;
    emit(f, 'mud', { x: f.x, y: f.y });
    end(f, 'mud');
    return;
  }
  if (surface === 'pond') {
    if (Math.abs(f.vx) > 10) {
      f.grounded = false;
      f.vy = 3.5;
      f.vx *= 0.85;
      f.bounces += 1;
      emit(f, 'skip', { x: f.x, y: f.y });
    } else {
      f.vx = 0;
      emit(f, 'splash', { x: f.x, y: f.y, big: true });
      end(f, 'splash');
    }
    return;
  }
  const slope = terrain.slope(f.x);
  const ang = Math.atan(slope);
  if (flareReady(f) && Math.abs(f.vx) >= HOP_MIN_SPEED) {
    flare(f, ang, Math.abs(f.vx) * 0.8, 'hop');
    return;
  }
  const dir = Math.sign(f.vx);
  f.vx -= dir * GRASS_FRICTION * dt + gravityAt(0) * Math.sin(ang) * Math.cos(ang) * dt;
  if (Math.sign(f.vx) !== dir) f.vx = 0;
  f.x += f.vx * dt;
  f.y = terrain.height(f.x) + PIG_R;
  f.angle += wrapAngle(ang - f.angle) * Math.min(1, 10 * dt);
  // Pickups along the ground (the starter coin trail) count while sliding too.
  collideSky(f, world, dt, f.scratch);
  f.distance = Math.max(f.distance, f.x);
  if (collideGroundFeatures(f, terrain)) return;
  if (Math.abs(f.vx) < END_SPEED) end(f, 'landed');
}

function track(f) {
  f.maxAlt = Math.max(f.maxAlt, f.y);
  f.distance = Math.max(f.distance, f.x);
  const s = Math.hypot(f.vx, f.vy);
  if (s > f.topSpeed) f.topSpeed = s;
  if (!f.sonic && s >= SONIC) {
    f.sonic = true;
    emit(f, 'sonic', { x: f.x, y: f.y });
  }
  const layer = layerIndexAt(f.y);
  if (layer > f.maxLayer) {
    f.maxLayer = layer;
    emit(f, 'layer', { index: layer });
  }
  if (f.y >= MOON_ALT) {
    f.moon = true;
    f.maxAlt = MOON_ALT;
    emit(f, 'moon', { x: f.x, y: f.y });
    end(f, 'moon');
  }
}

export function stepFlight(f, input, dt, world) {
  if (f.done) return;
  f.t += dt;
  // Only real taps arm a flare (the autopilot never sets `pressed`).
  if (input.pressed) f.pressT = f.t;
  f.upHeld = input.pitch > 0;
  f.hitCd = Math.max(0, f.hitCd - dt);
  f.dizzy = Math.max(0, f.dizzy - dt);
  f.faceT -= dt;
  if (f.faceT <= 0 && f.face !== 'splat') f.face = f.boosting ? 'determined' : 'normal';
  if (f.abduct) {
    stepAbduction(f, dt);
  } else if (f.grounded) {
    f.boosting = false;
    stepGround(f, dt, world);
  } else {
    stepAir(f, input, dt, world);
  }
  if (f.done) return;
  track(f);
  if (f.t > MAX_FLIGHT_TIME) end(f, 'landed');
}

// Glide at the best lift-to-drag angle, never boost (used by "Skip").
export function autopilot(f) {
  const st = f.stats;
  const cl = Math.min(1, Math.sqrt(st.cdBody / (st.qL * st.K)));
  const alpha = 0.5 * Math.asin(cl);
  const gamma = Math.atan2(f.vy, f.vx);
  const diff = wrapAngle(gamma + alpha - f.angle);
  return { pitch: Math.abs(diff) < 0.03 ? 0 : Math.sign(diff), boost: false };
}

export function canSkip(f) {
  return !f.done && !f.grounded && !f.abduct && f.vy < 0 && f.y > 40 && f.t > 1.5;
}

// Runs the rest of the flight instantly with the autopilot.
export function simulateToEnd(f, world, maxSteps = 240000) {
  f.quiet = true;
  for (let i = 0; i < maxSteps && !f.done; i++) stepFlight(f, autopilot(f), STEP, world);
  f.quiet = false;
  if (!f.done) end(f, 'landed');
}

// "Second wind": bounce back up from where the pig landed (rewarded ad).
export function rebound(f, world) {
  const speed = 0.75 * f.stats.launchSpeed + 12;
  const a = (50 * Math.PI) / 180;
  f.done = false;
  f.cause = null;
  f.grounded = false;
  f.rebounded = true;
  f.y = world.terrain.height(f.x) + PIG_R + 1.5;
  f.vx = Math.cos(a) * speed;
  f.vy = Math.sin(a) * speed;
  f.angle = a;
  f.rotAcc = 0;
  f.fuel = Math.max(f.fuel, f.fuelMax * 0.5);
  setFace(f, 'determined', 1.2);
  emit(f, 'rebound', { x: f.x, y: f.y });
}

export function summarize(f) {
  return Object.freeze({
    distance: Math.max(0, f.distance),
    maxAlt: Math.max(0, f.maxAlt),
    topSpeed: f.topSpeed,
    coins: f.coins,
    flips: f.flips,
    balloons: f.balloons,
    chainBonus: f.chainBonus,
    surfs: f.surfs,
    abductions: f.abductions,
    bounces: f.bounces,
    flares: f.flares,
    tnts: f.tnts,
    bestCombo: f.bestCombo,
    glideDist: f.glideDist,
    fuelCans: f.fuelCans,
    hazards: f.hazards,
    perfect: f.perfect,
    moon: f.moon,
    time: f.t,
    cause: f.cause,
  });
}

export { scaleAt };
