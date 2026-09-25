// Ground detail: instanced grass tufts that sway in the wind, flowers and
// pebbles. One InstancedMesh per kind per ground chunk.

import { THREE, WORLD_TIME, hash01 } from './kit.js';

// Vertex shader patch: tips (high local y) sway with world position + time.
function windPatch(shader, strength) {
  shader.uniforms.uTime = WORLD_TIME;
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp0 = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sway = sin(uTime * 2.1 + wp0.x * 0.35 + wp0.z * 0.2) + 0.5 * sin(uTime * 3.7 + wp0.x * 0.9);
      transformed.x += sway * ${strength.toFixed(3)} * position.y * position.y;
      transformed.z += sway * ${(strength * 0.4).toFixed(3)} * position.y * position.y;`);
}

function tuftGeometry() {
  const pos = [];
  const col = [];
  const base = new THREE.Color('#5fb84a');
  const tip = new THREE.Color('#c4f27a');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + hash01(k, 3) * 0.8;
    const lean = 0.18 + hash01(k, 5) * 0.2;
    const h = 0.45 + hash01(k, 7) * 0.4;
    const w = 0.06;
    const cx = Math.cos(a) * 0.1;
    const cz = Math.sin(a) * 0.1;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // Normals point up so blades light like the ground they grow from.
  const n = new Float32Array(pos.length);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

function flowerGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = [];
  const col = [];
  const white = new THREE.Color('#ffffff');
  const yellow = new THREE.Color('#ffd23f');
  const stem = new THREE.Color('#3f9a3a');
  const push = (p, c) => { pos.push(...p); col.push(c.r, c.g, c.b); };
  // stem: thin double-sided quad
  push([-0.02, 0, 0], stem); push([0.02, 0, 0], stem); push([0, 0.5, 0], stem);
  // petals: 5 triangles in a horizontal-ish disc, center yellow
  for (let k = 0; k < 5; k++) {
    const a0 = (k / 5) * Math.PI * 2;
    const a1 = a0 + 0.9;
    push([0, 0.52, 0], yellow);
    push([Math.cos(a0) * 0.16, 0.56, Math.sin(a0) * 0.16], white);
    push([Math.cos(a1) * 0.16, 0.56, Math.sin(a1) * 0.16], white);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

let tuftGeo = null;
let flowerGeo = null;
let pebbleGeo = null;
let tuftMat = null;
let flowerMat = null;
let pebbleMat = null;

function materials() {
  if (tuftMat) return;
  tuftGeo = tuftGeometry();
  flowerGeo = flowerGeometry();
  pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  for (const g of [tuftGeo, flowerGeo, pebbleGeo]) g.userData.shared = true;
  tuftMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  tuftMat.onBeforeCompile = (sh) => windPatch(sh, 0.22);
  flowerMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  flowerMat.onBeforeCompile = (sh) => windPatch(sh, 0.3);
  pebbleMat = new THREE.MeshLambertMaterial({ color: '#b9b2a6', flatShading: true });
}

// 0..1, lowered by the renderer on slow devices.
export const GRASS_DENSITY = { value: 1 };

const FLOWER_TINTS = ['#ffffff', '#fff3a0', '#ffc2e0', '#c9b6ff', '#ffffff', '#ffd6a5'];
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const c = new THREE.Color();

// Builds grass/flowers/pebbles for one chunk. `place(x, z)` returns the ground
// height or null when nothing should grow there (paths, water, mud, buildings).
export function buildGrass(chunkIndex, x0, width, place) {
  materials();
  const group = new THREE.Group();
  const specs = [
    { geo: tuftGeo, mat: tuftMat, n: 3400, zMin: -24, zMax: 22, scale: [0.45, 0.95], tint: () => c.setHSL(0.25 + Math.random() * 0.05, 0.35, 0.78 + Math.random() * 0.2) },
    { geo: flowerGeo, mat: flowerMat, n: 160, zMin: -30, zMax: 22, scale: [0.9, 1.5], tint: (k) => c.set(FLOWER_TINTS[k % FLOWER_TINTS.length]) },
    { geo: pebbleGeo, mat: pebbleMat, n: 40, zMin: -24, zMax: 20, scale: [0.12, 0.35], tint: () => c.setHSL(0.1, 0.08, 0.62 + Math.random() * 0.15) },
  ];
  specs.forEach((spec, kind) => {
    const mesh = new THREE.InstancedMesh(spec.geo, spec.mat, spec.n);
    let count = 0;
    for (let k = 0; k < spec.n; k++) {
      const x = x0 + hash01(chunkIndex, k, 100 + kind) * width;
      // denser near the flight line where the camera looks
      const r = hash01(chunkIndex, k, 200 + kind);
      const z = spec.zMin + (spec.zMax - spec.zMin) * r;
      const y = place(x, z);
      if (y === null) continue;
      const sc = spec.scale[0] + hash01(chunkIndex, k, 300 + kind) * (spec.scale[1] - spec.scale[0]);
      e.set(kind === 2 ? r * 6 : 0, hash01(chunkIndex, k, 400) * Math.PI * 2, kind === 2 ? r * 3 : 0);
      q.setFromEuler(e);
      p.set(x, y - (kind === 2 ? sc * 0.4 : 0.02), z);
      s.set(sc, kind === 2 ? sc * 0.6 : sc, sc);
      m4.compose(p, q, s);
      mesh.setMatrixAt(count, m4);
      mesh.setColorAt(count, spec.tint(k));
      count++;
    }
    mesh.userData.full = count;
    mesh.userData.grass = true;
    mesh.count = Math.floor(count * GRASS_DENSITY.value);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  return group;
}
