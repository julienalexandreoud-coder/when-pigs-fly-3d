# When Pigs Fly

Launch Pip the pig, upgrade the gear and fly through six sky layers to the Moon. A launch-and-upgrade game (the Learn to Fly
loop) with its own twist: a timing launch, visible gear for every upgrade tier, tricks and a sky full of things to bounce off or
dodge. Vanilla HTML5 canvas, no build step, no image or audio files (all art and sound are procedural), made for
[CrazyGames](https://www.crazygames.com) with the HTML5 SDK v3. The full build spec is in [PROMPT.md](PROMPT.md).

## Run
```bash
npm run serve    # no-cache static server on http://localhost:8770 (?debug exposes window.wpf, &sandbox = memory-only save)
npm test         # unit tests
npm run balance  # balance bot: skilled + novice runs to the Moon
npm run pack     # dist/when-pigs-fly-crazygames.zip for the CrazyGames upload
```

Covers are rendered from `tools/cover3d.html` with headless Edge, for example:
```bash
msedge --headless=new --hide-scrollbars --window-size=1920,1080 --use-angle=d3d11 --virtual-time-budget=8000 --screenshot=covers/cover-landscape-1920x1080.png "http://localhost:8771/tools/cover3d.html?w=1920&h=1080"
```

## Layout
- Rules (pure, tested): `js/config.js` constants and sky layers, `js/physics.js` + `js/collide.js` flight model,
  `js/world.js` + `js/terrain.js` seeded sky and ground, `js/upgrades.js` gear and skins, `js/economy.js` payout and medals,
  `js/missions.js`, `js/launch.js` power meter, `js/save.js` validated immutable save
- Presentation: `js/render.js`, `js/camera.js`, `js/fx.js`, `js/juice.js`, `js/art/*` (pig, farm, sky objects, scenery, icons),
  `js/audio.js` (WebAudio synth), `js/ui.js` + `js/panels.js` (DOM screens), `js/input.js`
- Glue: `js/main.js` (state machine and loop), `js/sdk.js` (CrazyGames SDK wrapper), `js/bot.js` (balance bot / autoplay)
- Tools: `tools/balance-sim.mjs`, `tools/cover3d.html`, `tools/serve.mjs`, `tools/pack.ps1`
