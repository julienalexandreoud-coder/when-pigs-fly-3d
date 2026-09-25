// Plays the real rules with a bot and a simple shopping policy.
// Usage: node tools/balance-sim.mjs [skilled|novice] [maxRuns=120] [seed=1] [--verbose]
import { STEP, kmh, formatDistance } from '../js/config.js';
import { createWorld } from '../js/world.js';
import { createFlight, stepFlight, canSkip, simulateToEnd, summarize } from '../js/physics.js';
import { DEFAULT_SAVE, recordFlight, buyUpgrade, statsOf } from '../js/save.js';
import { shopOptions } from '../js/economy.js';
import { launchPower, launchZone } from '../js/launch.js';
import { botInput, botLaunch } from '../js/bot.js';
import { mulberry32 } from '../js/rng.js';

const skill = process.argv[2] || 'skilled';
const maxRuns = Number(process.argv[3] || 120);
const seed = Number(process.argv[4] || 1);
const verbose = process.argv.includes('--verbose');
const rng = mulberry32(seed);

let save = DEFAULT_SAVE;
let lastBuyRun = 0;
let maxGap = 0;
const marks = {};
let playTime = 0;
const log = [];

for (let run = 1; run <= maxRuns; run++) {
  const stats = statsOf(save);
  const v = botLaunch(rng, skill);
  const f = createFlight(stats, { power: launchPower(v), perfect: launchZone(v) === 'perfect' });
  const world = createWorld((rng() * 2 ** 31) >>> 0);
  let skippedAt = null;
  while (!f.done) {
    if (canSkip(f) && f.y > 60) {
      skippedAt = f.t;
      simulateToEnd(f, world);
      break;
    }
    stepFlight(f, botInput(f, skill), STEP, world);
    f.events.length = 0;
  }
  const s = summarize(f);
  const res = recordFlight(save, s);
  save = res.save;
  const played = skippedAt ?? s.time;
  playTime += played + 12;
  const bought = [];
  for (;;) {
    const opt = shopOptions(save).find((o) => o.kind === 'upgrade' && o.cost <= save.coins);
    if (!opt) break;
    save = buyUpgrade(save, opt.id).save;
    bought.push(`${opt.id}`);
  }
  if (bought.length) {
    maxGap = Math.max(maxGap, run - lastBuyRun);
    lastBuyRun = run;
  }
  for (const [k, h] of [['alt100', 100], ['alt1k', 1000], ['jet', 2500], ['strato', 6000], ['space', 11000]]) {
    if (!marks[k] && s.maxAlt >= h) marks[k] = run;
  }
  log.push(`${String(run).padStart(3)} alt ${formatDistance(s.maxAlt).padStart(8)} dist ${formatDistance(s.distance).padStart(8)} ${String(kmh(s.topSpeed)).padStart(5)} km/h  t ${played.toFixed(1).padStart(5)}s${skippedAt !== null ? '*' : ' '} coins ${String(s.coins).padStart(4)} flips ${s.flips} pay ${String(res.payout.total).padStart(5)} +m${res.medalCoins + res.missionCoins} | ${bought.join(',')}`);
  if (s.moon) {
    marks.moon = run;
    break;
  }
}

if (verbose) console.log(log.join('\n'));
else console.log(log.filter((_, i) => i < 6 || i % 5 === 4 || i === log.length - 1).join('\n'));
console.log(`\n[${skill}] marks:`, JSON.stringify(marks), `maxGap ${maxGap} runs, est. play ${(playTime / 60).toFixed(0)} min`);
console.log('final upgrades', JSON.stringify(save.upgrades), 'coins', save.coins);
