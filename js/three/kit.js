// Shared 3D helpers: cel-shaded materials, a geometry merger for static
// low-poly models (one draw call per model), and small shape factories.

import * as THREE from 'three';

export { THREE };

let gradient = null;
// Three-step light ramp: the cartoon "cel" look for every toon material.
export function gradientMap() {
  if (gradient) return gradient;
  // Four soft steps: readable cel shading without harsh banding.
  const data = new Uint8Array([150, 150, 150, 255, 190, 190, 190, 255, 226, 226, 226, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map();
export function toon(color, { emissive = null, emissiveIntensity = 0.6, transparent = false, opacity = 1 } = {}) {
  const key = `${color}|${emissive}|${emissiveIntensity}|${opacity}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), transparent: transparent || opacity < 1, opacity });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = emissiveIntensity;
    }
    toonCache.set(key, m);
  }
  return m;
}

let vcToon = null;
// Toon material driven by per-vertex colors (used by merged models).
export function vertexToon() {
  if (!vcToon) vcToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  return vcToon;
}

const basicCache = new Map();
export function glow(color, opacity = 1, additive = false) {
  const key = `${color}|${opacity}|${additive}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color, transparent: opacity < 1 || additive, opacity, depthWrite: !(opacity < 1 || additive),
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !additive,
    });
    basicCache.set(key, m);
  }
  return m;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();

// Matrix from position, rotation (radians, XYZ) and scale (number or [x,y,z]).
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const [sx, sy, sz] = Array.isArray(s) ? s : [s, s, s];
  tmpE.set(rx, ry, rz);
  tmpQ.setFromEuler(tmpE);
  tmpP.set(x, y, z);
  tmpS.set(sx, sy, sz);
  return tmpM.clone().compose(tmpP, tmpQ, tmpS);
}

const IDENTITY_M = new THREE.Matrix4();
const IDENTITY = IDENTITY_M.elements;
const nm = new THREE.Matrix3();
const baseFlat = new WeakMap();
const baseSmooth = new WeakMap();
function baseArrays(geom, flat) {
  const cache = flat ? baseFlat : baseSmooth;
  let b = cache.get(geom);
  if (!b) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (flat || !g.attributes.normal) g.computeVertexNormals();
    b = { pos: g.attributes.position.array.slice(), nrm: g.attributes.normal.array.slice() };
    g.dispose();
    cache.set(geom, b);
  }
  return b;
}
const colors = new Map();
function colorCache(color) {
  let c = colors.get(color);
  if (!c) { c = new THREE.Color(color); colors.set(color, c); }
  return c;
}

// Collects geometries (each with a color and transform) into one
// non-indexed, vertex-colored BufferGeometry.
export class Builder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
  }

  // Fast path: the unit shape's non-indexed positions/normals are cached once,
  // then transformed here (no geometry clones or normal recomputation).
  add(geom, color, matrix = null, { flat = true } = {}) {
    const base = baseArrays(geom, flat);
    const c = colorCache(color);
    const p = base.pos;
    const n = base.nrm;
    const e = matrix ? matrix.elements : IDENTITY;
    nm.getNormalMatrix(matrix || IDENTITY_M);
    const ne = nm.elements;
    const P = this.pos;
    const N = this.nrm;
    const C = this.col;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i];
      const y = p[i + 1];
      const z = p[i + 2];
      P.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const a = n[i];
      const b = n[i + 1];
      const d = n[i + 2];
      let nx = ne[0] * a + ne[3] * b + ne[6] * d;
      let ny = ne[1] * a + ne[4] * b + ne[7] * d;
      let nz = ne[2] * a + ne[5] * b + ne[8] * d;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      N.push(nx, ny, nz);
      C.push(c.r, c.g, c.b);
    }
    return this;
  }

  // Adds geometry with a per-vertex color function (x, y, z) -> THREE.Color.
  addPainted(geom, paint, matrix = null) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    g.computeVertexNormals();
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 9) {
      const c = paint((p[i] + p[i + 3] + p[i + 6]) / 3, (p[i + 1] + p[i + 4] + p[i + 7]) / 3, (p[i + 2] + p[i + 5] + p[i + 8]) / 3);
      for (let k = 0; k < 9; k++) {
        this.pos.push(p[i + k]);
        this.nrm.push(n[i + k]);
      }
      for (let k = 0; k < 3; k++) this.col.push(c.r, c.g, c.b);
    }
    g.dispose();
    return this;
  }

  get empty() {
    return this.pos.length === 0;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }

  mesh({ shadow = true, receive = false } = {}) {
    const m = new THREE.Mesh(this.build(), vertexToon());
    m.castShadow = shadow;
    m.receiveShadow = receive;
    return m;
  }
}

// ---------- shape factories (unit sized) ----------
// Memoized: the same unit geometry instance is reused everywhere (marked shared
// so nothing disposes it).
const geoMemo = new Map();
function memo(key, make) {
  let g = geoMemo.get(key);
  if (!g) { g = make(); g.userData.shared = true; geoMemo.set(key, g); }
  return g;
}
export const G = {
  sphere: (w = 12, h = 9) => memo(`s${w},${h}`, () => new THREE.SphereGeometry(1, w, h)),
  ico: (d = 1) => memo(`i${d}`, () => new THREE.IcosahedronGeometry(1, d)),
  box: () => memo('b', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (top = 1, bottom = 1, seg = 12) => memo(`c${top},${bottom},${seg}`, () => new THREE.CylinderGeometry(top, bottom, 1, seg)),
  cone: (seg = 10) => memo(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg)),
  torus: (tube = 0.25, arc = Math.PI * 2, seg = 16) => memo(`t${tube},${arc},${seg}`, () => new THREE.TorusGeometry(1, tube, 8, seg, arc)),
  dodeca: (d = 0) => memo(`d${d}`, () => new THREE.DodecahedronGeometry(1, d)),
};

// Five-pointed star extruded to a thin slab, lying in the XY plane.
export function starGeometry(outer = 1, inner = 0.45, depth = 0.3) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.3, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Lightning bolt slab in the XY plane, about 1 unit tall.
export function boltGeometry() {
  const s = new THREE.Shape();
  const pts = [[0.1, 0.5], [-0.2, 0.02], [0.02, 0.02], [-0.12, -0.5], [0.25, 0.1], [0.04, 0.1], [0.2, 0.5]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false });
  g.translate(0, 0, -0.04);
  return g;
}

// Deterministic 0..1 noise from integers (for decoration placement).
export function hash01(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------- cartoon outlines (inverted hull, constant screen width) ----------
let outlineMat = null;
export function outlineMaterial() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { width: { value: 0.0032 }, color: { value: new THREE.Color('#2a1a24') } },
    vertexShader: `uniform float width;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * width * max(1.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
  });
  return outlineMat;
}

// Adds an outline child to every mesh under `root` that passes `filter`.
export function addOutlines(root, filter = () => true) {
  const targets = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.outline && filter(o)) targets.push(o); });
  for (const o of targets) {
    if (o.children.some((ch) => ch.userData.outline)) continue;
    const line = new THREE.Mesh(o.geometry, outlineMaterial());
    line.userData.outline = true;
    line.raycast = () => {};
    o.add(line);
  }
  return root;
}

// Shared animated uniforms (wind for grass, water shimmer).
export const WORLD_TIME = { value: 0 };

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
