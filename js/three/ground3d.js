// 3D ground built per terrain segment: the flight line (z = 0) follows the
// game's terrain height exactly; behind it the land rolls into hills.
// Each chunk is one merged mesh plus water, plus merged decoration.

import { THREE, Builder, G, mat, hash01, vertexToon, toon } from './kit.js';
import { SEG } from '../terrain.js';

const XSTEP = 2.5;
const ZROWS = [-460, -380, -310, -260, -220, -185, -155, -130, -108, -90, -74, -60, -48, -38, -30, -23, -17, -12, -8, -4, -1.5, 0, 1.5, 4, 8, 14, 24, 40, 70];
const NEAR = 5;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const GRASS = ['#7fd35a', '#7ad056', '#84d85e', '#78cc55'];
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

export function createGround(scene) {
  const chunks = new Map();
  const waterMat = new THREE.MeshToonMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.88, gradientMap: toon('#fff').gradientMap });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: '#79c85a' }));
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
    const vert = (ix, iz) => {
      const x = x0 + ix * XSTEP;
      const z = ZROWS[iz];
      const jx = ix > 0 && ix < cols && Math.abs(z) > 10 ? (hash01(ix + i * 97, iz) - 0.5) * XSTEP * 0.6 : 0;
      return [x + jx, heightAt(terrain, x + jx, z), z];
    };
    const grid = [];
    for (let iz = 0; iz < ZROWS.length; iz++) {
      grid.push([]);
      for (let ix = 0; ix <= cols; ix++) grid[iz].push(vert(ix, iz));
    }
    const tri = (a, b, d) => {
      pos.push(...a, ...b, ...d);
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
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, vertexToon());
    m.receiveShadow = true;
    return m;
  }

  function tree(b, x, y, z, s, v) {
    const trunk = '#8d5a35';
    if (v < 0.5) {
      b.add(G.cyl(0.35, 0.45, 6), trunk, mat(x, y + 1.5 * s, z, 0, 0, 0, [s, 3 * s, s]));
      b.add(G.ico(0), v < 0.25 ? '#3fa34d' : '#4cb35a', mat(x, y + 4.6 * s, z, v * 9, v * 5, 0, [2.6 * s, 2.4 * s, 2.6 * s]));
      b.add(G.ico(0), '#56c263', mat(x + 0.8 * s, y + 5.8 * s, z + 0.4 * s, v * 3, 0, 0, [1.7 * s, 1.5 * s, 1.7 * s]));
    } else {
      b.add(G.cyl(0.3, 0.4, 6), trunk, mat(x, y + 1 * s, z, 0, 0, 0, [s, 2 * s, s]));
      for (let k = 0; k < 3; k++) {
        b.add(G.cone(7), k % 2 ? '#2d8a4e' : '#379e5a', mat(x, y + (2.6 + k * 1.5) * s, z, 0, v * 4 + k, 0, [(2.4 - k * 0.6) * s, 2.4 * s, (2.4 - k * 0.6) * s]));
      }
    }
  }

  function bush(b, x, y, z, s) {
    b.add(G.ico(0), '#5cbf4f', mat(x, y + 0.6 * s, z, 0, s * 4, 0, [1.4 * s, 1 * s, 1.2 * s]));
    b.add(G.ico(0), '#6fd062', mat(x + 0.9 * s, y + 0.5 * s, z + 0.3, 0, s, 0, [0.9 * s, 0.8 * s, 0.9 * s]));
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

  function decorMesh(terrain, i) {
    const seg = terrain.segment(i);
    const b = new Builder();
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
    // Scatter behind the flight line: groves, sheep, bushes.
    const x0 = i * SEG;
    if (x0 > -120) {
      const n = 10 + Math.floor(hash01(i, 5) * 10);
      for (let k = 0; k < n; k++) {
        const x = x0 + hash01(i, k, 11) * SEG;
        if (x > -35 && x < 12) continue;
        const z = -20 - hash01(i, k, 12) ** 1.4 * 260;
        const y = heightAt(terrain, x, z);
        const v = hash01(i, k, 13);
        if (v < 0.72) tree(b, x, y, z, 1 + hash01(i, k, 14) * 0.9, hash01(i, k, 15));
        else if (v < 0.88) bush(b, x, y, z, 1.2);
        else if (z > -80) sheep(b, x, y, z, v);
      }
      // A few things in front of the line, low and out of the way.
      for (let k = 0; k < 3; k++) {
        const x = x0 + hash01(i, k, 21) * SEG;
        if (x < 15) continue;
        const z = 12 + hash01(i, k, 22) * 30;
        bush(b, x, heightAt(terrain, x, z), z, 0.9 + hash01(i, k, 23));
      }
    }
    return b.empty ? null : b.mesh({ shadow: true });
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

  function build(terrain, i) {
    const grp = new THREE.Group();
    grp.add(groundMesh(terrain, i));
    const d = decorMesh(terrain, i);
    if (d) grp.add(d);
    const w = waterMesh(terrain, i);
    if (w) grp.add(w);
    return grp;
  }

  let currentTerrain = null;
  function clear() {
    for (const g of chunks.values()) {
      scene.remove(g);
      g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    chunks.clear();
  }

  return {
    heightAt,
    update(terrain, x0, x1, visible) {
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
          g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
          chunks.delete(i);
        } else {
          g.visible = visible;
        }
      }
      if (!visible) return;
      // Build nearest-first, one chunk per frame once the start area exists
      // (building several at once caused frame hitches mid-flight).
      const order = [];
      for (let i = i0; i <= i1; i++) if (!chunks.has(i)) order.push(i);
      const mid = (i0 + i1) / 2;
      order.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      const budget = chunks.size < 3 ? 6 : 1;
      let built = 0;
      for (const i of order) {
        if (built >= budget) break;
        const g = build(terrain, i);
        scene.add(g);
        chunks.set(i, g);
        built++;
      }
    },
    setFarY(y) { far.position.y = y; },
  };
}
