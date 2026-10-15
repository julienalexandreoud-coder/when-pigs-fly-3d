# When Pigs Fly: CrazyGames submission kit

Upload: `dist/when-pigs-fly-crazygames.zip` (built with `npm run pack`; `index.html` at the root, HTML5 + Three.js r170 bundled in `vendor/`, fonts bundled in `fonts/`, no external assets besides the CrazyGames SDK)
Covers: `covers/cover-landscape-1920x1080.png`, `covers/cover-portrait-800x1200.png`, `covers/cover-square-800x800.png`

## Listing
- **Title:** When Pigs Fly
- **Category:** Casual (the same category as Nana to the Moon). Tags: one button, launch, upgrade, flying, 3d, funny,
  animals, mobile
- **Short description:** One-button launcher: yeet Pip the pig to the Moon! Hold to fly up, let go to glide, upgrade and go again.
- **Description:**
  The farmer said pigs can't fly. Time to prove him wrong. Tap in the green to launch Pip from a slingshot, then HOLD to fly up
  and LET GO to glide. That's the whole control. Grab coins, bounce off balloons, ride updrafts and dodge geese, planes,
  satellites and asteroids on the way through six 3D sky layers to the Moon. Every flight earns coins: hit "Upgrade & Yeet!" to
  buy better gear in one click (launcher, wings, rocket, fuel tank, helmet, bouncy belly, coin magnet, piggy bank) and fly
  again, farther each time. Unlock pig skins, clear quests and reach the Moon to unlock the golden pig.
- **Controls:**
  - Launch: click, tap or press SPACE when the needle is in the green.
  - Fly: hold the mouse button, any key, or touch and hold the screen to fly up; let go to glide.
  - Esc / P to pause.

## Game systems (for QA)
- Launch meter: triangle-wave needle, PERFECT zone = top 10% (+12% launch speed).
- One button in flight: holding fires the rocket while it has fuel, then flaps; bounces on landing are automatic (3 per flight, more with the Bouncy Belly).
- Results: "Upgrade & Yeet!" buys the cheapest next levels the coins cover, then relaunches.
- Flight model: lift/drag glider physics with air density falling with altitude; the Moon is at 10 km.
- Economy: coins from distance, altitude, top speed, collected coins and tricks, times the Piggy Bank multiplier.
  A bot plays the real rules (`npm run balance`): a skilled player reaches the Moon in about 41–47 flights, a weak one in about 61.
- Retention: 3 rotating missions scaled to your records, 15 medals, records screen, next-goal bar, best-height marker in flight.
- Saves: CrazyGames `SDK.data` (synced to the account) with `localStorage` then memory as fallback; all loaded data is validated.

## SDK integration (HTML5 SDK v3)
- `init`, `game.loadingStart/Stop` around boot; `gameplayStart` when a flight starts or resumes, `gameplayStop` on landing,
  pause, tab hidden, results and before ads.
- Midgame ad only on "Fly again", from the 3rd flight on and at least 180 s apart.
- Rewarded ads (always opt-in, marked with a play icon), reward granted only on `adFinished`:
  **Double coins** (results), **Second wind** (continue the flight with a bounce, once per flight), **Golden Rocket** (2× fuel
  for the next flight, from the 3rd flight on). On `adError` the player sees "No ad available right now" and nothing breaks.
- Audio is muted while an ad plays; the `muteAudio` platform setting is respected and followed live.
- `game.happytime()` on a new height record, a new medal and reaching the Moon.
- No external links, no other ad networks, no login, no custom fullscreen button; arrow keys and Space never scroll the page.
- Loads straight to the launch screen: one tap launches the first flight.

## Dev
- `npm run serve` then open http://localhost:8770 (`?debug` exposes `window.wpf`; add `&sandbox` for a memory-only save)
- `npm test` runs the unit tests (physics, world, economy, save, missions, launch meter)
- `npm run balance` runs the balance bot for a skilled and a novice player
- Covers: open `tools/cover3d.html?w=1920&h=1080` (also 800×1200 and 800×800) or render them headless, see README
