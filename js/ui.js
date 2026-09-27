// DOM layer: HUD, launch screen, banners, toasts, hints and screen switching.

import { MOON_ALT, formatDistance, formatInt, kmh } from './config.js';
import { missionText, missionValue } from './missions.js';
import { nextMedal, medalText, affordableCount } from './economy.js';
import { createPanels } from './panels.js';
import { logoHTML } from './logo.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['ready', 'results', 'barn', 'records', 'pause', 'moonwin', 'daily'];

export function createUI(handlers) {
  const el = {
    hud: $('hud'), alt: $('hud-alt'), speed: $('hud-speed'), dist: $('hud-dist'), coins: $('hud-coins'),
    coinPill: document.querySelector('.coin-pill'), fuel: $('fuel'), fuelFill: $('fuel-fill'), skip: $('btn-skip'),
    moonFill: $('moon-fill'), moonBest: $('moon-best'), moonPig: $('moon-pig'),
    needle: $('needle'), tap: $('tap-text'), hint: $('hint'),
    boostBtn: $('btn-boost'), controls: $('controls'), combo: $('combo'), comboX: $('combo-x'),
    coach: $('coach'), coachTitle: $('coach-title'), coachSub: $('coach-sub'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerKicker: $('banner-kicker'), toasts: $('toasts'),
    readyBest: $('ready-best'), readyCoins: $('ready-coins'), readyMedal: $('ready-medal'), missions: $('missions'),
    barnBadge: $('barn-badge'), barnBadge2: $('barn-badge2'), golden: $('btn-golden'), goldenOn: $('golden-on'),
    adShade: $('ad-shade'), boot: $('boot'),
  };
  let bannerTimer = null;
  let bannerUntil = 0;
  let sixTimer = null;
  let lastCoins = -1;
  let lastHud = '';

  const on = (id, fn) => $(id).addEventListener('click', (e) => {
    e.stopPropagation();
    fn(e);
  });
  on('btn-pause', handlers.onPause);
  on('btn-sound', handlers.onSound);
  on('btn-skip', handlers.onSkip);
  on('btn-barn', handlers.onBarn);
  on('btn-records', handlers.onRecords);
  on('btn-golden', handlers.onGolden);
  on('btn-resume', handlers.onResume);
  on('btn-quit', handlers.onQuit);
  on('btn-moon-ok', handlers.onMoonOk);
  on('btn-daily', handlers.onDaily);
  // Buttons must not leak pointer events to the canvas (that would launch or steer).
  document.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));

  const panels = createPanels(handlers);
  $('game-logo').innerHTML = logoHTML();

  function show(name) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
  }

  return {
    panels,
    show,
    hideAll() { show(null); },
    booted() { el.boot.classList.add('hidden'); },
    hud(visible) { el.hud.classList.toggle('hidden', !visible); },
    // In-flight controls: boost button (with a rocket) and, for new
    // players, a legend that says exactly what to press.
    controls(visible, { rocket = false, touch = false, legend = false } = {}) {
      document.body.classList.toggle('touch-ui', touch);
      el.boostBtn.classList.toggle('hidden', !visible || !rocket);
      el.controls.classList.toggle('hidden', !visible || !legend);
      if (visible && legend) {
        const hold = touch ? 'HOLD screen' : 'HOLD W / ↑ / SPACE / click';
        const dive = touch ? 'LET GO' : 'LET GO or S / ↓';
        el.controls.innerHTML = `<span><b>${hold}</b> = fly up</span><span><b>${dive}</b> = dive</span>`
          + `<span><b>TAP</b> before landing = bounce</span>${rocket ? `<span><b>${touch ? '🚀 button' : 'SHIFT'}</b> = boost</span>` : ''}`;
      }
      if (!visible) this.combo(1);
    },
    boostEmpty(empty) { el.boostBtn.classList.toggle('empty', empty); },
    combo(mult) {
      const on = mult > 1;
      el.combo.classList.toggle('hidden', !on);
      if (on && el.comboX.textContent !== `x${mult}`) {
        el.comboX.textContent = `x${mult}`;
        el.combo.classList.remove('pop');
        void el.combo.offsetWidth;
        el.combo.classList.add('pop');
      }
    },
    // Big slow-motion instruction; coach(null) hides it.
    coach(title, sub = '', { release = false } = {}) {
      el.coach.classList.toggle('hidden', !title);
      document.body.classList.toggle('coaching', Boolean(title));
      if (!title) return;
      el.banner.classList.remove('show');
      el.coachTitle.textContent = title;
      el.coachSub.textContent = sub;
      el.coach.classList.toggle('release', release);
    },
    setMuted(m) { document.body.classList.toggle('muted', m); },
    adShade(onOff) { el.adShade.classList.toggle('hidden', !onOff); },

    updateHud(h) {
      const key = `${Math.floor(h.alt)}|${kmh(h.speed)}|${Math.floor(h.dist)}|${h.coins}|${Math.round((h.fuel / (h.fuelMax || 1)) * 100)}|${h.canSkip}`;
      if (key === lastHud) return;
      lastHud = key;
      el.alt.textContent = formatDistance(Math.max(0, h.alt));
      el.speed.textContent = `${kmh(h.speed)} km/h`;
      el.dist.textContent = formatDistance(h.dist);
      if (h.coins !== lastCoins) {
        el.coins.textContent = formatInt(h.coins);
        if (lastCoins >= 0 && h.coins > lastCoins) {
          el.coinPill.classList.remove('bump');
          void el.coinPill.offsetWidth;
          el.coinPill.classList.add('bump');
        }
        lastCoins = h.coins;
      }
      el.fuel.classList.toggle('hidden', !h.fuelMax);
      if (h.fuelMax) {
        const k = h.fuel / h.fuelMax;
        el.fuelFill.style.width = `${k * 100}%`;
        el.fuel.classList.toggle('low', k > 0 && k < 0.2);
      }
      el.skip.classList.toggle('hidden', !h.canSkip);
      const p = (a) => `${Math.min(100, (Math.max(0, a) / MOON_ALT) * 100)}%`;
      el.moonFill.style.height = p(h.alt);
      el.moonPig.style.bottom = p(h.alt);
      el.moonBest.style.bottom = p(h.best);
    },
    resetHud() {
      lastCoins = -1;
      lastHud = '';
    },

    needle(v) { el.needle.style.left = `${v * 100}%`; },
    tapText(text) { el.tap.textContent = text; },

    ready(save, { golden, goldenOffer }) {
      el.readyBest.textContent = formatDistance(save.best.alt);
      el.readyCoins.textContent = formatInt(save.coins);
      const m = nextMedal(save.medals, 'alt');
      const pct = Math.min(100, (save.best.alt / MOON_ALT) * 100);
      $('mg-fill').style.width = `${pct}%`;
      $('mg-pig').style.left = `${pct}%`;
      $('mg-text').textContent = save.moon
        ? 'You made it to the Moon! Now beat your records.'
        : save.best.alt < 1 ? 'The Moon is 10 km up. Every flight earns coins for upgrades!'
          : `Your best: ${formatDistance(save.best.alt)} of 10 km (${pct < 1 ? pct.toFixed(1) : Math.floor(pct)}% of the way)`;
      el.readyMedal.textContent = save.moon
        ? 'You reached the Moon! Go for records and medals.'
        : m ? `Next medal: ${m.name} (${medalText(m)}) +${formatInt(m.reward)}` : '';
      el.missions.innerHTML = '<h4>SIDE QUESTS</h4>' + save.missions.active.map((mi) => `
        <div class="mission"><div class="m-text">${missionText(mi)}</div><div class="m-reward"><span class="coin-icon"></span>${formatInt(mi.reward)}</div></div>`).join('');
      this.badge(affordableCount(save));
      el.golden.classList.toggle('hidden', !goldenOffer || golden);
      el.goldenOn.classList.toggle('hidden', !golden);
      // First visit: strip the menu down to the pig, the goal and one big "tap".
      $('ready').classList.toggle('first', save.flights === 0);
      show('ready');
    },
    readyVisible() { return !$('ready').classList.contains('hidden'); },
    badge(n) {
      for (const b of [el.barnBadge, el.barnBadge2]) {
        b.textContent = String(n);
        b.classList.toggle('hidden', n <= 0);
      }
    },

    banner(title, kicker = '', ms = 1400) {
      el.bannerTitle.textContent = title;
      el.bannerKicker.textContent = kicker;
      el.banner.classList.remove('show');
      void el.banner.offsetWidth;
      el.banner.classList.add('show');
      clearTimeout(bannerTimer);
      bannerUntil = performance.now() + ms;
      bannerTimer = setTimeout(() => el.banner.classList.remove('show'), ms);
    },
    // Big "6 7" callout with the two-hands weighing gesture.
    // Waits for any banner to finish so callouts never stack; hides the hint meanwhile.
    sixSeven(what) {
      const wait = Math.max(0, bannerUntil - performance.now());
      const el6 = document.getElementById('six-seven');
      clearTimeout(sixTimer);
      sixTimer = setTimeout(() => {
        el6.querySelector('.what').textContent = what;
        el6.classList.remove('show');
        void el6.offsetWidth;
        el6.classList.add('show');
        document.body.classList.add('six-on');
        sixTimer = setTimeout(() => { el6.classList.remove('show'); document.body.classList.remove('six-on'); }, 1900);
      }, wait);
    },
    // Daily chest modal: 7 cells, today's chest highlighted.
    daily(st) {
      const row = $('daily-row');
      row.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const d = i + 1;
        const cls = d < st.day ? 'done' : d === st.day ? 'today' : '';
        return `<div class="d ${cls}"><span class="chest">${d < st.day ? '✅' : d === 7 ? '👑' : '🎁'}</span>Day<b>${d}</b></div>`;
      }).join('');
      $('daily-sub').textContent = st.day > 1 ? `${st.day} days in a row! Keep the streak going.` : 'Come back every day. Bigger chest each day in a row!';
      $('daily-amt').textContent = `+${formatInt(st.reward)} coins`;
      show('daily');
    },
    toast(html) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = html;
      el.toasts.appendChild(t);
      setTimeout(() => t.remove(), 2700);
    },
    hint(text) {
      el.hint.classList.toggle('hidden', !text);
      if (text) el.hint.textContent = text;
    },
    missionProgress(active, summary) {
      return active.map((m) => ({ m, v: missionValue(m, summary) }));
    },
  };
}
