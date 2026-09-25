# Build prompt: "When Pigs Fly" (complete HTML5 game for CrazyGames)

You are a senior HTML5 game developer. Build a complete, polished, release-ready browser game called
**When Pigs Fly** for the CrazyGames portal, in one go. Everything below is a requirement unless it says
"optional". Numbers are starting values: tune them with the balance simulator until the targets in
section 6 are met.

---

## 1. Pitch and fantasy

- The farmer laughed: "I'll believe it when pigs fly... to the Moon!" Pip the pig decides to prove him wrong.
- Genre: launch-and-upgrade (the "Learn to Fly" / "Toss the Turtle" loop), which is proven on CrazyGames (Golf Orbit,
  Rocket Fling, Bouncemasters, Earn to Die). Learn to Fly itself is not on the portal. **Copy the mechanic only**:
  no names, characters, art, sounds or levels from any existing game.
- What makes it different:
  1. **Timing launch**: a swinging power needle. Tap in the green zone for a PERFECT launch.
  2. **Visible, silly gear**: every upgrade tier changes how the pig looks (cardboard wings → hang glider → jet wings,
     soda-bottle rocket → firework → space rocket, slingshot → catapult → hay cannon → circus cannon → railgun).
  3. **A sky with stuff in it**: balloons to bounce off, goose flocks, thunderclouds, airliners you can surf on,
     jet streams, a UFO that abducts you upward, satellites and asteroids, then the Moon.
  4. **Tricks**: full flips pay coins; plane surfing, balloon chains and perfect launches pay bonuses.
  5. **One clear goal**: a Moon progress bar is always on screen. Reaching the Moon plays a victory scene and unlocks
     the Golden Pig. After that, records, medals, missions and skins keep people playing.

## 2. Platform and technical constraints

- Vanilla JavaScript ES modules, HTML and CSS. **No build step, no dependencies, no image or audio files.**
  All art is drawn procedurally on `<canvas>`; all sound is synthesized with WebAudio. Zipped size under 200 KB.
- `index.html` sits at the root and loads `https://sdk.crazygames.com/crazygames-sdk-v3.js`, then `js/main.js`.
- The game runs from a static server and inside the CrazyGames iframe. It fills the iframe at any size and aspect
  (16:9 desktop, portrait phones, landscape phones). Nothing may cause page scroll or text selection.
- The canvas is DPR-aware (DPR capped at 2) and resizes on `resize`/`orientationchange`.
- 60 fps on a mid-range phone: fixed-timestep simulation (120 Hz) with the frame delta clamped to 100 ms; particle
  pool capped (about 400); static art (clouds, hills, launcher) pre-rendered to offscreen canvases; no per-frame allocations
  in hot paths where it matters.
- Deterministic, seeded RNG (mulberry32 plus a cell hash) for world content, so tests and the bot are reproducible.
- Code style: small focused modules (under 400 lines each), pure logic separated from rendering/DOM, immutable save
  updates, every external input validated (saves, SDK responses), no silent failures (log with `console.warn`).

## 3. CrazyGames SDK v3 requirements (QA rejects games that miss these)

- `SDK.init()` guarded; the game must fully work standalone if the SDK is missing or blocked.
- `game.loadingStart()` / `loadingStop()` around boot. `game.gameplayStart()` when a flight starts and
  `gameplayStop()` on pause, results, shop, tab hidden and before every ad.
- **Ads only through the SDK.** Midgame ad at a natural break ("Fly again" from results), never before the 3rd run and at
  least 180 s apart. Rewarded ads are always opt-in, clearly labelled with a play icon, and the reward is granted **only
  on `adFinished`**. On `adError`, show a small "No ad available right now" toast and keep the game working.
- Rewarded placements: **Double coins** (results, once per run), **Second wind** (one mid-air rebound from where you
  landed, once per run), **Golden Rocket** (before launch: +100% fuel for this run, offered from run 3 on).
- Mute all audio and pause the game while an ad plays. Respect the `muteAudio` setting and listen for changes.
- `game.happytime()` on reaching a new altitude record, a new medal and the Moon.
- Saves go through `SDK.data` (synced to the CrazyGames account), with `localStorage` then memory as fallback.
- No external links, no other ad networks, no login walls, no own fullscreen button. Load straight to the launch
  screen: the first tap launches the pig within about 3 seconds of loading.
