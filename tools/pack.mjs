// Builds one upload zip per web portal in dist/, each with only what the game
// needs at runtime and that portal's SDK wired into index.html.
// Usage: node tools/pack.mjs [platform ...]   (default: all)
// Game ids come from each portal's dashboard after you create the game there:
//   GD_GAME_ID=xxxx GM_GAME_ID=yyyy node tools/pack.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const CG_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
const forward = 'function (e) { if (window.WPF_SDK_EVENT) window.WPF_SDK_EVENT(e); }';
const id = (name) => JSON.stringify(process.env[name] || `PASTE_${name}_HERE`);

const PLATFORMS = {
  crazygames: () => `<script>window.WPF_PLATFORM = 'crazygames';</script>\n  ${CG_TAG}`,
  gamedistribution: () => `<script>
    window.WPF_PLATFORM = 'gamedistribution';
    window.GD_OPTIONS = { gameId: ${id('GD_GAME_ID')}, onEvent: ${forward} };
  </script>
  <script src="https://html5.api.gamedistribution.com/main.min.js" id="gamedistribution-jssdk"></script>`,
  gamemonetize: () => `<script>
    window.WPF_PLATFORM = 'gamemonetize';
    window.SDK_OPTIONS = { gameId: ${id('GM_GAME_ID')}, onEvent: ${forward} };
  </script>
  <script src="https://api.gamemonetize.com/sdk.js" id="gamemonetize-sdk"></script>`,
  poki: () => `<script>window.WPF_PLATFORM = 'poki';</script>
  <script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>`,
  // itch.io, Newgrounds, your own site: no ad SDK at all.
  itch: () => `<script>window.WPF_PLATFORM = 'none';</script>`,
};

const COPY = ['css', 'js', 'vendor', 'fonts'];
const wanted = process.argv.slice(2);
const targets = wanted.length ? wanted : Object.keys(PLATFORMS);

function zip(dir, out) {
  rmSync(out, { force: true });
  if (process.platform === 'win32') execFileSync('tar.exe', ['-a', '-c', '-f', out, '-C', dir, '.']);
  else execFileSync('zip', ['-qr', out, '.'], { cwd: dir });
}

function countFiles(dir) {
  return readdirSync(dir).reduce((n, f) => n + (statSync(join(dir, f)).isDirectory() ? countFiles(join(dir, f)) : 1), 0);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
if (!html.includes(CG_TAG)) throw new Error('index.html no longer has the CrazyGames SDK tag to replace');

for (const name of targets) {
  const head = PLATFORMS[name];
  if (!head) throw new Error(`unknown platform "${name}" (have: ${Object.keys(PLATFORMS).join(', ')})`);
  const stage = join(DIST, `when-pigs-fly-${name}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const d of COPY) cpSync(join(ROOT, d), join(stage, d), { recursive: true });
  writeFileSync(join(stage, 'index.html'), html.replace(CG_TAG, head()));
  const out = join(DIST, `when-pigs-fly-${name}.zip`);
  zip(stage, out);
  const kb = (statSync(out).size / 1024).toFixed(1);
  const missing = head().includes('PASTE_') ? '  (game id missing: set it, see header)' : '';
  console.log(`${name.padEnd(17)} ${countFiles(stage)} files  ${kb} KB  dist/when-pigs-fly-${name}.zip${missing}`);
}
