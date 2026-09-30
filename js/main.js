// Boot, state machine and main loop.
import { STEP, PIG_R, LAUNCH_ANGLE, MOON_ALT, scaleAt, formatInt, formatDistance } from './config.js';
import { createWorld } from './world.js';
import { SEG } from './terrain.js';
import { createFlight, stepFlight, canSkip, simulateToEnd, rebound, summarize } from './physics.js';
import { needleAt, meterPeriod, launchZone, launchPower } from './launch.js';
import { nextGoal, affordableCount, bestAffordable } from './economy.js';
import { missionDone, missionText } from './missions.js';
import { skinById, upgradeById } from './upgrades.js';
import {
  DEFAULT_SAVE, createStorage, recordFlight, buyUpgrade, buySkin, addCoins, markTip, statsOf, update,
} from './save.js';
import { initSdk, Sdk } from './sdk.js';
import { dailyStatus, claimDaily, dayKey } from './daily.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render3d.js';
import { createCamera, snapToReady, updateCamera } from './camera.js';
import { createFx } from './fx.js';
import { createInput, LAUNCH_KEYS } from './input.js';
import { createUI } from './ui.js';
import { createJuice } from './juice.js';
import { botInput } from './bot.js';
import { createCoach, landingCue } from './coach.js';
import { updateRush } from './rush.js';
import { goalAt, goalReward, goalValue, goalText } from './goals.js';
import { nudges } from './nudge.js';

const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.has('debug');
// ?sandbox keeps the save in memory only (testing without touching real progress).
const SANDBOX = DEBUG && PARAMS.has('sandbox');
const CAUSES = {
  landed: 'Pip ran out of zoom.',
  mud: 'face-first in the mud. skill issue.',
  splash: 'Pip went for a swim. glub glub.',
  quit: 'you ended it early (valid)',
  moon: 'Pip actually made it to the Moon. history.',
};

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const audio = createAudio();
const fx = createFx();
let storage = createStorage({ getItem: () => null, setItem: () => {} });
let save = DEFAULT_SAVE;

const S = {
  mode: 'boot', t: 0, cam: createCamera(), world: createWorld(1), flight: null,
  meterT: 0, pull: 0, launchKick: 0, farmerCheer: 0, trampT: new Map(), trail: [], trailT: 0,
  squash: 0, golden: false, banked: null, result: null, doubled: false, backTo: 'ready',
  prevBest: 0, recordShown: false, shownMissions: new Set(), hintUntil: 0, hintKind: null,
  username: null, adBusy: false, autoplay: false, endTimer: 0, sixSeven: new Set(), modal: false,
  coachScale: 1, cue: null, resultsAt: 0, boostEmpty: false,
};

// CrazyGames Basic Launch does not allow ads: keep this false until the game is
// moved to Full Launch, then set it to true (or test with ?debug&ads).
const ADS_ENABLED = false;
// New players get a big LAUNCH button; if nobody clicks for a few seconds it
// grows and shakes. It never launches by itself.
const IDLE_NUDGE_S = 3;
const END_PAUSE = 0.55;
// New players: the first flights skip the results card (straight back to the
// launcher), start with surprise TNT under the landing spot, and never launch
// too weakly. Flight 1 also ends with a free upgrade.
const QUICK_FLIGHTS = 3;
const QUICK_PAUSE = 1.4;
const STARTER_POWER = 0.9;
const starterBlastsFor = (flights) => (flights < 2 ? 2 : flights < 5 ? 1 : 0);
// Distance milestones pay a little bonus the moment they are crossed.
const MILESTONES = [25, 50, 150, 250, 300, 400, 600, 900, 1250, 2500, 4000, 7500, 10000];
const milestoneBonus = (m) => Math.max(2, Math.round(m / 25));
const RESULTS_KEY_DELAY = 600;
const canAds = () => (ADS_ENABLED && Sdk.available) || (DEBUG && PARAMS.has('ads'));
const hasRocket = () => (save.upgrades.rocket || 0) > 0;

function persist(next) {
  save = next;
  storage.persist(save);
  ui.badge(affordableCount(save));
}

// ---------- ads ----------
// Resolves true when the ad finished (rewarded: grant the reward), false otherwise.
async function showAd(type) {
  if (S.adBusy) return false;
  S.adBusy = true;
  adButtonsBusy(true);
  const onStart = () => { audio.setAdMuted(true); ui.adShade(true); };
  const onEnd = () => { audio.setAdMuted(false); ui.adShade(false); };
  let ok;
  if (Sdk.available) {
    ok = await Sdk.requestAd(type, { onStart, onEnd });
  } else if (DEBUG) {
    onStart();
    await new Promise((r) => setTimeout(r, 700));
    onEnd();
    ok = true;
  } else {
    ok = false;
  }
  S.adBusy = false;
  adButtonsBusy(false);
  if (!ok && type === 'rewarded') ui.toast('No ad available right now. Try again later.');
  return ok;
}

