// Sky dome (gradient by altitude), sun, the Moon goal, stars, background
// clouds and distant mountains. Everything decorative, generated around the
// camera from hashes so it is stable while flying back and forth.

import { THREE, Builder, G, mat, hash01, vertexToon, glow } from './kit.js';
import { LAYERS, MOON_ALT, scaleAt, clamp, lerp } from '../config.js';

const SKY_R = 9000;
const CLOUD_VARIANTS = 8;
const MAX_CLOUDS = 70;
const MOUNTAIN_CELL = 300;

const colA = new THREE.Color();
const colB = new THREE.Color();

// Top/bottom sky colors blended across layer boundaries.
export function skyColors(alt, top, bottom) {
  let i = LAYERS.length - 1;
  while (i > 0 && alt < LAYERS[i].from) i--;
  const L = LAYERS[i];
  const next = LAYERS[Math.min(LAYERS.length - 1, i + 1)];
  const span = L.to - L.from;
  const k = clamp((alt - (L.to - span * 0.35)) / (span * 0.35), 0, 1);
  top.set(L.top).lerp(colA.set(next.top), k);
  bottom.set(L.bottom).lerp(colB.set(next.bottom), k);
}

function makeDome() {
  const geo = new THREE.SphereGeometry(SKY_R, 32, 16);
  const mat0 = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#4aa8f5') },
      bottom: { value: new THREE.Color('#dff4ff') },
      sunDir: { value: new THREE.Vector3(0.5, 0.5, -0.7).normalize() },
      sunAmt: { value: 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float sunAmt; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y * 1.6 + 0.12, 0.0, 1.0); vec3 c = mix(bottom, top, pow(h, 0.75));
      float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0,0.95,0.8) * pow(s, 24.0) * 0.35 * sunAmt;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat0);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

function makeStars() {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = hash01(i, 1) * 2 - 1;
    const a = hash01(i, 2) * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(a) * r * SKY_R * 0.9;
    pos[i * 3 + 1] = Math.abs(u) * SKY_R * 0.9 - SKY_R * 0.1;
    pos[i * 3 + 2] = Math.sin(a) * r * SKY_R * 0.9;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

function makeMoon() {
  const b = new Builder();
  b.addPainted(new THREE.IcosahedronGeometry(1, 3), (x, y, z) => {
    const n = Math.sin(x * 7.1 + y * 3.3) * Math.sin(z * 6.2 - y * 4.7) + Math.sin(x * 13 + z * 11) * 0.4;
    return new THREE.Color(n > 0.55 ? '#a7a39a' : n < -0.6 ? '#bdb8ad' : '#e9e4d6');
  });
  const m = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  m.frustumCulled = false;
  return m;
}

function cloudGeometry(v) {
  const b = new Builder();
  const n = 5 + Math.floor(hash01(v, 7) * 4);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.55 + (hash01(v, i, 1) - 0.5) * 0.3;
    const r = 0.45 + hash01(v, i, 2) * 0.4 - Math.abs(x) * 0.18;
    const y = r * 0.45 + hash01(v, i, 3) * 0.15;
    b.addPainted(G.ico(1), (px, py) => new THREE.Color(py < 0.12 ? '#dbe7f5' : '#ffffff'), mat(x, y, (hash01(v, i, 4) - 0.5) * 0.4, 0, 0, 0, [r, r * 0.9, r * 0.8]));
  }
  const g = b.build();
  g.userData.shared = true;
  return g;
}

function mountainMesh(cell) {
  const b = new Builder();
  const n = 2 + Math.floor(hash01(cell, 3) * 2);
  for (let i = 0; i < n; i++) {
    const h = 180 + hash01(cell, i, 5) * 260;
    const r = 200 + hash01(cell, i, 6) * 220;
    const x = cell * MOUNTAIN_CELL + hash01(cell, i, 7) * MOUNTAIN_CELL;
    const z = -1500 - hash01(cell, i, 8) * 700;
    const snow = h * (0.72 + hash01(cell, i, 9) * 0.1);
    b.addPainted(new THREE.ConeGeometry(1, 1, 6 + Math.floor(hash01(cell, i) * 3), 3), (px, py) => new THREE.Color(py > snow - h / 2 ? '#f4f7fb' : py > 0 ? '#7f9cc0' : '#6b8fb0'),
      mat(x, h / 2 - 10, z, 0, hash01(cell, i, 10) * 3, 0, [r, h, r]));
  }
  const m = new THREE.Mesh(b.build(), vertexToon());
  return m;
}