- Arrow keys and Space call `preventDefault` so the portal page never scrolls.
- Auto-pause on `visibilitychange` (hidden) and window blur during flight.

## 4. Game rules

### 4.1 Run structure
1. **Launch screen**: Pip sits in the launcher on a hill. The power needle swings (period about 1.4 s). Tap, click or press
   Space/↑ to launch. Zones: weak (60–80% power), good (80–95%), PERFECT (the centre 8%: 100% power plus a 15% bonus,
   slow-motion flash, "PERFECT!"). Launch angle is fixed at 38°.
2. **Flight**: the player pitches the nose up or down and fires the rocket (while it has fuel). Collect coins and fuel,
   bounce off balloons, surf planes, dodge hazards, do flips.
3. **Ground contact**: shallow, fast impacts skip like a stone (restitution from the Bouncy Belly upgrade); steep or slow
   impacts face-plant and skid (friction). Haystacks and trampolines bounce, mud stops you dead, a pond lets you skip
   when shallow or ends in a splash when steep. The run ends when speed stays under 1.5 m/s on the ground.
4. **Skip the fall**: when descending with no fuel above 600 m, a "Skip ⏩" button simulates the rest of the flight
   instantly with an autopilot that glides at the best lift-to-drag angle.
5. **Moon**: reaching the Moon altitude ends the run in a victory scene (pig plants a flag, confetti, happytime).
6. **Results** with count-up lines → Barn (shop) or Fly again.

### 4.2 Flight physics (units: metres, seconds; 1 unit = 1 m)
- State: position (x, y up), velocity, pitch angle θ, fuel, flags. Integrate with semi-implicit Euler at 120 Hz.
- Air density `ρ(h) = exp(-h / 4000)`; gravity `g(h) = 9.81` below 3 km, easing down to about 40% at the Moon.
- Angle of attack `α = θ − atan2(vy, vx)` (wrapped). Lift coefficient `CL = sin(2α)` (forgiving, no hard stall).
- Lift acceleration `ρ·qL·s²·CL`, perpendicular to velocity. Drag acceleration `ρ·s²·(cdBody + qL·K·CL²)`, opposite velocity.
  Wings set `qL` and `K`; the helmet lowers `cdBody`. The best glide ratio should go from about 3 (cardboard wings) to about 12 (jet wings).
- Thrust: acceleration along the nose while boosting with fuel > 0; it burns 1 fuel-second per second.
- Pitch: input × turn rate (about 3 rad/s). With no input the nose weathervanes toward the flight path (rate about 2/s) when
  wings are fitted, so gliding feels stable. Track accumulated rotation for flips (every ±360° is a flip).
- Clamp speeds to sane values; never let NaN in (tests check this).

### 4.3 The sky (layers by altitude)
| Layer | Altitude | Look | Content |
|---|---|---|---|
| Farm | 0–150 m | green hills, barn, fences, trees | coins, haystacks, trampolines, mud, pond, updrafts |
| Blue Sky | 150–800 m | bright blue | coin arcs, balloons, goose flocks, kites |
| Cloud Kingdom | 0.8–2.5 km | puffy clouds, rainbow | balloons, thunderclouds, hot-air balloons, fuel cans |
| Jet Lane | 2.5–6 km | deep blue, contrails | airliners (surf the roof, bonk the side), jet streams, fuel |
| Stratosphere | 6–14 km | navy, aurora, curvature | weather balloons (big bounce), UFO (rare, tractor beam), stars |
| Space | 14–30 km | black, stars, Earth glow below | satellites, asteroids, star coins, fuel |
| The Moon | 30 km | Moon grows as you approach | the goal |

- Content spawns from a deterministic cell hash (for example 60×60 m cells near the ground, larger cells higher up) so the world is
  infinite, stateless and reproducible. Collected objects are remembered by id for the current run.
- Coins come in patterns (line, arc, sine wave, ring), values 1, 5 and 25 (stars in space). Density rises with altitude
  so fast flights still meet things.
- Hazards never end the run by themselves. They cost speed (goose −30%, thundercloud zap −40% and a spin, satellite
  or asteroid −35%), give a clear sound, a pig face reaction and feathers or sparks.
- Bouncers: balloon (+14 m/s up, pop), weather balloon (+30 m/s), plane roof (+25 m/s and forward boost, "PLANE SURF!"),
  trampoline (strong bounce), haystack (soft bounce). Jet streams push forward. Updrafts push up. The UFO lifts you
  about 400 m ("ABDUCTED!").