// Rewarded-ad buttons stay disabled while any ad is running.
function adButtonsBusy(busy) {
  for (const id of ['btn-double', 'btn-wind', 'btn-golden']) document.getElementById(id).disabled = busy;
}

// ---------- screens ----------
function newReady() {
  S.mode = 'ready';
  S.world = createWorld((Math.random() * 2 ** 31) >>> 0);
  S.flight = null;
  S.trail = [];
  S.meterT = Math.random();
  S.banked = null;
  S.result = null;
  S.doubled = false;
  S.farmerCheer = 0;
  S.launchKick = 0;
  fx.reset();
  snapToReady(S.cam, renderer.view.W, renderer.view.H);
  ui.hud(false);
  ui.controls(false);
  coach.stop();
  S.coachScale = 1;
  S.cue = null;
  ui.hint(null);
  S.readyT = 0;
  S.idleShown = false;
  ui.readyIdle(false);
  ui.ready(save, { golden: S.golden, goldenOffer: canAds() && hasRocket() && save.flights >= 2 });
  ui.tapText(save.flights < 2 ? 'or tap anywhere' : 'Tap / SPACE to YEET');
  maybeShowDaily();
  // The launch screen is playable (timing the power meter), so it counts as gameplay.
  Sdk.gameplayStart();
}

// Daily chest: offered on the launch screen once per day, from the second visit on.
function maybeShowDaily() {
  if (save.flights < QUICK_FLIGHTS || S.adBusy) return;
  const st = dailyStatus(save, dayKey());
  if (!st.available) return;
  S.modal = true;
  ui.daily(st);
}

function claimChest() {
  const r = claimDaily(save, dayKey());
  S.modal = false;
  if (r.ok) {
    persist(update(addCoins(save, r.coins), { daily: r.daily }));
    audio.medal();
    fx.burst(0, 30, 50, { colors: ['#ffd23f', '#ff7aa2', '#b8ff2e', '#26e0ff'], speed: 16, life: 1.4, size: 8, kind: 'confetti', gravity: 9 });
    ui.toast(`<b>+${formatInt(r.coins)}</b> coins from the Day ${r.day} chest!`);
  }
  ui.ready(save, { golden: S.golden, goldenOffer: canAds() && hasRocket() && save.flights >= 2 });
}

function launch() {
  audio.unlock();
  audio.startMusic();
  const v = needleAt(S.meterT, meterPeriod(save.flights));
  const zone = launchZone(v);
  const stats = statsOf(save);
  const power = save.flights < 2 ? Math.max(launchPower(v), STARTER_POWER) : launchPower(v);
  S.flight = createFlight(stats, { power, perfect: zone === 'perfect', golden: S.golden, starterBlasts: starterBlastsFor(save.flights) });
  S.golden = false;
  S.prevBest = save.best.alt;
  S.prevDist = save.best.dist;
  S.recordShown = false;
  S.shownMissions = new Set();
  S.sixSeven = new Set();
  S.hintKind = null;
  S.launchKick = 1;
  S.farmerCheer = -1;
  S.mode = 'flying';
  input.clear();
  input.resetFlags();
  juice.reset();
  ui.hideAll();
  ui.resetHud();
  ui.hud(true);
  showFlightControls();
  coach.start(save.tips, input.usedTouch);
  S.boostEmpty = false;
  ui.boostEmpty(false);
  const big = (stats.tiers.launcher || 0) >= 3;
  audio.launch(big);
  fx.shake(big ? 8 : 3);
  fx.burst(S.flight.x, S.flight.y, big ? 18 : 8, { colors: big ? ['#ffffff', '#dee2e6', '#ffd166'] : ['#ffffff'], speed: 10, life: 0.6, size: 7, kind: 'smoke', gravity: -2, dir: LAUNCH_ANGLE, spread: 1.2 });
  if (zone === 'perfect') {
    audio.perfect();
    audio.airhorn();
    fx.flash('255,255,255', 0.35);
    ui.banner('PERFECT!', '+1000 AURA', 1000);
  } else if (zone === 'weak' && save.flights > 0) {
    ui.banner('MID LAUNCH', 'tap in the green', 900);
  }
  if (save.flights === 0) ui.banner('FLY TO THE MOON!', 'your goal', 1500);
  if (!save.tips.includes('launch')) persist(markTip(save, 'launch'));
  Sdk.gameplayStart();
}

