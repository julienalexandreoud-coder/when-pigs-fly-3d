// Goal ladder: a short, always-visible target ("fly 200 m") that a new player
// can hit within seconds, then the next one right away. Distance goals first
// (easy early wins), then height goals toward the Moon, then it keeps going.

const LADDER = [
  { kind: 'dist', v: 100 }, { kind: 'dist', v: 200 }, { kind: 'dist', v: 350 }, { kind: 'alt', v: 50 },
  { kind: 'dist', v: 500 }, { kind: 'alt', v: 100 }, { kind: 'dist', v: 750 }, { kind: 'alt', v: 200 },
  { kind: 'dist', v: 1000 }, { kind: 'alt', v: 350 }, { kind: 'dist', v: 1500 }, { kind: 'alt', v: 500 },
  { kind: 'dist', v: 2000 }, { kind: 'alt', v: 750 }, { kind: 'alt', v: 1000 }, { kind: 'dist', v: 3000 },
  { kind: 'alt', v: 1500 }, { kind: 'alt', v: 2000 }, { kind: 'dist', v: 5000 }, { kind: 'alt', v: 3000 },
  { kind: 'alt', v: 4500 }, { kind: 'alt', v: 6000 }, { kind: 'alt', v: 8000 },
];

// Goal number `i` (0-based). Past the ladder: ever longer distance goals.
export function goalAt(i) {
  const n = Math.max(0, Math.floor(i) || 0);
  if (n < LADDER.length) return { ...LADDER[n], index: n };
  const k = n - LADDER.length + 1;
  return { kind: 'dist', v: 5000 + k * 2500, index: n };
}

export const goalReward = (g) => Math.round(20 + g.v * (g.kind === 'alt' ? 0.6 : 0.15));

export const goalValue = (g, f) => (g.kind === 'alt' ? Math.max(0, f.maxAlt) : Math.max(0, f.distance));

export function goalText(g) {
  const m = g.v >= 1000 ? `${(g.v / 1000).toFixed(g.v % 1000 ? 1 : 0)} km` : `${g.v} m`;
  return g.kind === 'alt' ? `REACH ${m} HIGH` : `FLY ${m} FAR`;
}
