// Sky content: pickups, bouncers, hazards and wind fields, generated per
// grid cell from a hash so the sky is infinite, stateless and reproducible.

import { LAYERS, LAUNCH_POS } from './config.js';
import { mulberry32, hash, range, weighted } from './rng.js';
import { createTerrain } from './terrain.js';

const COIN_P = [0.75, 0.72, 0.68, 0.64, 0.62, 0.62];
const FEATURE_P = [0.45, 0.55, 0.6, 0.62, 0.62, 0.66];
const COIN_VALUE = [1, 1, 2, 3, 5, 8];
const FEATURES = [
  [[3, 'balloon'], [2, 'updraft'], [1, 'geese'], [1.5, 'fuel']],
  [[3, 'balloon'], [2.5, 'geese'], [1, 'updraft'], [1.5, 'fuel']],
  [[3, 'thunder'], [2.5, 'balloon'], [1.5, 'hotair'], [2, 'fuel'], [1, 'geese']],
  [[3, 'plane'], [2, 'jetstream'], [2.5, 'fuel'], [1, 'balloon']],
  [[3, 'wballoon'], [0.6, 'ufo'], [2.5, 'fuel'], [1.5, 'star']],
  [[3, 'satellite'], [3.5, 'asteroid'], [2.5, 'fuel'], [1.5, 'star']],
];
const BALLOON_COLORS = ['#ff4d6d', '#ffb703', '#3a86ff', '#8338ec', '#06d6a0', '#fb5607'];
const FARM_FLOOR = 3;
const FEATURE_FLOOR = 16;
const NO_HAZARD_X = 90;

export const HAZARDS = new Set(['goose', 'thunder', 'satellite', 'asteroid']);
export const FIELDS = new Set(['updraft', 'jetstream']);

// The starter zone: coins along the first flights' arc, then balloons and
// coin lines low over the first ~450 m, where new players actually fly, so
// the first flights pop and collect something every second.
function starterZone(spawn, terrain, seed) {
  let n = 0;
  const id = () => `start:${n++}`;
  const coin = (x, y) => {
    if (y >= terrain.height(x) + 1.4) spawn({ id: id(), type: 'coin', x, y, r: 0.55, value: 1, star: false });
  };
  for (let x = 5; x <= 45; x += 4) coin(x, LAUNCH_POS.y + 1 + x * 0.781 - x * x * 0.0273);
  for (let x = 36; x <= 116; x += 5) coin(x, terrain.height(x) + 1.6);
  const rng = mulberry32(hash(seed, 4242));
  for (let x = 120; x <= 460; x += 38 + rng() * 14) {
    const g = terrain.height(x);
    const y = g + 8 + rng() * 20;
    spawn({ id: id(), type: 'balloon', x, y, r: 1.3, color: BALLOON_COLORS[Math.floor(rng() * BALLOON_COLORS.length)] });
    const cy = g + 3 + rng() * 9;
    for (let k = 1; k <= 5; k++) coin(x + 4 + k * 2.6, cy + Math.sin(k * 0.8) * 1.2);
  }
}