// New players who haven't clicked yet: after a few seconds the LAUNCH button
// grows and shakes and the text points at it (only on the minimal screen).
function nudgeIdle(realDt) {
  if (save.flights >= 2 || S.idleShown || S.adBusy || S.modal || !ui.readyVisible()) return;
  S.readyT += realDt;
  if (S.readyT < IDLE_NUDGE_S) return;
  S.idleShown = true;
  ui.readyIdle(true);
  ui.tapText('☝️ CLICK LAUNCH! ☝️');
}

function showFlightControls() {
  input.setRocket(hasRocket());
  ui.controls(true, { rocket: hasRocket(), touch: input.usedTouch });
}

function setHint(kind, text, seconds) {
  S.hintKind = kind;
  S.hintUntil = S.flight.t + seconds;
  ui.hint(text);
  persist(markTip(save, kind));
}

function updateHints() {
  const f = S.flight;
  const touch = input.usedTouch;
  if (!S.hintKind) {
    if (coach.active) return;
    if (hasRocket() && !save.tips.includes('boost') && f.t > 0.3) {
      setHint('boost', touch ? 'Hold the 🚀 BOOST button!' : 'Hold SPACE to BOOST!', 4);
    } else if (!save.tips.includes('skip') && canSkip(f) && f.y > 60) {
      setHint('skip', 'Tap Skip ⏩ to land right away', 3);
    }
    return;
  }
  if (S.hintKind === 'shown') {
    if (f.t > S.hintUntil) S.hintKind = null;
    return;
  }
  const doneEarly = S.hintKind === 'boost' && input.boosted;
  if (doneEarly || f.t > S.hintUntil || f.done) {
    ui.hint(null);
    S.hintKind = 'shown';
    S.hintUntil = f.t + 1.5;
  }
}

// "6 7" meme moments: altitude crossing 67 / 670 / 6,700 m, or exactly 67 coins.
const SIX_SEVEN_ALTS = [67, 670, 6700];
function sixSevenChecks() {
  const f = S.flight;
  for (const a of SIX_SEVEN_ALTS) {
    if (!S.sixSeven.has(a) && f.maxAlt >= a && f.maxAlt < a * 1.6) {
      S.sixSeven.add(a);
      ui.sixSeven(`${a.toLocaleString('en-US')} M`);
      audio.sixSeven();
      return;
    }
  }
  if (!S.sixSeven.has('coins') && f.coins === 67) {
    S.sixSeven.add('coins');
    ui.sixSeven('67 COINS');
    audio.sixSeven();
  }
}

function flyCoins(x, y, n) {
  const [sx, sy] = renderer.toScreen(x, y);
  for (let i = 0; i < n; i++) ui.flyCoin(sx + (Math.random() - 0.5) * 30 * (n > 1), sy + (Math.random() - 0.5) * 30 * (n > 1), i * 45);
}

function milestoneCheck() {
  const f = S.flight;
  const m = MILESTONES[f.milestone];
  if (m === undefined || f.distance < m) return;
  f.milestone += 1;
  const bonus = milestoneBonus(m);
  f.coins += bonus;
  audio.star();
  fx.text(f.x, f.y + 3 * scaleAt(f.y), `${formatDistance(m)}! +${bonus}`, { color: '#b8ff2e', size: 30 });
  flyCoins(f.x, f.y, Math.min(5, 1 + Math.floor(bonus / 4)));
}

// Goal ladder: always one short target on screen; hitting it celebrates,
// pays, and shows the next one immediately (several can fall in one flight).
function goalCheck() {
  const f = S.flight;
  const g = goalAt(save.goal);
  const v = goalValue(g, f);
  if (v < g.v) {
    ui.goalChip(goalText(g), v / g.v);
    return;
  }
  const reward = goalReward(g);
  persist(update(addCoins(save, reward), { goal: save.goal + 1 }));
  audio.medal();
  fx.flash('184,255,46', 0.25);
  fx.burst(f.x, f.y, 30, { colors: ['#b8ff2e', '#ffd23f', '#ff7aa2', '#26e0ff'], speed: 16, life: 1.1, size: 7, kind: 'confetti', gravity: 8, scale: scaleAt(f.y) });
  // Never stack on top of a coaching lesson: use floating text then.
  if (coach.active) fx.text(f.x, f.y + 5 * scaleAt(f.y), `GOAL COMPLETE! +${formatInt(reward)}`, { color: '#b8ff2e', size: 34, life: 1.4 });
  else ui.banner('GOAL COMPLETE!', `${goalText(g)} · +${formatInt(reward)} coins`, 1400);
  flyCoins(f.x, f.y, 6);
  const next = goalAt(save.goal);
  ui.goalChip(goalText(next), goalValue(next, f) / next.v, true);
}

