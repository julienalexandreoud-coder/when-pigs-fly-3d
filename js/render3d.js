// 3D renderer (Three.js). Same interface as the old 2D renderer:
// createRenderer(canvas) -> { frame(state), resize(), view, toScreen }.
// The simulation stays 2D (x right, y up); the flight plane is z = 0 and the
// camera looks at it from a slight angle so the world has depth.

import { THREE, WORLD_TIME, addOutlines } from './three/kit.js';
import { PIG_R, HILL, scaleAt, clamp, lerp, formatDistance } from './config.js';
import { createSky } from './three/sky3d.js';
import { createGround } from './three/ground3d.js';
import { createFarm } from './three/farm3d.js';
import { createObjects } from './three/objects3d.js';
import { createFx3d } from './three/fx3d.js';
import { createPig } from './three/pig3d.js';
import { createMoonScene } from './three/moon3d.js';
import { GRASS_DENSITY } from './three/grass3d.js';

const FOV = 42;
const MIN_PIG_PX = 26;
const YAW_READY = -0.22;
const YAW_FLIGHT = 0.26;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const OUTLINE_OK = (o) => !o.material.transparent && !(o.material.isMeshBasicMaterial) && !o.userData.noOutline;

// Phones and tablets: no MSAA, smaller shadow map, lower starting quality.
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const OVERLAY_DPR = TOUCH ? 1.5 : 2;

