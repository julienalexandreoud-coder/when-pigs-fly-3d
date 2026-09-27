// 3D ground built per terrain segment: the flight line (z = 0) follows the
// game's terrain height exactly; behind it the land rolls into hills.
// Each chunk is one merged mesh plus water, plus merged decoration.

import { THREE, Builder, G, mat, hash01, vertexToon, toon } from './kit.js';
import { buildGrass } from './grass3d.js';
import { SEG } from '../terrain.js';

const XSTEP = 2.5;
const ZROWS = [-460, -380, -310, -260, -220, -185, -155, -130, -108, -90, -74, -60, -48, -38, -30, -23, -17, -12, -8, -4, -1.5, 0, 1.5, 4, 8, 14, 24, 40, 70];
const NEAR = 5;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const GRASS = ['#7fd35a', '#7dd158', '#81d45c'];

// Ground material: smooth Lambert + procedural value noise in world space, so
// grass reads as soft patches (no textures shipped).
let groundMat = null;
function groundMaterial() {
  if (groundMat) return groundMat;
  groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  groundMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldP;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = vnoise(vWorldP.xz * 0.09) * 0.55 + vnoise(vWorldP.xz * 0.45) * 0.3 + vnoise(vWorldP.xz * 2.2) * 0.15;
        diffuseColor.rgb *= 0.86 + n * 0.28;
        float farm = step(vWorldP.x, 14.0) * step(-60.0, vWorldP.x) * step(-40.0, vWorldP.z) * step(vWorldP.z, 20.0);
        diffuseColor.rgb *= 1.0 + farm * 0.05 * sign(sin(vWorldP.x * 0.8));`);
  };
  return groundMat;
}
const c = new THREE.Color();

// Land behind the flight line: a low valley of fields, rising into hills far back.
function backHills(x, z) {
  const d = -z;
  const a = 0.5 + 0.5 * Math.sin(x / 61 + z / 47);
  const b = 0.5 + 0.5 * Math.sin(x / 113 - z / 83 + 1.7);
  const valley = (a * 3 + b * 2) * Math.min(1, d / 60);
  const rise = Math.max(0, d - 170);
  return valley + rise * (0.1 + 0.12 * a * b) + Math.max(0, d - 300) * 0.1 * b;
}

const FIELDS = ['#9ad86a', '#7cc95a', '#e9c46a', '#b9d96b', '#6fbf52', '#d9b26f', '#8fd16a'];
const PLOW = ['#b5835a', '#a0714b'];
function fieldColor(x, z) {
  const fx = Math.floor((x + z * 0.35) / 46);
  const fz = Math.floor(z / 38);
  const v = hash01(fx, fz, 41);
  if (v < 0.12) {
    const stripe = Math.floor((x + z * 0.35) / 3) % 2;
    return PLOW[stripe ? 1 : 0];
  }
  return FIELDS[Math.floor(hash01(fx, fz, 42) * FIELDS.length)];
}

const UP = new THREE.Vector3(0, 1, 0);
let hedgeG = null;
let pineG = null;
function hedgeGeo() {
  if (!hedgeG) {
    hedgeG = new Builder().add(G.ico(1), '#ffffff', null, { flat: false }).build();
    hedgeG.userData.shared = true;
  }
  return hedgeG;
}
// Pine with white foliage (tinted per instance) and a brown trunk.
function pineGeo() {
  if (!pineG) {
    const b = new Builder();
    b.add(G.cyl(0.3, 0.4, 6), '#6b4a3a', mat(0, 1, 0, 0, 0, 0, [1, 2, 1]));
    for (let k = 0; k < 3; k++) b.add(G.cone(7), k % 2 ? '#e8f5e0' : '#ffffff', mat(0, 2.6 + k * 1.5, 0, 0, k, 0, [2.4 - k * 0.6, 2.4, 2.4 - k * 0.6]));
    pineG = b.build();
    pineG.userData.shared = true;
  }
  return pineG;
}

export function createGround(scene) {
  const chunks = new Map();
  const waterMat = new THREE.MeshToonMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.88, gradientMap: toon('#fff').gradientMap });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: '#6fbf52' }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -3;
  scene.add(far);

  function heightAt(terrain, x, z) {
    const h = terrain.height(x);
    if (z >= -NEAR && z <= NEAR) return h;
    if (z > NEAR) return h - Math.min(6, (z - NEAR) * 0.12);
    // The launch plateau reaches further back so the farm buildings sit on it.
    const plateau = x < 12 ? 42 : 42 * (1 - smooth((x - 12) / 40));
    const t = smooth((-z - NEAR - plateau) / 55);
    return h * (1 - t) + backHills(x, z) * t;
  }

  function colorAt(terrain, i, x, y, z) {
    const seg = terrain.segment(i);
    const ft = seg.feature;
    if (ft && Math.abs(z) < 7.5) {
      if (ft.type === 'mud' && x > ft.x0 - 1 && x < ft.x1 + 1) return c.set(hash01(x * 3, z * 5) < 0.5 ? '#7a5230' : '#6b4226');
      if (ft.type === 'pond' && x > ft.x0 - 2.5 && x < ft.x1 + 2.5) return c.set('#e3cf8f');
    }
    if (x < 8 && x > -70 && Math.abs(z + 1) < 2.2 && x > -30) return c.set('#c9a36b');
    if (z < -26 && z > -300 && y < 30) return c.set(fieldColor(x, z));
    const k = Math.floor(hash01(Math.floor(x * 2), Math.floor(z * 2), 3) * GRASS.length);
    c.set(GRASS[k]);
    if (y > 30) c.lerp(new THREE.Color('#5fae4e'), Math.min(1, (y - 30) / 60));
    return c;
  }

  function groundMesh(terrain, i) {
    const x0 = i * SEG;
    const cols = Math.round(SEG / XSTEP);
    const pos = [];
    const col = [];
    const tris = [];
    const vert = (ix, iz) => {
      const x = x0 + ix * XSTEP;
      const z = ZROWS[iz];
      const jx = ix > 0 && ix < cols && Math.abs(z) > 10 ? (hash01(ix + i * 97, iz) - 0.5) * XSTEP * 0.6 : 0;
      return [x + jx, heightAt(terrain, x + jx, z), z];
    };
    const grid = [];
    let idx = 0;
    for (let iz = 0; iz < ZROWS.length; iz++) {
      grid.push([]);
      for (let ix = 0; ix <= cols; ix++) {
        const v = vert(ix, iz);
        v.idx = idx++;
        pos.push(v[0], v[1], v[2]);
        grid[iz].push(v);
      }
    }
    const tri = (a, b, d) => {
      tris.push(a.idx, b.idx, d.idx);
      const cx = (a[0] + b[0] + d[0]) / 3;
      const cy = (a[1] + b[1] + d[1]) / 3;
      const cz = (a[2] + b[2] + d[2]) / 3;
      const cc = colorAt(terrain, i, cx, cy, cz);
      for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
    };
    for (let iz = 0; iz < ZROWS.length - 1; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const a = grid[iz][ix];
        const b = grid[iz][ix + 1];
        const d = grid[iz + 1][ix];
        const e = grid[iz + 1][ix + 1];
        tri(a, d, b);
        tri(b, d, e);
      }
    }
    // Smooth normals from the shared grid, then per-triangle colors (crisp fields).
    const sharedGeo = new THREE.BufferGeometry();
    sharedGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sharedGeo.setIndex(tris);
    sharedGeo.computeVertexNormals();
    const g = sharedGeo.toNonIndexed();
    sharedGeo.dispose();
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, groundMaterial());
    m.receiveShadow = true;
    return m;
  }

  function tree(b, x, y, z, s, v) {
    const trunk = '#8d5a35';
    if (v < 0.5) {
      const leaf = ['#3fa34d', '#4cb35a', '#5bbd4f', '#6cc24a'][Math.floor(v * 8) % 4];
      b.add(G.cyl(0.3, 0.45, 7), trunk, mat(x, y + 1.5 * s, z, 0, 0, 0, [s, 3 * s, s]));
      b.add(G.ico(1), leaf, mat(x, y + 4.4 * s, z, v * 9, v * 5, 0, [2.5 * s, 2.2 * s, 2.5 * s]), { flat: false });
      b.add(G.ico(1), leaf, mat(x + 1.1 * s, y + 5.3 * s, z + 0.5 * s, v * 3, 0, 0, [1.7 * s, 1.5 * s, 1.7 * s]), { flat: false });
      b.add(G.ico(1), leaf, mat(x - 0.9 * s, y + 5.6 * s, z - 0.4 * s, v * 5, 1, 0, [1.5 * s, 1.4 * s, 1.5 * s]), { flat: false });
      if (v < 0.15) for (let k = 0; k < 4; k++) b.add(G.sphere(6, 4), '#e63946', mat(x + Math.cos(k * 1.7) * 2.2 * s, y + (4 + k * 0.4) * s, z + Math.sin(k * 1.7) * 2.2 * s, 0, 0, 0, 0.22 * s));
    } else {
      b.add(G.cyl(0.3, 0.4, 6), trunk, mat(x, y + 1 * s, z, 0, 0, 0, [s, 2 * s, s]));
      for (let k = 0; k < 3; k++) {
        b.add(G.cone(7), k % 2 ? '#2d8a4e' : '#379e5a', mat(x, y + (2.6 + k * 1.5) * s, z, 0, v * 4 + k, 0, [(2.4 - k * 0.6) * s, 2.4 * s, (2.4 - k * 0.6) * s]));
      }
    }
  }

  function bush(b, x, y, z, s) {
    b.add(G.ico(1), '#4fb548', mat(x, y + 0.6 * s, z, 0, s * 4, 0, [1.4 * s, 1 * s, 1.2 * s]), { flat: false });
    b.add(G.ico(1), '#62c455', mat(x + 0.9 * s, y + 0.5 * s, z + 0.3, 0, s, 0, [0.9 * s, 0.8 * s, 0.9 * s]), { flat: false });
    if (s > 1) b.add(G.sphere(6, 4), '#ff5d8f', mat(x + 0.3, y + 1.4 * s, z + 0.8, 0, 0, 0, 0.18));
  }

  function fence(b, terrain, x, z) {
    for (let k = 0; k < 5; k++) {
      const px = x + k * 2.2;
      const y = terrain.height(px);
      b.add(G.box(), '#b07d4f', mat(px, y + 0.7, z, 0, 0, 0, [0.22, 1.4, 0.22]));
    }
    for (const hy of [0.55, 1.05]) {
      const y = terrain.height(x + 4.4);
      b.add(G.box(), '#c8925e', mat(x + 4.4, y + hy, z, 0, 0, 0, [9, 0.16, 0.1]));
    }
  }

  function sheep(b, x, y, z, v) {
    b.add(G.ico(1), '#ffffff', mat(x, y + 0.9, z, 0, 0, 0, [1.1, 0.8, 0.8]));
    b.add(G.sphere(8, 6), '#3a3a3a', mat(x + (v < 0.5 ? 1 : -1), y + 1.15, z, 0, 0, 0, [0.4, 0.38, 0.34]));
    for (const [lx, lz] of [[0.5, 0.35], [0.5, -0.35], [-0.5, 0.35], [-0.5, -0.35]]) b.add(G.box(), '#3a3a3a', mat(x + lx, y + 0.25, z + lz, 0, 0, 0, [0.14, 0.5, 0.14]));
  }

  function haystack(b, x, y, r) {
    b.add(G.cyl(r, r * 1.05, 14), '#f2c14e', mat(x, y + r * 0.55, 0, 0, 0, 0, [1, r * 1.1, 1]));
    b.add(G.sphere(14, 7), '#f5cd62', mat(x, y + r * 1.1, 0, 0, 0, 0, [r, r * 0.7, r]));
    for (const hy of [0.35, 0.8]) b.add(G.cyl(r * 1.06, r * 1.06, 14), '#d4a017', mat(x, y + r * hy, 0, 0, 0, 0, [1, 0.12, 1]));
  }

  function trampoline(b, x, y, w) {
    const r = w / 2;
    b.add(G.cyl(r, r, 18), '#3a86ff', mat(x, y + 1.05, 0, 0, 0, 0, [1, 0.14, 1]));
    b.add(G.cyl(r * 0.8, r * 0.8, 18), '#1d3557', mat(x, y + 1.08, 0, 0, 0, 0, [1, 0.14, 1]));
    b.add(G.torus(0.12, Math.PI * 2, 20), '#e63946', mat(x, y + 1.12, 0, Math.PI / 2, 0, 0, r));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      b.add(G.cyl(0.1, 0.1, 5), '#adb5bd', mat(x + Math.cos(a) * r * 0.85, y + 0.5, Math.sin(a) * r * 0.85, 0, 0, 0, [1, 1.1, 1]));
    }
  }

  // Red TNT barrel with a warning stripe and a fuse. Built as its own mesh so
  // it can disappear once it has blown up.
  function tntBarrel(x, y, r) {
    const b = new Builder();
    b.add(G.cyl(r * 0.62, r * 0.62, 14), '#e63946', mat(x, y + r * 0.62, 0, 0, 0, 0, [1, r * 1.25, 1]));
    for (const hy of [0.18, 1.06]) b.add(G.cyl(r * 0.65, r * 0.65, 14), '#3a2a2a', mat(x, y + r * hy, 0, 0, 0, 0, [1, 0.12, 1]));
    b.add(G.cyl(r * 0.64, r * 0.64, 14), '#ffd23f', mat(x, y + r * 0.62, 0, 0, 0, 0, [1, 0.26, 1]));
    b.add(G.cyl(0.07, 0.07, 6), '#141014', mat(x + 0.2, y + r * 1.4, 0, 0, 0, 0.4, [1, 0.5, 1]));
    b.add(G.sphere(8, 6), '#ffb020', mat(x + 0.32, y + r * 1.62, 0, 0, 0, 0, 0.16));
    const m = b.mesh({ shadow: true });
    m.userData.tnt = true;
    return m;
  }

  function decorMesh(terrain, i) {
    const seg = terrain.segment(i);
    const b = new Builder();
    const farB = new Builder();
    for (const d of seg.decor) {
      const z = -7 - hash01(Math.floor(d.x * 10), i, 1) * 9;
      const y = heightAt(terrain, d.x, z);
      if (d.type === 'tree') tree(b, d.x, y, z, d.s * 1.1, hash01(i, Math.floor(d.x), 2));
      else if (d.type === 'bush') bush(b, d.x, y, z, d.s);
      else fence(b, terrain, d.x, -5.5);
    }
    const ft = seg.feature;
    if (ft && ft.type === 'haystack') haystack(b, ft.x, terrain.height(ft.x) - 0.2, ft.r);
    if (ft && ft.type === 'trampoline') trampoline(b, ft.x, terrain.height(ft.x), ft.w);
    if (ft && ft.type === 'mud') {
      for (let k = 0; k < 4; k++) {
        const x = ft.x0 + (ft.x1 - ft.x0) * hash01(i, k, 9);
        b.add(G.sphere(8, 5), '#5a3a22', mat(x, terrain.height(x) + 0.05, (hash01(i, k, 8) - 0.5) * 8, 0, 0, 0, [1.2, 0.3, 0.9]));
      }
    }
    const x0 = i * SEG;
    // Scatter behind the flight line: groves, sheep, bushes.
    if (x0 > -120) {
      const n = 10 + Math.floor(hash01(i, 5) * 10);
      for (let k = 0; k < n; k++) {
        const x = x0 + hash01(i, k, 11) * SEG;
        if (x > -35 && x < 12) continue;
        const z = -20 - hash01(i, k, 12) ** 1.4 * 260;
        const y = heightAt(terrain, x, z);
        const v = hash01(i, k, 13);
        const tb = z < -45 ? farB : b;
        if (v < 0.72) tree(tb, x, y, z, 1 + hash01(i, k, 14) * 0.9, hash01(i, k, 15));
        else if (v < 0.88) bush(tb, x, y, z, 1.2);
        else if (z > -80) sheep(tb, x, y, z, v);
      }
      // A few things in front of the line, low and out of the way.
      for (let k = 0; k < 3; k++) {
        const x = x0 + hash01(i, k, 21) * SEG;
        if (x < 15) continue;
        const z = 12 + hash01(i, k, 22) * 30;
        bush(b, x, heightAt(terrain, x, z), z, 0.9 + hash01(i, k, 23));
      }
    }
    const out = [];
    if (!b.empty) out.push(b.mesh({ shadow: true }));
    if (!farB.empty) out.push(farB.mesh({ shadow: false }));
    if (ft && ft.type === 'tnt') out.push(tntBarrel(ft.x, terrain.height(ft.x), ft.r));
    return out;
  }

  // Hedgerows along the field borders and forests on the far hills: instanced
  // copies of two shared models (almost free to build).
  function instancedFar(terrain, i) {
    const x0 = i * SEG;
    const out = [];
    if (x0 <= -60) return out;
    const hedge = [];
    for (let row = 2; row <= 7; row++) {
      const hz = -row * 38;
      for (let hx = x0; hx < x0 + SEG; hx += 2.6) {
        if (hash01(Math.floor(hx), row, 61) < 0.12) continue;
        const zz = hz + (hash01(Math.floor(hx), row, 62) - 0.5) * 1.2;
        const s2 = 1.1 + hash01(Math.floor(hx), row, 63) * 0.6;
        hedge.push([hx, heightAt(terrain, hx, zz) + 0.8 * s2, zz, s2, hash01(Math.floor(hx), row, 64)]);
      }
    }
    const trees = [];
    for (let k = 0; k < 30; k++) {
      const x = x0 + hash01(i, k, 71) * SEG;
      const z = -290 - hash01(i, k, 72) * 160;
      trees.push([x, heightAt(terrain, x, z), z, 2.2 + hash01(i, k, 73) * 1.6, hash01(i, k, 74)]);
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tint = new THREE.Color();
    const make = (geo, list, scaleFn) => {
      const mesh = new THREE.InstancedMesh(geo, vertexToon(), list.length);
      list.forEach(([x, y, z, sc, v], k) => {
        q.setFromAxisAngle(UP, v * 6.28);
        m4.compose(new THREE.Vector3(x, y, z), q, scaleFn(sc));
        mesh.setMatrixAt(k, m4);
        mesh.setColorAt(k, tint.setHSL(0.3 + v * 0.05, 0.5, 0.42 + v * 0.1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      return mesh;
    };
    if (hedge.length) out.push(make(hedgeGeo(), hedge, (sc) => new THREE.Vector3(1.6 * sc, 1.2 * sc, 1.3 * sc)));
    if (trees.length) out.push(make(pineGeo(), trees, (sc) => new THREE.Vector3(sc, sc, sc)));
    return out;
  }

  function waterMesh(terrain, i) {
    const ft = terrain.segment(i).feature;
    if (!ft || ft.type !== 'pond') return null;
    const w = ft.x1 - ft.x0 + 3;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 28), waterMat);
    m.scale.set(w / 2, 1, 7);
    m.position.set((ft.x0 + ft.x1) / 2, terrain.height((ft.x0 + ft.x1) / 2) + 0.05, 0);
    m.receiveShadow = true;
    return m;
  }

  // Ground height where grass may grow, or null (path, water, mud, farm yard).
  function grassSpot(terrain, x, z) {
    const ft = terrain.segment(Math.floor(x / SEG)).feature;
    if (ft && (ft.type === 'pond' || ft.type === 'mud') && Math.abs(z) < 8.5 && x > ft.x0 - 3 && x < ft.x1 + 3) return null;
    if (ft && (ft.type === 'haystack' || ft.type === 'trampoline' || ft.type === 'tnt') && Math.abs(z) < 4 && Math.abs(x - ft.x) < 4) return null;
    if (x < 8 && x > -30 && Math.abs(z + 1) < 2.6) return null;
    if (x < -8 && x > -60 && z < -3 && z > -40) return null;
    if (x > -4 && x < 4 && Math.abs(z) < 3) return null;
    return heightAt(terrain, x, z);
  }

  const STAGES = [
    (terrain, i, grp) => { grp.add(groundMesh(terrain, i)); const w = waterMesh(terrain, i); if (w) grp.add(w); },
    (terrain, i, grp) => { for (const d of decorMesh(terrain, i)) grp.add(d); },
    (terrain, i, grp) => { for (const d of instancedFar(terrain, i)) grp.add(d); grp.add(buildGrass(i, i * SEG, SEG, (x, z) => grassSpot(terrain, x, z))); },
  ];

  let currentTerrain = null;
  function clear() {
    for (const g of chunks.values()) {
      scene.remove(g);
      g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    }
    chunks.clear();
  }

  return {
    heightAt,
    // `blown` holds the segments whose TNT barrel already exploded.
    update(terrain, x0, x1, visible, blown = null) {
      if (terrain !== currentTerrain) {
        clear();
        currentTerrain = terrain;
      }
      far.visible = true;
      const i0 = Math.floor(x0 / SEG);
      const i1 = Math.floor(x1 / SEG);
      for (const [i, g] of chunks) {
        if (i < i0 - 1 || i > i1 + 1) {
          scene.remove(g);
          g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
          chunks.delete(i);
        } else {
          g.visible = visible;
          for (const o of g.children) if (o.userData.tnt) o.visible = !(blown && blown.has(i));
        }
      }
      if (!visible) return;
      // Build nearest-first, one chunk per frame once the start area exists
      // (building several at once caused frame hitches mid-flight).
      const order = [];
      for (let i = i0; i <= i1; i++) if (!chunks.has(i)) order.push(i);
      const mid = (i0 + i1) / 2;
      order.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      // Finish partly built chunks first, one stage per frame (more at startup).
      let budget = chunks.size < 3 ? 18 : 1;
      for (const g of chunks.values()) {
        while (budget > 0 && g.userData.stage < STAGES.length) {
          STAGES[g.userData.stage](terrain, g.userData.i, g);
          g.userData.stage += 1;
          budget -= 1;
        }
      }
      for (const i of order) {
        if (budget <= 0) break;
        const g = new THREE.Group();
        g.userData.i = i;
        g.userData.stage = 0;
        scene.add(g);
        chunks.set(i, g);
        while (budget > 0 && g.userData.stage < STAGES.length) {
          STAGES[g.userData.stage](terrain, i, g);
          g.userData.stage += 1;
          budget -= 1;
        }
      }
    },
    setFarY(y) { far.position.y = y; },
  };
}