function liveChecks() {
  const f = S.flight;
  milestoneCheck();
  goalCheck();
  sixSevenChecks();
  for (const m of save.missions.active) {
    if (!S.shownMissions.has(m.kind) && missionDone(m, f)) {
      S.shownMissions.add(m.kind);
      audio.mission();
      ui.toast(`Quest cleared: <b>${missionText(m)}</b> +${formatInt(m.reward)}`);
    }
  }
  if (!S.recordShown && S.prevBest >= 30 && f.maxAlt > S.prevBest) {
    S.recordShown = true;
    audio.record();
    ui.banner('NEW RECORD!', 'certified banger', 1500);
  }
}

function stepFlightFrame(dt) {
  const f = S.flight;
  const inp = S.autoplay ? botInput(f) : input.read();
  const groundAt = S.world.terrain.height;
  const c = coach.update(f, inp, !S.autoplay && input.holding, S.realDt, groundAt);
  S.coachScale = c.scale;
  for (const tip of c.done) persist(markTip(save, tip));
  const descending = f.vy < 0 && f.fuel <= 0 && !f.grounded;
  const warp = descending && f.y > 200 ? Math.min(4, 1 + (f.y - 200) / 400) : 1;
  let acc = dt * warp;
  while (acc > 0 && !f.done) {
    const h = Math.min(STEP, acc);
    stepFlight(f, inp, h, S.world);
    acc -= h;
  }
  for (const e of f.events) {
    if (e.type === 'coin' || e.type === 'tnt') flyCoins(e.x, e.y, e.type === 'tnt' ? 5 : 1);
    if (e.type === 'gift' && e.coins) flyCoins(e.x, e.y, 5);
    const out = juice.handle(e, f, S);
    if (out && out.squash) S.squash = out.squash;
    if (out && out.trampoline) S.trampT.set(Math.floor(f.x / SEG), S.t);
  }
  f.events.length = 0;

  S.trailT += dt;
  if (S.trailT > 0.035 && !f.grounded) {
    S.trailT = 0;
    S.trail.push({ x: f.x, y: f.y });
    if (S.trail.length > 36) S.trail.shift();
  }
  if (f.boosting) {
    const k = scaleAt(f.y);
    const back = PIG_R * k * 1.9;
    fx.puff(f.x - Math.cos(f.angle) * back, f.y - Math.sin(f.angle) * back, Math.random() < 0.5 ? '#ffffff' : '#ffd6a5', 6 + k * 2, k);
  }
  if (f.flapping && Math.random() < 0.3) {
    const k = scaleAt(f.y);
    fx.burst(f.x - Math.cos(f.angle) * k, f.y + 0.4 * k, 1, { colors: ['#ffffff', '#ffe7ef'], speed: 5, life: 0.7, size: 5, kind: 'feather', gravity: 3, scale: k });
  }
  if (f.grounded && Math.abs(f.vx) > 3 && Math.random() < 0.4) {
    fx.burst(f.x, f.y - PIG_R, 1, { colors: ['#b08968', '#8ac926'], speed: 4, life: 0.4, size: 4, gravity: 6 });
  }
  audio.flight({ speed: Math.hypot(f.vx, f.vy), boosting: f.boosting, rocketTier: f.stats.tiers.rocket || 0, active: !f.grounded });
  audio.setAltitude(f.y);
  ui.updateHud({
    alt: f.y, speed: Math.hypot(f.vx, f.vy), dist: Math.max(0, f.x), coins: f.coins, fuel: f.fuel, fuelMax: f.fuelMax, flap: f.flap, flapMax: f.flapMax,
    best: Math.max(save.best.alt, S.prevBest), canSkip: canSkip(f) && f.y > 60 && !S.autoplay,
  });
  if (!coach.active && !S.autoplay && updateRush(f, S.world, dt) === 'coins') {
    fx.text(f.x + f.vx * 1.2, f.y + 4 * scaleAt(f.y), 'COIN RUSH!', { color: '#ffd23f', size: 30 });
  }
  S.cue = coach.active ? null : landingCue(f, groundAt);
  const empty = f.fuelMax > 0 && f.fuel <= 0;
  if (empty !== S.boostEmpty) { S.boostEmpty = empty; ui.boostEmpty(empty); }
  updateHints();
  liveChecks();
  if (f.done) flightOver();
}