export function createRenderer(canvas) {
  const view = { W: 800, H: 600, dpr: 1 };
  const gl = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#dff4ff', 200, 1600);
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.3, 30000);

  const hemi = new THREE.HemisphereLight('#e3f2ff', '#7a9a5a', 1.5);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight('#fff3dc', 2.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight, sunLight.target);
  const lightDir = new THREE.Vector3(0.35, 0.85, 0.4).normalize();

  const sky = createSky(scene);
  const ground = createGround(scene);
  const farm = createFarm(scene);
  const objects = createObjects(scene);
  const fx3d = createFx3d(scene);
  const pig = createPig();
  scene.add(pig.root);
  pig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const carrier = objects.makeUfo();
  carrier.visible = false;
  scene.add(carrier);
  let moon = null;

  // 2D overlay for floating text, speed lines, rings and flashes.
  const overlay = document.createElement('canvas');
  overlay.id = 'fx-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;display:block';
  canvas.insertAdjacentElement('afterend', overlay);
  const g = overlay.getContext('2d');

  const rig = { yaw: YAW_READY, pitch: 0.16 };
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const scratch = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    view.W = Math.max(1, r.width || window.innerWidth);
    view.H = Math.max(1, r.height || window.innerHeight);
    gl.setPixelRatio(Math.min(view.dpr, view.W * view.H > 1.6e6 ? 1.5 : 2, LEVELS[perf.level].ratio));
    gl.setSize(view.W, view.H, false);
    view.odpr = Math.min(view.dpr, OVERLAY_DPR);
    overlay.width = Math.round(view.W * view.odpr);
    overlay.height = Math.round(view.H * view.odpr);
    camera.aspect = view.W / view.H;
    camera.updateProjectionMatrix();
  }

  function toScreen(x, y, z = 0) {
    tmp.set(x, y, z).project(camera);
    return [(tmp.x * 0.5 + 0.5) * view.W, (-tmp.y * 0.5 + 0.5) * view.H];
  }

  function placeCamera(s, dt) {
    const cam = s.cam;
    const viewH = view.H / cam.z;
    const d = viewH / 2 / TAN;
    const ready = s.mode === 'ready';
    const f = s.flight;
    const nearGround = f ? clamp(1 - (f.y - s.world.terrain.height(f.x)) / 120, 0, 1) : 1;
    const k = 1 - Math.exp(-dt * 2.5);
    rig.yaw += ((ready ? YAW_READY : YAW_FLIGHT) - rig.yaw) * k;
    rig.pitch += ((ready ? 0.2 : lerp(0.03, 0.12, nearGround)) - rig.pitch) * k;
    const [sx, sy] = s.fx.shakeOffset();
    target.set(cam.x + sx / cam.z, cam.y - sy / cam.z, 0);
    camera.position.set(
      target.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * d,
      target.y + Math.sin(rig.pitch) * d,
      Math.cos(rig.yaw) * Math.cos(rig.pitch) * d,
    );
    camera.lookAt(target);
    camera.near = Math.max(0.3, d * 0.05);
    camera.far = 30000;
    camera.updateProjectionMatrix();
    scene.fog.near = 150 + d * 1.5;
    scene.fog.far = 1700 + d * 8;
    return { d, viewH, viewW: viewH * (view.W / view.H) };
  }

  function placeLight(viewW, viewH) {
    const reach = clamp(Math.max(viewW, viewH) * 0.75, 25, 400);
    sunLight.target.position.copy(target);
    sunLight.position.copy(target).addScaledVector(lightDir, 300);
    const sc = sunLight.shadow.camera;
    if (sc.right !== reach) {
      sc.left = -reach;
      sc.right = reach;
      sc.top = reach;
      sc.bottom = -reach;
      sc.near = 10;
      sc.far = 700;
      sc.updateProjectionMatrix();
    }
  }

  // "TAP!" ring that closes in on the pig as the ground gets near.
  function drawCue(s) {
    const cue = s.cue;
    const f = s.flight;
    if (!cue || !f) return;
    const [cx, cy] = toScreen(f.x, f.y);
    const pulse = 0.5 + 0.5 * Math.sin(s.t * 18);
    const r = cue.hop ? 44 + pulse * 6 : 34 + (1 - cue.k) * 70;
    g.lineWidth = cue.now ? 6 : 3;
    g.strokeStyle = cue.now ? '#b8ff2e' : 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    if (!cue.now) return;
    const label = cue.hop ? 'TAP = HOP' : 'TAP!';
    g.font = `400 ${cue.hop ? 22 : 30}px Bangers, Impact, sans-serif`;
    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = '#141014';
    g.strokeText(label, cx, cy - r - 8);
    g.fillStyle = '#b8ff2e';
    g.fillText(label, cx, cy - r - 8);
  }

  function drawOverlay(s) {
    const { W, H } = view;
    const dpr = view.odpr || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const f = s.flight;
    if (f && s.mode === 'flying') {
      const speed = Math.hypot(f.vx, f.vy);
      const a = Math.min(0.45, (speed - 50) / 400);
      if (a > 0) {
        const ang = Math.atan2(-f.vy, f.vx);
        const len = 40 + speed * 0.25;
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const seed = (i * 7919 + Math.floor(s.t * 20) * 131) % 1000;
          const x = (seed / 1000) * W;
          const y = (((seed * 37) % 1000) / 1000) * H;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
          g.stroke();
        }
      }
    }
    for (const r of s.fx.rings) {
      const k = r.age / r.life;
      const [cx, cy] = toScreen(r.x, r.y);
      g.strokeStyle = `rgba(${r.color},${1 - k})`;
      g.lineWidth = 10 * (1 - k) + 2;
      g.beginPath();
      g.arc(cx, cy, r.max * k, 0, Math.PI * 2);
      g.stroke();
    }
    if (s.mode === 'flying') drawCue(s);
    s.fx.drawTexts(g, (x, y) => toScreen(x, y));
    if (s.bestAlt >= 40 && s.mode === 'flying') {
      const [, sy] = toScreen(s.cam.x - (W / s.cam.z) * 0.4, s.bestAlt);
      if (sy > 30 && sy < H - 30) {
        g.font = '900 13px "Trebuchet MS", system-ui, sans-serif';
        g.textAlign = 'left';
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(58,34,48,0.6)';
        g.strokeText(`BEST ${formatDistance(s.bestAlt)}`, 12, sy - 9);
        g.fillStyle = '#ffffff';
        g.fillText(`BEST ${formatDistance(s.bestAlt)}`, 12, sy - 9);
      }
    }
    s.fx.drawFlash(g, W, H);
  }

  // ---------- adaptive quality ----------
  const perf = { level: TOUCH ? 2 : 0, ema: 16, slowFor: 0, lastNow: performance.now() };
  const LEVELS = [
    { ratio: 2, grass: 1, shadows: true },
    { ratio: 1.25, grass: 0.6, shadows: true },
    { ratio: 1, grass: 0.3, shadows: false },
    { ratio: 0.8, grass: 0, shadows: false },
  ];
  function applyLevel() {
    const L = LEVELS[perf.level];
    gl.setPixelRatio(Math.min(view.dpr, L.ratio));
    gl.setSize(view.W, view.H, false);
    GRASS_DENSITY.value = L.grass;
    scene.traverse((o) => { if (o.userData.grass) o.count = Math.floor(o.userData.full * L.grass); });
    if (gl.shadowMap.enabled !== L.shadows) {
      gl.shadowMap.enabled = L.shadows;
      sunLight.castShadow = L.shadows;
      scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    }
  }
  function watchPerf() {
    const now = performance.now();
    const d = Math.min(200, now - perf.lastNow);
    perf.lastNow = now;
    if (document.hidden || d > 150) return;
    perf.ema += (d - perf.ema) * 0.05;
    perf.slowFor = perf.ema > 24 ? perf.slowFor + d : 0;
    if (perf.slowFor > 1500 && perf.level < LEVELS.length - 1) {
      perf.level += 1;
      perf.slowFor = 0;
      perf.ema = 16;
      applyLevel();
      console.info('[render] quality level', perf.level);
    }
  }

  let lastT = 0;
  function frame(s) {
    watchPerf();
    const dt = clamp(s.t - lastT, 0, 0.1);
    lastT = s.t;
    if (s.mode === 'moon') {
      if (!moon) moon = createMoonScene();
      moon.render(gl, pig, s, view);
      g.setTransform(view.odpr || 1, 0, 0, view.odpr || 1, 0, 0);
      g.clearRect(0, 0, view.W, view.H);
      s.fx.drawFlash(g, view.W, view.H);
      return;
    }
    if (pig.root.parent !== scene) scene.add(pig.root);
    WORLD_TIME.value = s.t;

    const { viewW, viewH } = placeCamera(s, dt);
    placeLight(viewW, viewH);
    const cam = s.cam;
    const alt = cam.y;
    sky.update(camera.position, alt, viewW, viewH, scene.fog);
    const space = clamp((alt - 3500) / 4000, 0, 1);
    hemi.intensity = lerp(1.5, 0.9, space);
    hemi.color.copy(sky.top).lerp(new THREE.Color('#ffffff'), 0.6);

    // Ground and farm.
    const x0 = cam.x - viewW * 0.9 - 60;
    const x1 = cam.x + viewW * 1.4 + 140;
    const groundVisible = cam.y - viewH < 700;
    ground.update(s.world.terrain, x0, x1, groundVisible, s.flight && s.mode !== 'ready' ? s.flight.blown : null);
    const farmVisible = cam.x - viewW < 80 && cam.y < 500;
    const ready = s.mode === 'ready';
    const seat = farm.update({
      tier: s.tiers.launcher || 0, pull: ready ? s.pull : s.launchKick, t: s.t, cheer: s.farmerCheer, visible: farmVisible,
    });

    // Sky objects.
    scratch.length = 0;
    const qx0 = cam.x - viewW * 0.8 - 30;
    const qx1 = cam.x + viewW * 1.1 + 30;
    const objs = s.world.query(qx0, cam.y - viewH * 0.8 - 30, qx1, cam.y + viewH * 0.8 + 30, scratch);
    const f = s.flight;
    const abductUfo = f && f.abduct ? f.abduct.ufo : null;
    objects.update(objs, s.t, { taken: f ? f.taken : null, hasRocket: s.hasRocket, carrying: abductUfo });

    // Pig.
    const pr = PIG_R * scaleAt(f && !ready ? f.y : HILL);
    const minScale = MIN_PIG_PX / (cam.z * PIG_R);
    if (f && !ready) {
      pig.root.position.set(f.x, f.y, 0);
      pig.root.rotation.set(0, 0, f.angle);
      pig.root.scale.setScalar(Math.max(pr, minScale * PIG_R));
    } else {
      pig.root.position.copy(seat);
      pig.root.rotation.set(0, 0, 0.66);
      pig.root.scale.setScalar(PIG_R);
    }
    pig.update({
      skin: s.skin, tiers: s.tiers, face: s.face, boosting: s.boosting, t: s.t, squash: s.squash,
      flap: s.mode === 'flying' ? 1 : 0.3,
    });
    addOutlines(pig.root, OUTLINE_OK);
    // Crash ending: Pip bursts into cartoon pieces; any new flight (or a
    // Second Wind rebound) puts the pig back together.
    const crashed = f && !ready && f.done && !f.moon && f.cause !== 'quit';
    if (crashed && !pig.shattered) pig.shatter(scene, f.cause === 'mud' ? 0.8 : 1.15);
    else if (!crashed && pig.shattered) pig.reassemble();
    if (pig.shattered) pig.updatePieces(dt, (x, z) => ground.heightAt(s.world.terrain, x, z));
    carrier.visible = Boolean(abductUfo);
    if (abductUfo) {
      const u = { ...abductUfo, x: f.x, y: f.y + abductUfo.r * 2.2, beam: abductUfo.r * 2.4 };
      objects.place(carrier, u, s.t, { carrying: null });
    }

    fx3d.update({
      fx: s.fx, dpr: gl.getPixelRatio(), trailPts: f && !ready ? s.trail : [], head: f ? { x: f.x, y: f.y } : null,
      skinTrail: s.skin.trail, trailWidth: Math.max(pr * 0.45, 3 / cam.z),
      best: s.bestAlt, x0: cam.x - viewW, x1: cam.x + viewW * 1.5, showBest: s.bestAlt >= 40 && s.mode === 'flying',
    });

    gl.render(scene, camera);
    drawOverlay(s);
  }

  resize();
  applyLevel();
  // Compile every shader up front: first-use compiles caused mid-flight hitches.
  try {
    const done = objects.prewarm();
    pig.update({ skin: { id: 'warm', body: '#ffb0c4', snout: '#ff95b3', ear: '#f07c9c', glow: true, trail: '#fff' }, tiers: { wings: 6, rocket: 6, helmet: 4 }, boosting: true });
    camera.position.set(0, 30, 60);
    camera.lookAt(0, 25, 0);
    gl.compile(scene, camera);
    done();
  } catch (err) {
    console.warn('[render] shader prewarm failed', err);
  }
  return { frame, resize, view, toScreen };
}