export function createWorld(seed) {
  const terrain = createTerrain(seed);
  const cells = new Map();

  function genCell(b, cx, cy) {
    const L = LAYERS[b];
    const cs = L.cell;
    const S = L.scale;
    const x0 = cx * cs;
    const x1 = x0 + cs;
    const y0 = Math.max(cy * cs, L.from + (b === 0 ? FARM_FLOOR : 0));
    const y1 = Math.min((cy + 1) * cs, L.to);
    if (y1 - y0 < 4 * S || x1 < 30) return [];
    const rng = mulberry32(hash(seed, b, cx, cy));
    const out = [];
    let n = 0;
    const id = () => `${b}:${cx}:${cy}:${n++}`;
    const inset = (lo, hi, pad) => (hi - lo > 2 * pad ? range(rng, lo + pad, hi - pad) : (lo + hi) / 2);
    const px = (pad = 3 * S) => inset(Math.max(x0, 30), x1, pad);
    const py = (pad = 2 * S) => inset(y0, y1, pad);
    const fy = (pad = 2 * S) => inset(b === 0 ? Math.max(y0, FEATURE_FLOOR + 22) : y0, y1, pad);
    const hazardOk = (x) => x > NO_HAZARD_X;

    const coin = (x, y, value = COIN_VALUE[b], star = false) => {
      if (b === 0 && y < terrain.height(x) + 1.4) return;
      out.push({ id: id(), type: 'coin', x, y, r: (star ? 0.9 : 0.55) * S, value, star });
    };

    function coinPattern() {
      const ax = px(8 * S);
      const ay = py(6 * S);
      const sp = 2.6 * S;
      const kind = weighted(rng, [[3, 'line'], [3, 'arc'], [2, 'wave'], [1.5, 'ring'], [1.5, 'column']]);
      if (kind === 'line') for (let i = 0; i < 6; i++) coin(ax + (i - 2.5) * sp, ay);
      else if (kind === 'arc') for (let i = 0; i < 7; i++) coin(ax + (i - 3) * sp, ay + 2.2 * S - ((i - 3) ** 2) * 0.25 * S);
      else if (kind === 'wave') for (let i = 0; i < 8; i++) coin(ax + (i - 3.5) * sp, ay + Math.sin(i * 0.9) * 2 * S);
      else if (kind === 'ring') for (let i = 0; i < 8; i++) coin(ax + Math.cos((i / 8) * Math.PI * 2) * 4 * S, ay + Math.sin((i / 8) * Math.PI * 2) * 4 * S);
      else for (let i = 0; i < 6; i++) coin(ax, ay + (i - 2.5) * sp);
    }

    const makers = {
      balloon() {
        const count = b === 0 ? 1 : 1 + Math.floor(rng() * 3);
        const x = px();
        const y = fy();
        for (let i = 0; i < count; i++) {
          out.push({ id: id(), type: 'balloon', x: x + i * 5 * S, y: y + (i % 2) * 2.5 * S, r: 1.3 * S, color: BALLOON_COLORS[Math.floor(rng() * BALLOON_COLORS.length)] });
        }
      },
      updraft() {
        const x = px(5 * S);
        const bottom = b === 0 ? 0 : y0;
        out.push({ id: id(), type: 'updraft', x0: x - 3.5 * S, x1: x + 3.5 * S, y0: bottom, y1: Math.min(y1, bottom + 60 * S), x, y: (bottom + y1) / 2, power: 22 });
      },
      geese() {
        const x = px(10 * S);
        if (!hazardOk(x)) return;
        const y = fy(4 * S);
        const count = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
          const k = Math.ceil(i / 2);
          const side = i % 2 ? 1 : -1;
          out.push({ id: id(), type: 'goose', x: x + k * 2.4 * S, y: y + side * k * 1.5 * S, r: 1 * S, phase: rng() * 6 });
        }
      },
      fuel() {
        out.push({ id: id(), type: 'fuel', x: px(), y: fy(), r: 1 * S });
      },
      thunder() {
        const x = px(8 * S);
        if (!hazardOk(x)) return;
        out.push({ id: id(), type: 'thunder', x, y: fy(4 * S), r: 5 * S, phase: rng() * 6 });
      },
      hotair() {
        out.push({ id: id(), type: 'hotair', x: px(5 * S), y: fy(5 * S), r: 4.2 * S, color: BALLOON_COLORS[Math.floor(rng() * BALLOON_COLORS.length)] });
      },
      plane() {
        const x = px(8 * S);
        out.push({ id: id(), type: 'plane', x, y: fy(3 * S), w: 9 * S, h: 2.2 * S, r: 5 * S, livery: Math.floor(rng() * 3) });
      },
      jetstream() {
        const len = Math.min(cs * 0.9, x1 - Math.max(x0, 30));
        const cx0 = Math.max(x0, 30) + (x1 - Math.max(x0, 30) - len) / 2;
        const y = fy(4 * S);
        out.push({ id: id(), type: 'jetstream', x0: cx0, x1: cx0 + len, y0: y - 3 * S, y1: y + 3 * S, x: cx0 + len / 2, y, power: 30 });
      },
      wballoon() {
        out.push({ id: id(), type: 'wballoon', x: px(), y: fy(), r: 2.2 * S });
      },
      ufo() {
        out.push({ id: id(), type: 'ufo', x: px(6 * S), y: fy(14 * S), r: 3 * S, beam: 14 * S });
      },
      star() {
        coin(px(), fy(), 25, true);
      },
      satellite() {
        const x = px();
        if (!hazardOk(x)) return;
        out.push({ id: id(), type: 'satellite', x, y: fy(), r: 2.2 * S, rot: rng() * 6 });
      },
      asteroid() {
        const x = px();
        if (!hazardOk(x)) return;
        out.push({ id: id(), type: 'asteroid', x, y: fy(), r: range(rng, 1.5, 3) * S, rot: rng() * 6, seed: Math.floor(rng() * 1e6) });
      },
    };

    if (rng() < COIN_P[b]) coinPattern();
    if (b === 0 && y1 < FEATURE_FLOOR + 22 + 4 * S) return out;
    for (let k = 0; k < 2; k++) {
      if (rng() < FEATURE_P[b]) makers[weighted(rng, FEATURES[b])]();
    }
    return out;
  }

  function cell(b, cx, cy) {
    const key = `${b},${cx},${cy}`;
    let objs = cells.get(key);
    if (!objs) {
      objs = genCell(b, cx, cy);
      cells.set(key, objs);
      if (cells.size > 4000) cells.delete(cells.keys().next().value);
    }
    return objs;
  }

  // Objects spawned during a flight (coin rushes, gift boxes).
  const extra = [];
  function spawn(o) {
    extra.push(o);
    if (extra.length > 200) extra.shift();
  }

  // Every object whose cell overlaps the rectangle (broad phase).
  function query(x0, y0, x1, y1, out = []) {
    for (let i = 0; i < extra.length; i++) {
      const o = extra[i];
      if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
    }
    for (let b = 0; b < LAYERS.length; b++) {
      const L = LAYERS[b];
      if (y1 < L.from || y0 > L.to) continue;
      const cs = L.cell;
      const cy0 = Math.floor(Math.max(y0, L.from) / cs);
      const cy1 = Math.floor(Math.min(y1, L.to - 1e-6) / cs);
      const cx0 = Math.floor(x0 / cs);
      const cx1 = Math.floor(x1 / cs);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const objs = cell(b, cx, cy);
          for (let i = 0; i < objs.length; i++) out.push(objs[i]);
        }
      }
    }
    return out;
  }

  starterZone(spawn, terrain, seed);
  return { seed, terrain, query, spawn };
}