function flightOver() {
  const f = S.flight;
  S.mode = 'landed';
  S.quick = !f.moon && save.flights < QUICK_FLIGHTS;
  S.endTimer = f.moon ? 1.0 : S.quick ? QUICK_PAUSE : END_PAUSE;
  S.cue = null;
  S.coachScale = 1;
  coach.stop();
  ui.controls(false);
  ui.hint(null);
  audio.silence();
  Sdk.gameplayStop();
  const summary = summarize(f);
  const res = recordFlight(save, summary, { banked: S.banked });
  // Payout that contains "67" earns a +67 meme bonus.
  const sixSeven = String(res.payout.total).includes('67') ? 67 : 0;
  persist(sixSeven ? addCoins(res.save, sixSeven) : res.save);
  S.result = { ...res, summary, sixSeven, nudges: nudges(summary, save, { alt: S.prevBest, dist: S.prevDist }) };
  if (res.records.alt || res.medals.length || res.firstMoon) Sdk.happytime();
  if (!f.moon && f.cause !== 'quit') cashOut(f, res.payout.total + sixSeven);
  if (f.moon) {
    audio.moon();
    fx.flash('255,255,255', 0.9);
  }
}

// Big "+coins" pop over the wreck: the reward lands before the results card.
function cashOut(f, total) {
  const k = scaleAt(f.y);
  fx.text(f.x, f.y + 8 * k, `+${formatInt(total)} COINS`, { color: '#ffd23f', size: 50, life: 1.3, rise: 90 });
  fx.burst(f.x, f.y + 2 * k, 26, { colors: ['#ffe45c', '#ffcf1f', '#fff3b0'], speed: 15, life: 1, size: 7, kind: 'confetti', gravity: 10, dir: Math.PI / 2, spread: 2 });
  flyCoins(f.x, f.y, 8);
  setTimeout(() => audio.buy(), 150);
}

// Best affordable upgrade for the one-tap button (see economy.bestAffordable).
function quickOption() {
  const o = bestAffordable(save);
  return o ? { ...o, line: upgradeById(o.id).name } : null;
}

function quickUpgrade() {
  const o = quickOption();
  if (!o) return;
  const r = buyUpgrade(save, o.id);
  if (!r.ok) { audio.deny(); return; }
  persist(r.save);
  audio.buy();
  audio.medal();
  fx.flash('184,255,46', 0.35);
  ui.toast(`<b>${o.line}</b> upgraded to <b>${o.name}</b>! Fly farther!`);
  ui.panels.quickUpgrade(quickOption(), true);
  const goal = nextGoal(save);
  ui.panels.goalBar(goal ? { name: goal.name, cost: goal.cost, have: save.coins } : null);
  ui.badge(affordableCount(save));
}

// First flights: no results card. Coins, quests and records were already
// counted in flightOver; show a short toast and go straight back to launching.
function quickReturn() {
  // Quests were already toasted mid-flight (liveChecks); medals were not.
  const { payout: pay, medals, nudges: hooks } = S.result;
  for (const m of medals) ui.toast(`Medal: <b>${m.name}</b> +${formatInt(m.reward)}`);
  const free = save.flights === 1 && (save.upgrades.launcher || 0) === 0;
  newReady();
  ui.toast(`<b>+${formatInt(pay.total)}</b> coins! You have <b>${formatInt(save.coins)}</b>`);
  if (free) freeUpgrade();
  else for (const n of hooks) ui.toast(n);
}

// A gift after the very first flight: the next launch visibly goes farther.
function freeUpgrade() {
  persist(update(save, { upgrades: { ...save.upgrades, launcher: 1 } }));
  audio.medal();
  fx.flash('184,255,46', 0.3);
  ui.banner('FREE UPGRADE!', `${upgradeById('launcher').levels[1].name}: launch way harder`, 2200);
  ui.ready(save, { golden: S.golden, goldenOffer: canAds() && hasRocket() && save.flights >= 2 });
}

