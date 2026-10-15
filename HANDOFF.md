# Handoff: "When Pigs Fly: Yeet to the Moon" on CrazyGames

**Status 2026-10-15: SUBMITTED, Awaiting review (Basic Launch).** Portal game id b1cfa4cb-09aa-4122-a1f6-e41ff0a9ab20,
build a235b90e-499b-4316-821d-f79f8e3b39e7 (commit 118791b). Arcade; tags 3D, Animal, Physics, Incremental, Skill;
HTML5, Data Module saves, mobile BOTH, SDK mute; covers from `covers/v2`, videos from `videos/v2`.
Next: wait for the review email; during Basic Launch, updates go through game page > "Submit new version" (steps 2-3 below).
The steps below are kept as the recipe for future submissions.

## Why a new game
The original "When Pigs Fly" (portal id f6f93a6e-72b0-488a-ade2-a32e31ccef54) was **rejected on 03.10.2026** after Basic Launch
("did not reach the performance benchmarks"). CrazyGames does not accept new versions of a rejected game: per their docs
(https://docs.crazygames.com/resources/basic-launch-metrics/) it must be **submitted as a NEW game with significant improvements**.
The old name is still taken, so the owner chose the new name **When Pigs Fly: Yeet to the Moon**. Do not delete the old entry.

Improvements since the rejected build (commits 48b9186, bd8dbe2, 118791b): one-button controls (hold = fly up, let go = glide),
calm HUD, one-click "Upgrade & Yeet!" button, soft Nana-to-the-Moon style shop and cards, new logo, new listing text.

## Files
- Build: `node tools/pack.mjs crazygames` -> `dist/when-pigs-fly-crazygames/` (46 files, ~330 KB, `index.html` at the root,
  CrazyGames SDK v3, ads OFF in the crazygames adapter, as Basic Launch requires). `node --test tests/*.test.mjs`: 63 pass.
- Covers (new logo): `covers/v2/cover-landscape-1920x1080.png`, `cover-portrait-800x1200.png`, `cover-square-800x800.png`
  (re-render: dev server on 8771, then `tools/cover-art.html?w=W&h=H&img=gpt-landscape-b.png|gpt-portrait.png` in headless Edge).
- Preview videos (13 s, under the 10 MB upload cap): `videos/v2/landscape.mp4` (1280x720), `videos/v2/portrait.mp4` (720x1280)
  (re-record: `node tools/record-video.mjs W H out.mp4 13`, dev server must run).
- Listing text: `SUBMISSION.md` (title, description, controls, tags).

## Portal steps (developer.crazygames.com, account "Jaor")
1. My Games > **Submit a game**. Name: `When Pigs Fly: Yeet to the Moon`. Engine HTML5. Saves: Data Module. Mobile: yes, both orientations.
2. Game files: the input is a **folder picker**; a .zip does not work. Upload all files of `dist/when-pigs-fly-crazygames/`
   keeping their relative paths (`css/…`, `js/…`, `js/three/…`, `vendor/…`, `fonts/…`). With browser automation: put the files
   into a temporary `<input multiple>`, then set the portal input's `files` (defineProperty) to an array of Files whose
   `webkitRelativePath`/`path` are `when-pigs-fly/<relative path>`, and dispatch `change`. Save, then **Preview / Go to QA**.
3. QA preview: the game fires `gameplayStart` on the launch screen, so the automatic checks pass. Continue opens the QA checklist:
   answer **Yes** to every row, **N/A** for the T&C row, add notes, tick the confirm box, Continue. (Owner gave permission.)
4. Details: Category **Casual** (or Arcade); tags (max 5) e.g. 3D, Funny, Animal, Upgrade, Flying; description and controls from
   `SUBMISSION.md` (Quill editors: type paragraph by paragraph). Covers: click each cover's Upload button first (sets UploadType),
   then choose the file and press Submit in the crop dialog. Videos go straight into the two video inputs; wait ~20 s for conversion.
5. Last step: tick **Terms & Conditions** and **PEGI 12**, then **Submit for approval**. (Owner gave permission for all of this.)

## Other portals (already done)
- itch.io: live at https://jaorabun.itch.io/when-pigs-fly (no ads; upload `node tools/pack.mjs itch` zip for updates).
- GameMonetize: game id 6xfnrgv6rx2dcoek8c8kikhcmwa79e3s, edit page https://gamemonetize.com/account/editgame.php?id=87675.
  Waiting on "Verify Game" (an ad must play in the owner's logged-in browser with the ad blocker off), then "Request activation".
  Rebuild with `GM_GAME_ID=6xfnrgv6rx2dcoek8c8kikhcmwa79e3s node tools/pack.mjs gamemonetize` before re-uploading.
