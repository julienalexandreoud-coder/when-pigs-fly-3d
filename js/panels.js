// Results (with count-up), the Barn shop and the Records screen.

import { UPGRADES, SKINS, maxLevel, statText, isLocked } from './upgrades.js';
import { MEDALS, medalText } from './economy.js';
import { missionText } from './missions.js';
import { formatDistance, formatInt, kmh } from './config.js';
import { upgradeIcon, skinIcon } from './art/icons.js';

const $ = (id) => document.getElementById(id);

export function createPanels(handlers) {
  let countTimer = null;
  let barnTab = 'upgrades';

  $('btn-double').addEventListener('click', handlers.onDouble);
  $('btn-wind').addEventListener('click', handlers.onWind);
  $('btn-again').addEventListener('click', handlers.onAgain);
  $('btn-quick-up').addEventListener('click', handlers.onQuickUp);
  $('btn-barn2').addEventListener('click', handlers.onBarn);
  $('btn-close-barn').addEventListener('click', handlers.onCloseBarn);
  $('btn-close-records').addEventListener('click', handlers.onCloseRecords);
  document.querySelectorAll('#barn .tab').forEach((tab) => tab.addEventListener('click', () => {
    barnTab = tab.dataset.tab;
    handlers.onTab();
  }));
  $('upgrade-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-buy]');
    if (btn) handlers.onBuyUpgrade(btn.dataset.buy);
  });
  $('skin-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-skin]');
    if (card) handlers.onBuySkin(card.dataset.skin);
  });

  // ---------- results ----------
  function results(view, sfx) {
    clearInterval(countTimer);
    $('res-title').textContent = view.title;
    $('res-cause').textContent = view.cause;
    const list = $('res-lines');
    list.innerHTML = view.lines.map((l) => `
      <li><span>${l.label}${l.rec ? '<span class="rec">NEW BEST</span>' : ''}</span><span class="d">${l.detail}</span><span class="n">+0</span></li>`).join('');
    $('res-total').textContent = '0';
    $('res-extra').innerHTML = view.extras.map((x) => `<div class="pill ${x.kind}">${x.text}</div>`).join('');
    const goal = view.goal;
    $('res-goal').classList.toggle('hidden', !goal);
    if (goal) {
      $('goal-label').textContent = `Next: ${goal.name}`;
      $('goal-left').textContent = `${formatInt(Math.min(goal.have, goal.cost))} / ${formatInt(goal.cost)}`;
      $('goal-fill').style.width = '0%';
      setTimeout(() => { $('goal-fill').style.width = `${Math.min(100, (goal.have / goal.cost) * 100)}%`; }, 250);
    }
    $('btn-double').classList.toggle('hidden', !view.canDouble);
    $('btn-double').disabled = false;
    $('btn-wind').classList.toggle('hidden', !view.canWind);
    $('btn-wind').disabled = false;

    // Count-up: lines appear one by one, then the total ticks up.
    const items = [...list.children];
    let i = 0;
    let shown = 0;
    let running = 0;
    countTimer = setInterval(() => {
      if (i < items.length) {
        const li = items[i];
        li.classList.add('in');
        const amount = view.lines[i].amount;
        li.querySelector('.n').textContent = `+${formatInt(amount)}`;
        running += amount;
        sfx.tick(i);
        i += 1;
        return;
      }
      const target = view.total;
      shown = Math.min(target, shown + Math.max(1, Math.ceil(target / 12)));
      $('res-total').textContent = formatInt(shown);
      if (shown >= target) {
        clearInterval(countTimer);
        sfx.done();
      }
      void running;
    }, 55);
  }

  // One-tap upgrade: the cheapest upgrade the player can afford right now.
  function quickUpgrade(opt, bought = false) {
    const b = $('btn-quick-up');
    b.classList.toggle('hidden', !opt);
    b.classList.remove('bought');
    if (bought) {
      void b.offsetWidth;
      b.classList.add('bought');
    }
    if (opt) b.innerHTML = `UPGRADE NOW: ${opt.name}<small>${opt.line} · <span class="coin-icon"></span>${formatInt(opt.cost)}</small>`;
  }

  function goalBar(goal) {
    $('res-goal').classList.toggle('hidden', !goal);
    if (!goal) return;
    $('goal-label').textContent = `Next: ${goal.name}`;
    $('goal-left').textContent = `${formatInt(Math.min(goal.have, goal.cost))} / ${formatInt(goal.cost)}`;
    $('goal-fill').style.width = `${Math.min(100, (goal.have / goal.cost) * 100)}%`;
  }

  function skipCount(total) {
    clearInterval(countTimer);
    document.querySelectorAll('#res-lines li').forEach((li) => li.classList.add('in'));
    $('res-total').textContent = formatInt(total);
  }

  // ---------- barn ----------
  function barn(save) {
    $('barn-coins').textContent = formatInt(save.coins);
    document.querySelectorAll('#barn .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === barnTab));
    $('upgrade-list').classList.toggle('hidden', barnTab !== 'upgrades');
    $('skin-grid').classList.toggle('hidden', barnTab !== 'pigs');
    const tiers = save.upgrades;
    if (barnTab === 'upgrades') {
      const list = $('upgrade-list');
      list.innerHTML = UPGRADES.map((u) => {
        const lv = tiers[u.id] || 0;
        const max = lv >= maxLevel(u);
        const locked = isLocked(tiers, u);
        const cost = max ? 0 : u.costs[lv];
        const name = max ? u.levels[lv].name : u.levels[lv + 1].name;
        const stat = locked ? 'Buy a Rocket first' : max
          ? `${statText(u.id, lv)} (max)`
          : `${statText(u.id, lv)} → <b>${statText(u.id, lv + 1)}</b>`;
        const pips = u.levels.slice(1).map((_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
        const btn = max
          ? '<button class="btn buy max" disabled>MAX</button>'
          : `<button class="btn buy ${save.coins >= cost && !locked ? 'primary' : ''}" data-buy="${u.id}" ${locked ? 'disabled' : ''}><span class="coin-icon"></span>${formatInt(cost)}</button>`;
        return `<div class="up-card ${locked ? 'locked' : ''}"><canvas width="128" height="128" data-icon="${u.id}" data-level="${max ? lv : lv + 1}"></canvas>
          <div><div class="u-name">${name}</div><div class="u-stat">${u.name} · ${stat}</div><div class="pips">${pips}</div></div>${btn}</div>`;
      }).join('');
      list.querySelectorAll('canvas').forEach((c) => upgradeIcon(c, c.dataset.icon, Number(c.dataset.level), tiers));
    } else {
      const grid = $('skin-grid');
      grid.innerHTML = SKINS.map((s) => {
        const owned = save.owned.includes(s.id);
        const eq = save.skin === s.id;
        const label = eq ? 'Equipped' : owned ? 'Tap to wear' : s.cost === null ? 'Reach the Moon' : `<span class="coin-icon"></span>${formatInt(s.cost)}`;
        return `<button class="skin ${eq ? 'equipped' : ''} ${!owned && s.cost === null ? 'locked' : ''}" data-skin="${s.id}">
          <canvas width="192" height="160" data-s="${s.id}"></canvas>${s.name}<small>${label}</small></button>`;
      }).join('');
      grid.querySelectorAll('canvas').forEach((c) => skinIcon(c, SKINS.find((s) => s.id === c.dataset.s), tiers));
    }
  }

  // ---------- records ----------
  function records(save, username) {
    $('records-player').textContent = username ? `Pilot: ${username}` : '';
    const best = [
      ['Highest', formatDistance(save.best.alt)],
      ['Farthest', formatDistance(save.best.dist)],
      ['Fastest', `${kmh(save.best.speed)} km/h`],
      ['Flights', formatInt(save.flights)],
    ];
    $('best-grid').innerHTML = best.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('medal-grid').innerHTML = MEDALS.map((m) => {
      const got = save.medals.includes(m.id);
      return `<div class="medal ${got ? 'got' : ''}"><i></i><div><b>${m.name}</b><small>${medalText(m)} · +${formatInt(m.reward)}</small></div></div>`;
    }).join('');
  }

  return { results, skipCount, quickUpgrade, goalBar, barn, records, missionText };
}
