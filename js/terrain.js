// Ground: gentle hills plus per-segment features (haystacks, trampolines,
// mud and ponds). Deterministic per seed; the launch area stays clear.

import { mulberry32, hash, range } from './rng.js';
import { HILL } from './config.js';

export const SEG = 80;
const CLEAR_UNTIL = 90;
const HILL_TOP = 6;
const HILL_FOOT = 78;
const EDGE = 5;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function createTerrain(seed) {
  const cache = new Map();

  function segment(i) {
    if (cache.has(i)) return cache.get(i);
    const x = i * SEG;
    let seg = { i, x0: x, feature: null, decor: [] };
    if (x >= CLEAR_UNTIL) {
      const rng = mulberry32(hash(seed, 77, i));
      const r = rng();
      let feature = null;
      if (r < 0.2) feature = { type: 'haystack', x: x + range(rng, 12, SEG - 12), r: 2.3 };
      else if (r < 0.3) feature = { type: 'trampoline', x: x + range(rng, 12, SEG - 12), w: 5.5 };
      else if (r < 0.37) {
        const w = range(rng, 10, 16);
        const x0 = x + range(rng, 6, SEG - w - 6);
        feature = { type: 'mud', x0, x1: x0 + w };
      } else if (r < 0.44) {
        const w = range(rng, 18, 30);
        const x0 = x + range(rng, 6, SEG - w - 6);
        feature = { type: 'pond', x0, x1: x0 + w };
      }
      const decor = [];
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        decor.push({ type: rng() < 0.55 ? 'tree' : rng() < 0.6 ? 'bush' : 'fence', x: x + range(rng, 4, SEG - 4), s: range(rng, 0.8, 1.25) });
      }
      seg = { i, x0: x, feature, decor };
    }
    cache.set(i, seg);
    if (cache.size > 600) cache.delete(cache.keys().next().value);
    return seg;
  }

  const segIndex = (x) => Math.floor(x / SEG);

  // The launch hill: a plateau that rolls down into the farm.
  function hill(x) {
    return HILL * (1 - smooth((x - HILL_TOP) / (HILL_FOOT - HILL_TOP)));
  }

  function hills(x) {
    if (x < HILL_FOOT) return 0;
    const amp = Math.min(5, (x - HILL_FOOT) * 0.04);
    return amp * (0.6 * Math.sin(x / 61) + 0.4 * Math.sin(x / 23 + 1.3));
  }

  // 1 inside a flat feature (pond, mud), easing to 0 over EDGE metres.
  function flatness(x) {
    let f = 0;
    for (let i = segIndex(x) - 1; i <= segIndex(x) + 1; i++) {
      const ft = segment(i).feature;
      if (!ft || (ft.type !== 'pond' && ft.type !== 'mud')) continue;
      const inside = Math.min(x - (ft.x0 - EDGE), ft.x1 + EDGE - x) / EDGE;
      f = Math.max(f, smooth(inside));
    }
    return f;
  }

  function height(x) {
    return hill(x) + hills(x) * (1 - flatness(x));
  }

  function slope(x) {
    return (height(x + 0.5) - height(x - 0.5)) / 1;
  }

  function surface(x) {
    const ft = segment(segIndex(x)).feature;
    if (ft && (ft.type === 'pond' || ft.type === 'mud') && x >= ft.x0 && x <= ft.x1) return ft.type;
    return 'grass';
  }

  function segments(x0, x1) {
    const out = [];
    for (let i = segIndex(x0); i <= segIndex(x1); i++) out.push(segment(i));
    return out;
  }

  return { height, slope, surface, segments, segment };
}
