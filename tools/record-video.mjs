// Records a gameplay preview video (MP4, H.264) of the real 3D game flown by
// the autopilot bot. Uses headless Edge over the DevTools protocol and the
// browser's own MediaRecorder (no ffmpeg). The WebGL canvas and the 2D effects
// overlay are composited into one canvas that is recorded.
//
// Usage: node tools/record-video.mjs <width> <height> <out.mp4> [seconds=18] [url]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [W, H] = [Number(process.argv[2] || 1280), Number(process.argv[3] || 720)];
const OUT = process.argv[4] || 'videos/preview.mp4';
const SECONDS = Number(process.argv[5] || 18);
const URL_TO_OPEN = process.argv[6] || 'http://localhost:8771/?debug&sandbox&nopause';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9300 + Math.floor(Math.random() * 500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio',
  '--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'wpf-rec-'))}`, 'about:blank',
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
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});

try {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: URL_TO_OPEN });
  await sleep(4000);
  const script = `(async () => {
    const mime = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01F', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return { error: 'MP4 recording not supported' };
    // Mid-game gear: a real-looking flight through several sky layers.
    wpf.tiers({ launcher: 5, wings: 4, rocket: 4, tank: 5, helmet: 2, belly: 2, magnet: 2 });
    document.querySelectorAll('#ready .ready-top, #ready .missions, #ready .ready-side').forEach((e) => { e.style.visibility = 'hidden'; });
    const gl = document.getElementById('game');
    const fxo = document.getElementById('fx-overlay');
    const out = document.createElement('canvas');
    out.width = ${W}; out.height = ${H};
    const g = out.getContext('2d');
    let live = true;
    (function draw() {
      if (!live) return;
      g.drawImage(gl, 0, 0, ${W}, ${H});
      g.drawImage(fxo, 0, 0, ${W}, ${H});
      requestAnimationFrame(draw);
    })();
    const rec = new MediaRecorder(out.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start(500);
    await new Promise((r) => setTimeout(r, 1200));
    wpf.launch();
    wpf.autoplay(true);
    // Relaunch straight away whenever a flight ends, so the video is all action.
    const shots = [];
    const snap = (sec) => setTimeout(() => shots.push(out.toDataURL('image/jpeg', 0.7)), sec * 1000 - 1200);
    [3, 9, 15].forEach(snap);
    const again = setInterval(() => {
      const m = wpf.state.mode;
      if (m === 'results' || m === 'moon') { wpf.tiers({}); wpf.launch(); wpf.autoplay(true); }
    }, 200);
    await new Promise((r) => setTimeout(r, ${SECONDS * 1000 - 1200}));
    rec.stop();
    clearInterval(again);
    live = false;
    await done;
    const blob = new Blob(chunks, { type: mime });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mime, shots, bytes: buf.length, alt: Math.round(wpf.state.flight ? wpf.state.flight.maxAlt : 0), data: btoa(bin) };
  })()`;
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: (SECONDS + 30) * 1000 });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  if (result.value.error) throw new Error(result.value.error);
  writeFileSync(OUT, Buffer.from(result.value.data, 'base64'));
  result.value.shots.forEach((d, i) => writeFileSync(OUT.replace(/\.mp4$/, `-frame${i + 1}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
  console.log(`${OUT}: ${result.value.mime}, ${(result.value.bytes / 1e6).toFixed(2)} MB, max altitude ${result.value.alt} m`);
} finally {
  ws.close();
  edge.kill();
}
