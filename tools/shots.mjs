// Captures gameplay screenshots (PNG, with the UI) at key moments, using
// headless Edge over the DevTools protocol. Needs the dev server running.
// Usage: node tools/shots.mjs [outDir=marketing] [width=1600] [height=900]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] || 'marketing';
const W = Number(process.argv[3] || 1600);
const H = Number(process.argv[4] || 900);
const URL_TO_OPEN = 'http://localhost:8771/?debug&sandbox&nopause';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9800 + Math.floor(Math.random() * 150);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio',
  '--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'wpf-shot-'))}`, 'about:blank',
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Edge DevTools endpoint did not come up');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const run = async (js) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
};
const shot = async (name) => {
  await sleep(250);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
  console.log('saved', join(OUT, name));
};

try {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: URL_TO_OPEN });
  await sleep(4500);

  // 1. Launch screen with a circus cannon.
  await run(`wpf.tiers({ launcher: 4, wings: 3, rocket: 3, tank: 4, helmet: 2 }); await new Promise(r => setTimeout(r, 800));`);
  await shot('1-launch-screen.png');

  // 2. Low flight over the farm, just after launch.
  await run(`wpf.launch(); wpf.autoplay(true); wpf.step(1.4);`);
  await shot('2-flight-farm.png');

  // 3. Higher up, in the clouds (stronger gear for altitude).
  await run(`wpf.tiers({ launcher: 6, wings: 5, rocket: 5, tank: 6, helmet: 3 }); await new Promise(r => setTimeout(r, 300)); wpf.launch(); wpf.autoplay(true);
    for (let i = 0; i < 900 && wpf.state.flight.y < 780; i++) wpf.step(1 / 30, 30);`);
  await shot('3-cloud-kingdom.png');

  // 4. The crash: pig breaks into pieces.
  await run(`wpf.tiers({ launcher: 3, wings: 1 }); await new Promise(r => setTimeout(r, 300)); wpf.launch(); wpf.autoplay(true);
    for (let i = 0; i < 2400 && wpf.state.mode === 'flying'; i++) wpf.step(1 / 60, 60);
    wpf.step(0.12, 60);`);
  await shot('4-crash.png');

  // 5. The shop.
  await run(`wpf.coins(2500); await new Promise(r => setTimeout(r, 400)); document.getElementById('btn-barn').click(); await new Promise(r => setTimeout(r, 600));`);
  await shot('5-oink-shop.png');
} finally {
  ws.close();
  edge.kill();
}