### 4.4 Upgrades (the Barn). Each tier changes the look.
| Line | Stat | Tiers (name → effect) |
|---|---|---|
| Launcher | launch speed | Slingshot 16 m/s → Big Slingshot → Catapult → Hay Cannon → Circus Cannon → Tractor Launcher → Railgun (≈90 m/s) |
| Wings | lift/drag | Cardboard (owned) → Umbrella Wings → Kite Wings → Hang Glider → Biplane Wings → Carbon Wings → Jet Wings |
| Rocket | thrust | none → Soda Bottle → Firework → Toy Rocket → Jet Engine → Space Rocket → Warp Thruster |
| Fuel Tank | burn time | 2 s → up to about 16 s (only visible and purchasable once a rocket is owned) |
| Helmet | less body drag | none → Leather Cap → Racing Helmet → Bullet Helmet → Nose Cone |
| Bouncy Belly | ground-skip restitution | 0.25 → 0.6 |
| Magnet | coin pickup radius | 1.2 m → 6 m |
| Piggy Bank | payout multiplier | +12% per level |

- Costs grow about 1.55–1.8× per level. Each card shows the level pips, the current → next stat in plain words, the cost
  and a disabled state when you can't afford it. A badge on the Barn button counts affordable upgrades.
- **Skins** (cosmetic): Classic Pink (free), Spotted, Mud Pig, Wild Boar, Robo Pig, Astronaut, Unicorn, and Golden Pig
  (unlocked by reaching the Moon). Each has its own colours, accessory and trail colour.

### 4.5 Payout (coins per run)
`(distance·0.1 + maxAltitude·0.25 + topSpeedKmh·0.05 + collected coins + trick bonuses) × piggyBankMultiplier`.
Trick bonuses: flip 8, plane surf 15, balloon 2 each (chain of 3+ in 3 s doubles), abduction 30, perfect launch 5.
Results show every line counting up, then the total, then the medals and missions completed.

### 4.6 Retention systems
- **Medals** (once each, with coin rewards): altitude 100 m, 500 m, 1 km, 2.5 km, 6 km, 14 km, Moon; distance 500 m, 2 km,
  5 km, 15 km; speed 150, 400, 800 km/h and 1,235 km/h ("SONIC BOOM!" with a visual shock ring).
- **Missions**: 3 active at once, single-run goals scaled to the player's records (reach X m, fly X m, reach X km/h,
  do N flips, pop N balloons, surf a plane, get a PERFECT launch, bounce N times, collect N coins, glide X m without boosting,
  get abducted). Completing one pays coins, shows a toast mid-flight, and a new one replaces it. Mission tier rises over time.
- Records: best altitude, distance and speed, number of flights, and a "ghost" marker of the best altitude on the Moon bar.
- "Next goal" bar on the results: the cheapest upgrade you can't afford yet.

## 5. Presentation

### 5.1 Art (procedural canvas, cute cartoon style, thick dark outlines, soft shading)
- **Pip**: round pink body, big snout with nostrils, floppy ears, curly tail, stubby legs, expressive eyes. Face states:
  normal, happy (coin), scared (hazard), dizzy (after a bonk, stars circling), determined (boosting), splat (landing).
  Squash and stretch on launch and bounces. Gear drawn on top: wings, rocket with flame, helmet, skin accessory.
- Launchers drawn per tier. The farm scene has the farmer (a simple silhouette waving a pitchfork, reacting on launch).
- Sky: an altitude-driven vertical gradient blended between layers, 3 parallax layers (far hills, clouds, near
  hills near the ground), speed lines at high speed, stars fading in above 8 km, Earth curvature and glow in space,
  the Moon growing as you approach.
- Camera: follows the pig with look-ahead along the velocity; zooms out smoothly with speed and altitude (clamped). The pig
  and pickups have a minimum on-screen size so they stay readable when zoomed out.

### 5.2 Juice
Floating +N text, coin streak pitch rising, screen shake (small and capped), hit-stop on hazards, slow-mo on PERFECT,
confetti on medals, dust puffs on skids, splash on the pond, feather bursts from geese, sparks from thunderclouds,
a flame and smoke trail on the rocket, a sonic-boom ring, a record banner the moment you pass your best altitude, and layer
title cards ("CLOUD KINGDOM") when you enter a new layer.