function resultsView() {
  const { payout: pay, records, medals, missions, summary, earned } = S.result;
  const f = S.flight;
  const lines = pay.lines.map((l) => ({
    ...l,
    rec: save.flights > 1 && ((l.id === 'altitude' && records.alt) || (l.id === 'distance' && records.dist) || (l.id === 'speed' && records.speed)),
  }));
  if (pay.mult > 1) lines.push({ label: 'Piggy Bank', detail: `×${pay.mult.toFixed(2)}`, amount: pay.total - pay.subtotal });
  const extras = [
    ...medals.map((m) => ({ kind: 'medal', text: `Medal: ${m.name} +${formatInt(m.reward)}` })),
    ...missions.map((m) => ({ kind: 'mission', text: `Quest cleared: ${missionText(m)} +${formatInt(m.reward)}` })),
  ];
  if (S.banked !== null) extras.unshift({ kind: 'medal', text: `Second wind earned +${formatInt(earned)}` });
  const moonPct = Math.min(100, (save.best.alt / MOON_ALT) * 100);
  if (!summary.moon) extras.push({ kind: 'mission', text: `🌕 Moon progress: ${moonPct < 1 ? moonPct.toFixed(1) : Math.floor(moonPct)}% (best ${formatDistance(save.best.alt)} of 10 km)` });
  const chest = dailyStatus(save, dayKey());
  if (!chest.available) extras.push({ kind: 'medal', text: `🎁 Come back tomorrow: Day ${chest.tomorrowDay} chest = +${formatInt(chest.tomorrow)} coins` });
  if (S.result.sixSeven) extras.unshift({ kind: 'mission', text: `🤲 6 7 bonus (payout had a 67) +67` });
  // "One more flight" hooks go first: near records, near upgrades, near goals.
  extras.unshift(...S.result.nudges.map((text) => ({ kind: 'nudge', text: `👉 ${text}` })));
  let title = 'not bad fr';
  if (summary.moon) title = 'TO THE MOON!';
  else if (records.alt && S.prevBest >= 30) title = 'BIG W. NEW RECORD';
  else if (summary.cause === 'mud') title = 'MUD MOMENT';
  else if (summary.cause === 'splash') title = 'SPLOOSH';
  else if (summary.maxAlt >= 1000) title = 'HUGE AURA';
  else if (summary.time < 6) title = 'L + SPLAT 💀';
  const goal = nextGoal(save);
  return {
    title, cause: CAUSES[summary.cause] || '', lines, total: pay.total, extras,
    goal: goal ? { name: goal.name, cost: goal.cost, have: save.coins } : null,
    canDouble: canAds() && pay.total > 0 && !S.doubled,
    canWind: canAds() && !summary.moon && !f.rebounded && summary.cause !== 'quit',
  };
}

function showResults() {
  S.mode = 'results';
  S.resultsAt = performance.now();
  ui.hud(false);
  ui.controls(false);
  ui.panels.results(resultsView(), { tick: (i) => audio.tick(i), done: () => audio.buy() });
  ui.panels.quickUpgrade(quickOption());
  ui.show('results');
  ui.badge(affordableCount(save));
  const r = S.result;
  if (r.sixSeven) setTimeout(() => audio.sixSeven(), 700);
  if (r.medals.length) {
    audio.medal();
    fx.burst(S.flight.x, S.flight.y + 3, 50, { colors: ['#ffd23f', '#ff7aa2', '#80ed99', '#9bf6ff'], speed: 16, life: 1.6, size: 8, kind: 'confetti', gravity: 9, scale: scaleAt(S.flight.y) });
  }
}

// Shop and records carry their own "Yeet again": straight into a new flight
// from the results, or back to the launch screen when opened from there.
function setYeetLabels() {
  const text = S.mode === 'results' ? 'Yeet again' : 'Go yeet!';
  for (const id of ['btn-barn-yeet', 'btn-records-yeet']) document.getElementById(id).textContent = text;
}

async function yeetAgain() {
  audio.click();
  if (canAds() && Sdk.shouldShowMidgame(save.flights)) {
    Sdk.markMidgame();
    await showAd('midgame');
  }
  newReady();
}

function openBarn(from) {
  S.backTo = from;
  setYeetLabels();
  Sdk.gameplayStop();
  ui.panels.barn(save);
  ui.show('barn');
}

function closeBarn() {
  if (S.backTo === 'results') {
    ui.show('results');
    ui.badge(affordableCount(save));
  } else {
    ui.ready(save, { golden: S.golden, goldenOffer: canAds() && hasRocket() && save.flights >= 2 });
    Sdk.gameplayStart();
  }
}

function pause() {
  if (S.mode !== 'flying') return;
  S.mode = 'paused';
  audio.silence();
  Sdk.gameplayStop();
  ui.show('pause');
}

function resume() {
  if (S.mode !== 'paused') return;
  S.mode = 'flying';
  input.clear();
  ui.hideAll();
  Sdk.gameplayStart();
}