export function createSky(scene) {
  const dome = makeDome();
  scene.add(dome);
  const stars = makeStars();
  scene.add(stars);
  const moon = makeMoon();
  scene.add(moon);
  const sun = new THREE.Mesh(G.sphere(16, 10), glow('#fff6d5'));
  sun.material = new THREE.MeshBasicMaterial({ color: '#fff4c4', fog: false });
  scene.add(sun);
  const sunDir = new THREE.Vector3(-0.55, 0.3, -0.78).normalize();
  const moonDir = new THREE.Vector3(0.4, 0.3, -0.87).normalize();

  const cloudGeos = Array.from({ length: CLOUD_VARIANTS }, (_, v) => cloudGeometry(v));
  const cloudMat = vertexToon();
  const clouds = new Map();
  const cloudPool = [];
  const mountains = new Map();
  const top = new THREE.Color();
  const bottom = new THREE.Color();

  function cloudAt(key, x, y, z, size, v) {
    let m = clouds.get(key);
    if (!m) {
      m = cloudPool.pop() || new THREE.Mesh(cloudGeos[0], cloudMat);
      m.geometry = cloudGeos[v];
      m.position.set(x, y, z);
      m.scale.set(size, size * 0.8, size);
      scene.add(m);
      clouds.set(key, m);
    }
    m.userData.seen = true;
  }

  function updateClouds(cx, cy, viewW, viewH) {
    for (const m of clouds.values()) m.userData.seen = false;
    let count = 0;
    for (let b = 0; b < LAYERS.length - 1 && count < MAX_CLOUDS; b++) {
      const L = LAYERS[b];
      const S = L.scale;
      const cell = L.cell * 1.6;
      const y0 = Math.max(L.from + (b === 0 ? 30 : 0), cy - viewH * 2.2);
      const y1 = Math.min(L.to, cy + viewH * 2.2);
      if (y1 <= y0) continue;
      const density = [0.35, 0.55, 0.9, 0.55, 0.25][b];
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        for (let gx = Math.floor((cx - viewW * 2.5) / cell); gx <= Math.floor((cx + viewW * 2.5) / cell); gx++) {
          for (let k = 0; k < 2; k++) {
            if (hash01(gx, gy * 7 + b, k) > density) continue;
            const y = gy * cell + hash01(gx, gy, k + 11) * cell;
            if (y < L.from || y > L.to) continue;
            const x = gx * cell + hash01(gx, gy, k + 12) * cell;
            const z = -(35 + hash01(gx, gy, k + 13) * 190) * S;
            const size = (7 + hash01(gx, gy, k + 14) * 9) * S;
            cloudAt(`${b}:${gx}:${gy}:${k}`, x, y, z, size, Math.floor(hash01(gx, gy, k + 15) * CLOUD_VARIANTS));
            if (++count >= MAX_CLOUDS) break;
          }
        }
      }
    }
    for (const [key, m] of clouds) {
      if (m.userData.seen) continue;
      scene.remove(m);
      clouds.delete(key);
      cloudPool.push(m);
    }
  }

  function updateMountains(cx, cy) {
    const show = cy < 3000;
    const c0 = Math.floor((cx - 2500) / MOUNTAIN_CELL);
    const c1 = Math.floor((cx + 2500) / MOUNTAIN_CELL);
    for (const [c, m] of mountains) {
      if (!show || c < c0 - 2 || c > c1 + 2) {
        scene.remove(m);
        m.geometry.dispose();
        mountains.delete(c);
      }
    }
    if (!show) return;
    for (let c = c0; c <= c1; c++) {
      if (mountains.has(c)) continue;
      const m = mountainMesh(c);
      scene.add(m);
      mountains.set(c, m);
    }
  }

  return {
    top, bottom, sunDir, moon,
    // camPos: THREE.Vector3; alt: camera focus altitude; view: metres visible.
    update(camPos, alt, viewW, viewH, fog) {
      skyColors(alt, top, bottom);
      dome.position.copy(camPos);
      dome.material.uniforms.top.value.copy(top);
      dome.material.uniforms.bottom.value.copy(bottom);
      const space = clamp((alt - 3500) / 3500, 0, 1);
      dome.material.uniforms.sunAmt.value = 1 - space * 0.7;
      stars.position.copy(camPos);
      stars.material.opacity = space;
      stars.visible = space > 0.01;
      sun.position.copy(camPos).addScaledVector(sunDir, SKY_R * 0.8);
      sun.scale.setScalar(SKY_R * 0.8 * 0.035);
      const mk = clamp(alt / MOON_ALT, 0, 1);
      const moonR = SKY_R * 0.75;
      moon.position.copy(camPos).addScaledVector(moonDir, moonR);
      moon.scale.setScalar(moonR * lerp(0.035, 0.34, mk * mk * mk));
      moon.rotation.y = 0.4;
      if (fog) {
        fog.color.copy(bottom);
      }
      updateClouds(camPos.x, alt, viewW, viewH);
      updateMountains(camPos.x, alt);
      void scaleAt;
    },
  };
}