### 5.3 Audio (WebAudio synth)
Upbeat farm music loop that changes to a spacey pad above 14 km; wind noise that follows your speed; rocket roar while
boosting; SFX for launch twang, perfect, coin (rising pitch in a streak), balloon pop, goose honk, zap, boing, plane
surf, flip ding, splat, splash, mission complete, medal, buy, click, sonic boom, UFO warble and the Moon fanfare.
Master mute toggle, remembered in the save.

### 5.4 UI (HTML overlays over the canvas; mobile-first; large tap targets of at least 44 px)
- **HUD**: altitude (large), speed in km/h, distance, fuel bar (only with a rocket), run coins, a vertical Moon progress
  bar with layer ticks and a best-altitude ghost, pause and mute buttons.
- **Touch controls** (touch devices only): left side top half = nose up, bottom half = nose down, a big BOOST button bottom right.
  Visible hint icons fade after the first flights. Keyboard: ↑/W/← = nose up, ↓/S/→ = nose down, Space = boost (and launch),
  Esc/P = pause.
- **Launch screen**: logo, best altitude, "Next: [medal]", missions panel (3 cards with progress), Barn button with a badge,
  Golden Rocket rewarded button, the power meter.
- **Results**: a title that reflects the flight ("SPLAT!", "Nice flight!", "NEW RECORD!", "TO THE MOON!"), count-up lines, new-record
  tags, earned medals, missions, next-goal bar, Double coins (rewarded), Barn, Fly again.
- **Barn**: tabs Upgrades / Pigs. Cards with canvas-drawn icons made from the same art functions.
- **Records**: medals shelf, best stats, username if logged in.
- **Pause**: Resume, End flight, sound toggle.
- First-run tutorial hints (one line each, dismissed by doing the thing): "Tap in the green!", "Hold ▲ to lift your nose",
  "Hold SPACE to boost" (after the first rocket purchase).

## 6. Balance targets (verify with `tools/balance-sim.mjs`)
- Run 1: 5–10 s flight, about 30–60 coins, enough for 1 or 2 upgrades. Something affordable after nearly every run in the first 15.
- A typical early flight lasts 10–25 s; a late flight lasts 40–90 s (including the skip).
- A competent bot reaches: 1 km altitude around run 8–14, the Jet Lane around run 18–26, the Moon in **35–60 runs**
  (about 45–80 minutes). A weak bot (bad timing, no tricks) still reaches the Moon within 90 runs.
- No dead ends: the gap between affordable purchases never exceeds 3 runs for either bot.
- Every upgrade level must visibly improve at least one run stat in the sim.

## 7. Tests (Node's built-in `node --test`, no dependencies)
- physics: gravity-only fall, wings produce lift, a better wing glides farther, thrust burns fuel, no NaN at extreme
  inputs, the ground skip/stop rules, flip counting.
- world: generation is deterministic per seed, objects match their layer, no hazards overlap the launch area.
- economy: costs rise monotonically, payout formula, multiplier, affordability badge count.
- save: sanitize rejects garbage and out-of-range values, keeps valid data, immutable updates, buy flows.
- missions: generation scales with records, completion detection, replacement.
- launch meter: zone boundaries and the perfect bonus.

## 8. Deliverables
```
when-pigs-fly/
  index.html  css/style.css  js/*.js  tests/*.test.mjs
  tools/balance-sim.mjs  tools/cover.html  tools/pack.ps1
  package.json (scripts: serve, test, balance, pack)  README.md  SUBMISSION.md  PROMPT.md
```
- `SUBMISSION.md`: title, category (Casual), tags, short and long descriptions, controls text, the SDK features used.
- Covers: 1920×1080, 800×1200, 800×800 PNG, rendered from `tools/cover.html` with the real art functions.
- `tools/pack.ps1` zips `index.html`, `css/` and `js/` into `dist/when-pigs-fly-crazygames.zip`.

## 9. Definition of done
- All tests pass; the balance sim meets section 6.
- Played in a real browser at 1280×720 and at phone portrait (375×812): no console errors, the HUD stays readable,
  touch zones work, pause/mute/ads flows are correct (simulated when the SDK is missing), saves survive a reload.
- Nothing from section 3 is missing. No TODOs, placeholder text or debug output left in the shipped build (debug tools are only
  behind `?debug`).