// ---------- wiring ----------
const ui = createUI({
  onPause: pause,
  onSound() {
    audio.unlock();
    const m = !audio.muted;
    audio.setMuted(m);
    ui.setMuted(m);
    persist(update(save, { muted: m }));
  },
  onSkip() {
    const f = S.flight;
    if (S.mode !== 'flying' || !canSkip(f)) return;
    audio.click();
    simulateToEnd(f, S.world);
    S.cam.x = f.x;
    S.cam.y = f.y + 10;
    S.trail = [];
    flightOver();
  },
  onBarn() { audio.click(); openBarn(S.mode === 'results' ? 'results' : 'ready'); },
  onRecords() {
    audio.click();
    S.backTo = 'ready';
    setYeetLabels();
    Sdk.gameplayStop();
    ui.panels.records(save, S.username);
    ui.show('records');
  },
  onCloseRecords() { audio.click(); closeBarn(); },
  onCloseBarn() { audio.click(); closeBarn(); },
  onYeet() {
    if (S.mode === 'results') yeetAgain();
    else { audio.click(); closeBarn(); }
  },
  onTab() { audio.click(); ui.panels.barn(save); },
  onBuyUpgrade(id) {
    const r = buyUpgrade(save, id);
    if (!r.ok) { audio.deny(); return; }
    audio.buy();
    persist(r.save);
    ui.panels.barn(save);
  },
  onBuySkin(id) {
    const r = buySkin(save, id);
    if (!r.ok) { audio.deny(); return; }
    audio.buy();
    persist(r.save);
    ui.panels.barn(save);
  },
  async onGolden() {
    if (!(await showAd('rewarded'))) return;
    S.golden = true;
    audio.buy();
    ui.ready(save, { golden: true, goldenOffer: true });
  },
  async onDouble() {
    if (S.doubled || !S.result) return;
    document.getElementById('btn-double').disabled = true;
    if (!(await showAd('rewarded'))) { document.getElementById('btn-double').disabled = false; return; }
    S.doubled = true;
    const bonus = S.result.payout.total;
    persist(addCoins(save, bonus));
    audio.buy();
    ui.toast(`<b>+${formatInt(bonus)}</b> coins. stonks.`);
    ui.panels.skipCount(bonus * 2);
    document.getElementById('btn-double').classList.add('hidden');
  },
  async onWind() {
    if (!S.result || S.flight.rebounded) return;
    document.getElementById('btn-wind').disabled = true;
    if (!(await showAd('rewarded'))) { document.getElementById('btn-wind').disabled = false; return; }
    S.banked = S.result.payout.total;
    rebound(S.flight, S.world);
    S.mode = 'flying';
    ui.hideAll();
    ui.hud(true);
    showFlightControls();
    Sdk.gameplayStart();
  },
  onAgain: yeetAgain,
  onLaunch() {
    if (S.mode !== 'ready' || S.adBusy || S.modal) return;
    audio.unlock();
    audio.startMusic();
    launch();
  },
  onQuickUp: quickUpgrade,
  onResume: resume,
  onQuit() {
    if (S.mode !== 'paused') return;
    S.flight.done = true;
    S.flight.cause = 'quit';
    ui.hideAll();
    flightOver();
  },
  onMoonOk() { audio.click(); showResults(); },
  onDaily() { audio.click(); claimChest(); },
});

const input = createInput(canvas, {
  onAction(kind, code) {
    audio.unlock();
    if (S.mode === 'ready' && !S.adBusy && !S.modal) {
      if (kind === 'key' && !LAUNCH_KEYS.has(code)) return;
      launch();
    } else if (S.mode === 'results' && kind === 'key' && (code === 'Space' || code === 'Enter')
      && performance.now() - S.resultsAt > RESULTS_KEY_DELAY && !document.getElementById('results').classList.contains('hidden')) {
      document.getElementById('btn-again').click();
    }
  },
  onPause() {
    if (S.mode === 'flying') pause();
    else if (S.mode === 'paused') resume();
  },
  isTyping: () => false,
});

const juice = createJuice({ fx, audio, ui });
const coach = createCoach(ui);
input.bindBoost(document.getElementById('btn-boost'));

window.addEventListener('pointerdown', () => { audio.unlock(); audio.startMusic(); }, { once: true, capture: true });
window.addEventListener('keydown', () => { audio.unlock(); audio.startMusic(); }, { once: true, capture: true });

const AUTO_PAUSE = !(DEBUG && PARAMS.has('nopause'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && AUTO_PAUSE) pause();
});
// ?debug&nopause keeps flights running when the window loses focus (automated screenshots).
if (AUTO_PAUSE) window.addEventListener('blur', () => pause());
window.addEventListener('resize', () => renderer.resize());

