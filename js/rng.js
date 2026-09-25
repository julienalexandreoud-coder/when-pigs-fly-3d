// Seeded randomness: mulberry32 plus an integer hash for per-cell seeds.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    h ^= n | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
export const range = (rng, lo, hi) => lo + (hi - lo) * rng();

// Picks from [[weight, value], ...].
export function weighted(rng, table) {
  const total = table.reduce((s, [w]) => s + w, 0);
  let r = rng() * total;
  for (const [w, v] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table[table.length - 1][1];
}
