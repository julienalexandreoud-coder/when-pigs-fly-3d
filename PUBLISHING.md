# Publishing When Pigs Fly on web portals

`npm run pack` builds one zip per portal in `dist/` (index.html at the zip root, ~330 KB, no external files besides the
portal's own SDK). Each build wires in that portal's ad SDK; `js/sdk.js` picks the adapter from `window.WPF_PLATFORM`.

| Zip | Portal | Ads in the build | How you get paid |
|---|---|---|---|
| `when-pigs-fly-gamedistribution.zip` | [GameDistribution](https://developer.gamedistribution.com) | midgame + rewarded (Double coins, Second wind, Golden Rocket) | share of ad revenue on every site that embeds the game; paid monthly from €50 |
| `when-pigs-fly-gamemonetize.zip` | [GameMonetize](https://gamemonetize.com) | midgame only (the reward buttons are hidden) | share of ad revenue across its partner sites |
| `when-pigs-fly-poki.zip` | [Poki for Developers](https://developers.poki.com) | midgame + rewarded | 50/50 on Poki's traffic, 100% on players you bring; Poki picks games, so you apply first |
| `when-pigs-fly-itch.zip` | [itch.io](https://itch.io) (also Newgrounds, your own site) | none | pay-what-you-want / donations; itch keeps 10% by default |
| `when-pigs-fly-crazygames.zip` | CrazyGames | none (Basic Launch rules) | kept for a resubmission |

Ads only ever show at natural breaks: the midgame ad runs on "Yeet again" from the 3rd flight on, at most every 3 minutes;
rewarded ads are opt-in buttons with a play icon and the reward is only granted after the ad was fully watched.

## Steps per portal

### GameDistribution (do this first: widest reach)
1. Sign up at developer.gamedistribution.com and click **Upload new game** → HTML5.
2. Copy the **Game ID** it shows, then build with it:
   `GD_GAME_ID=<id> npm run pack gamedistribution` (PowerShell: `$env:GD_GAME_ID="<id>"; npm run pack gamedistribution`)
3. Upload `dist/when-pigs-fly-gamedistribution.zip`, tick **Rewarded ads** in the game settings (otherwise rewarded ad
   requests fail), add covers from `covers/` and the text from `SUBMISSION.md`.
4. QA needs to see a full video ad play inside the game: play 3 flights and press "Yeet again", or tap "Double the coins".

### GameMonetize
1. Sign up at gamemonetize.com → **Developers** → **Upload game**.
2. Copy the game id, then `GM_GAME_ID=<id> npm run pack gamemonetize` and upload the zip.

### Poki
1. Submit the game at developers.poki.com (they review it before you get the SDK dashboard).
2. Once accepted, upload `dist/when-pigs-fly-poki.zip` (no id needed) and run their in-browser inspector.

### itch.io
1. **Create new project** → Kind: HTML → upload `dist/when-pigs-fly-itch.zip` → tick *This file will be played in the browser*.
2. Viewport 1280×720, tick *Mobile friendly* and *Fullscreen button*. Pricing: *No payments* or *Donate*.

## Testing a build locally
`npm run serve`, then open `http://localhost:8770/dist/when-pigs-fly-<portal>/index.html?debug`. Without the portal's
real page around it the SDK may not serve ads; the game then simply runs without them.