// ---------- loop ----------
let last = performance.now();
function tick(realDt) {
  S.realDt = realDt;
  const dt = realDt * fx.timeScale() * (S.mode === 'flying' ? S.coachScale : 1);
  if (S.mode !== 'paused') S.t += dt;
  S.squash *= Math.max(0, 1 - dt * 8);
  S.launchKick = Math.max(0, S.launchKick - dt * 3);
  if (S.farmerCheer < 0) S.farmerCheer = Math.min(0, S.farmerCheer + dt * 0.6);

  if (S.mode === 'ready') {
    if (!S.adBusy) S.meterT += realDt;
    const v = needleAt(S.meterT, meterPeriod(save.flights));
    ui.needle(v);
    S.pull = 0.2 + v * 0.8;
    nudgeIdle(realDt);
  } else if (S.mode === 'flying') {
    stepFlightFrame(dt);
  } else if (S.mode === 'landed') {
    S.endTimer -= dt;
    if (S.endTimer <= 0) {
      if (S.flight.moon) {
        S.mode = 'moon';
        ui.hud(false);
        ui.show('moonwin');
      } else if (S.quick) {
        quickReturn();
      } else {
        showResults();
      }
    }
  }
  if (S.mode !== 'paused') fx.update(dt);

  updateCamera(S.cam, renderer.view.W, renderer.view.H, dt, {
    mode: S.mode === 'ready' ? 'ready' : 'flight', pig: S.flight, groundAt: S.world.terrain.height,
  });
}

function draw() {
  const f = S.flight;
  renderer.frame({
    ...S, mode: S.mode === 'landed' || S.mode === 'results' ? 'flying' : S.mode,
    fx, skin: skinById(save.skin), tiers: save.upgrades, hasRocket: hasRocket(), bestAlt: Math.max(save.best.alt, S.prevBest),
    face: f ? f.face : 'happy', boosting: f ? f.boosting : false, flapping: Boolean(f && f.flapping && S.mode === 'flying'),
  });
}

// The next frame is scheduled first and each frame is guarded: one bad frame
// must never freeze the game. If errors keep repeating, the flight is dropped
// and the player is put back on the launch screen (progress is saved).
const MAX_BAD_FRAMES = 30;
let badFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  runFrame(dt);
}

function runFrame(dt) {
  try {
    tick(dt);
    draw();
    badFrames = 0;
  } catch (err) {
    badFrames += 1;
    if (badFrames === 1) console.error('[loop] frame failed', err);
    if (badFrames >= MAX_BAD_FRAMES) recoverFromErrors();
  }
}

function recoverFromErrors() {
  badFrames = 0;
  try {
    ui.hideAll();
    newReady();
  } catch (err) {
    console.error('[loop] recovery failed, reloading', err);
    location.reload();
  }
}

// ---------- boot ----------
async function boot() {
  await initSdk();
  Sdk.loadingStart();
  try {
    await loadGame();
  } finally {
    Sdk.loadingStop();
  }
  ui.booted();
  newReady();
  if (DEBUG) exposeDebug();
  requestAnimationFrame(loop);
}

async function loadGame() {
  const mem = new Map();
  storage = createStorage(SANDBOX ? { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) } : Sdk.storageBackend());
  save = storage.load();
  audio.setMuted(save.muted);
  ui.setMuted(save.muted);
  Sdk.onSettings((settings) => {
    if (settings && typeof settings.muteAudio === 'boolean') audio.setMuted(settings.muteAudio || save.muted);
  });
  S.username = await Sdk.username();
}

function exposeDebug() {
  window.wpf = {
    get save() { return save; },
    get state() { return S; },
    coins(n) { persist(addCoins(save, n)); newReady(); },
    maxAll() {
      const ups = Object.fromEntries(Object.keys(save.upgrades).map((k) => [k, 99]));
      persist(update(save, { upgrades: ups, coins: save.coins + 100000 }));
      newReady();
    },
    reset() { persist(DEFAULT_SAVE); newReady(); },
    tiers(t) { persist(update(save, { upgrades: { ...save.upgrades, ...t } })); newReady(); },
    autoplay(on = true) { S.autoplay = on; },
    // Advances the game by `seconds` at a fixed 60 fps, independent of rAF.
    step(seconds, fps = 60) {
      for (let i = 0; i < seconds * fps; i++) tick(1 / fps);
      draw();
      return S.mode;
    },
    launch,
    // One guarded frame, exactly like the real loop (tests error recovery).
    frame: (dt = 1 / 60) => { runFrame(dt); return S.mode; },
  };
}

boot().catch((err) => {
  console.error('[boot] failed', err);
  ui.booted();
  newReady();
  requestAnimationFrame(loop);
});
