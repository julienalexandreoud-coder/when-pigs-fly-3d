// 3D models for the world's sky objects. Models are built once per type
// (unit size), pooled, and placed each frame from world.query results.

import { THREE, Builder, G, mat, toon, glow, starGeometry, boltGeometry, hash01, gradientMap } from './kit.js';

const LIVERIES = [['#f8f9fa', '#1d3557'], ['#f8f9fa', '#e63946'], ['#ffd166', '#2a9d8f']];
const shared = (g) => { g.userData.shared = true; return g; };
const vc = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });

const GEO = {};
function geo(key, make) {
  if (!GEO[key]) GEO[key] = shared(make());
  return GEO[key];
}

const coinMat = new THREE.MeshToonMaterial({ color: '#ffd23f', emissive: new THREE.Color('#c77c00'), emissiveIntensity: 0.45, gradientMap: gradientMap() });
const starMat = new THREE.MeshToonMaterial({ color: '#fff06a', emissive: new THREE.Color('#ffb703'), emissiveIntensity: 0.7, gradientMap: gradientMap() });
const vcMat = vc();

function coinGeo() {
  const b = new Builder();
  b.add(G.cyl(1, 1, 22), '#ffd23f', mat(0, 0, 0, Math.PI / 2, 0, 0, [1, 0.22, 1]), { flat: false });
  b.add(G.cyl(0.72, 0.72, 22), '#ffe45c', mat(0, 0, 0, Math.PI / 2, 0, 0, [1, 0.28, 1]), { flat: false });
  b.add(G.box(), '#e0a400', mat(0, 0, 0, 0, 0, 0, [0.22, 0.8, 0.3]));
  return b.build();
}

const MAKERS = {
  coin() {
    const m = new THREE.Mesh(geo('coin', coinGeo), vcMat);
    m.material = new THREE.MeshToonMaterial({ vertexColors: true, emissive: new THREE.Color('#a86400'), emissiveIntensity: 0.35, gradientMap: gradientMap() });
    return m;
  },
  star() {
    return new THREE.Mesh(geo('star', () => starGeometry(1, 0.45, 0.35)), starMat);
  },
  fuel() {
    const b = new Builder();
    b.add(G.box(), '#e63946', mat(0, 0, 0, 0, 0, 0, [1.1, 1.4, 0.6]));
    b.add(G.box(), '#c1121f', mat(0, 0.85, 0, 0, 0, 0, [0.7, 0.2, 0.2]));
    b.add(G.cyl(0.14, 0.14, 8), '#ffd23f', mat(0.35, 0.85, 0, 0, 0, 0.5, [1, 0.5, 1]));
    b.add(G.box(), '#ffd23f', mat(0, 0, 0.31, 0, 0, 0, [0.6, 0.6, 0.04]));
    b.add(G.box(), '#e63946', mat(0, 0, 0.34, 0, 0, Math.PI / 4, [0.25, 0.25, 0.04]));
    return new THREE.Mesh(geo('fuel', () => b.build()), vcMat);
  },
  balloon() {
    const grp = new THREE.Group();
    const skin = new THREE.Mesh(geo('balloon', () => {
      const b = new Builder();
      b.add(G.sphere(18, 14), '#ffffff', mat(0, 0.15, 0, 0, 0, 0, [1, 1.18, 1]), { flat: false });
      b.add(G.cone(8), '#ffffff', mat(0, -1.12, 0, Math.PI, 0, 0, [0.18, 0.25, 0.18]));
      return b.build();
    }), toon('#ff4d6d'));
    const shine = new THREE.Mesh(geo('shine', () => new THREE.SphereGeometry(1, 8, 6)), glow('#ffffff', 0.7));
    shine.position.set(0.35, 0.55, 0.62);
    shine.scale.set(0.16, 0.26, 0.1);
    const string = new THREE.Mesh(geo('string', () => new THREE.CylinderGeometry(0.03, 0.03, 1, 4)), toon('#3a2230'));
    string.position.y = -1.9;
    string.scale.y = 1.5;
    grp.add(skin, shine, string);
    grp.userData.skin = skin;
    return grp;
  },
  wballoon() {
    const grp = new THREE.Group();
    const b = new Builder();
    b.add(G.sphere(18, 14), '#f1f3f5', mat(0, 0.1, 0, 0, 0, 0, [1, 1.1, 1]), { flat: false });
    b.add(G.cyl(0.02, 0.02, 4), '#495057', mat(0, -1.6, 0, 0, 0, 0, [1, 1.2, 1]));
    b.add(G.box(), '#ff9f1c', mat(0, -2.3, 0, 0, 0, 0, [0.35, 0.3, 0.35]));
    grp.add(new THREE.Mesh(geo('wballoon', () => b.build()), vcMat));
    return grp;
  },
  goose() {
    const grp = new THREE.Group();
    const b = new Builder();
    b.add(G.sphere(12, 8), '#f8f9fa', mat(0, 0, 0, 0, 0, 0, [1.1, 0.55, 0.55]), { flat: false });
    b.add(G.cyl(0.14, 0.18, 8), '#343a40', mat(-1.05, 0.45, 0, 0, 0, 0.7, [1, 0.9, 1]));
    b.add(G.sphere(10, 8), '#343a40', mat(-1.4, 0.85, 0, 0, 0, 0, 0.26));
    b.add(G.box(), '#ffffff', mat(-1.45, 0.8, 0, 0, 0, 0, [0.12, 0.08, 0.3]));
    b.add(G.cone(6), '#ffb703', mat(-1.75, 0.82, 0, 0, 0, Math.PI / 2, [0.1, 0.35, 0.1]));
    b.add(G.cone(6), '#dee2e6', mat(1.2, 0.1, 0, 0, 0, -Math.PI / 2, [0.3, 0.5, 0.2]));
    grp.add(new THREE.Mesh(geo('goose', () => b.build()), vcMat));
    const wings = [1, -1].map((s) => {
      const p = new THREE.Group();
      p.position.set(0, 0.25, 0.3 * s);
      const w = new THREE.Mesh(geo('gwing', () => new THREE.BoxGeometry(1, 0.06, 1)), toon('#dee2e6'));
      w.scale.set(0.9, 1, 1.5);
      w.position.z = 0.75 * s;
      p.add(w);
      p.userData.s = s;
      grp.add(p);
      return p;
    });
    grp.userData.wings = wings;
    return grp;
  },
  thunder() {
    const grp = new THREE.Group();
    const b = new Builder();
    for (const [x, y, z, r] of [[-0.55, 0, 0, 0.6], [0.55, 0.02, 0.1, 0.62], [0, 0.2, -0.1, 0.78], [-0.25, -0.2, 0.2, 0.55], [0.3, -0.25, -0.2, 0.55], [0.9, -0.1, -0.1, 0.4], [-0.9, -0.12, 0.1, 0.42]]) {
      b.add(G.ico(1), y > 0.1 ? '#7a7f99' : '#5c5f7a', mat(x, y, z, x, y, 0, [r, r * 0.85, r * 0.9]));
    }
    grp.add(new THREE.Mesh(geo('thunder', () => b.build()), vcMat));
    const bolt = new THREE.Mesh(geo('bolt', boltGeometry), glow('#fff3b0'));
    bolt.scale.setScalar(0.9);
    bolt.position.set(0, -0.85, 0.3);
    grp.add(bolt);
    grp.userData.bolt = bolt;
    return grp;
  },
  hotair() {
    const grp = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      const r = Math.sin(a) * (i < 6 ? 1 : 1 - (i - 6) * 0.07);
      pts.push(new THREE.Vector2(Math.max(0.28, r) * (i === 12 ? 0.3 : 1), Math.cos(a) * 1.1));
    }
    pts.push(new THREE.Vector2(0.28, -1.15));
    grp.userData.envKey = 'env';
    const envGeo = geo('hotairEnv', () => {
      const g = new THREE.LatheGeometry(pts.reverse(), 12).toNonIndexed();
      g.computeVertexNormals();
      const p = g.attributes.position.array;
      const col = new Float32Array(p.length);
      for (let i = 0; i < p.length; i += 9) {
        const cx = (p[i] + p[i + 3] + p[i + 6]) / 3;
        const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
        const seg = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 12);
        const v = seg % 2 ? 1 : 0.62;
        for (let k = 0; k < 3; k++) col.set([v, v, v], i + k * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const env = new THREE.Mesh(envGeo, new THREE.MeshToonMaterial({ vertexColors: true, color: '#ff4d6d', gradientMap: gradientMap() }));
    const b = new Builder();
    b.add(G.box(), '#a47148', mat(0, -1.65, 0, 0, 0, 0, [0.45, 0.35, 0.45]));
    for (const [x, z] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) b.add(G.cyl(0.015, 0.015, 3), '#3a2230', mat(x, -1.35, z, 0, 0, 0, [1, 0.35, 1]));
    grp.add(env, new THREE.Mesh(geo('hotairBasket', () => b.build()), vcMat));
    grp.userData.env = env;
    return grp;
  },
  plane() {
    const grp = new THREE.Group();
    const models = LIVERIES.map(([body, accent], i) => geo(`plane${i}`, () => {
      const b = new Builder();
      // Length 1 along x (nose at -x: planes fly toward the pig), fuselage 0.2 tall.
      const R = 0.1;
      b.add(G.cyl(R, R, 16), body, mat(0, 0, 0, 0, 0, Math.PI / 2, [1, 0.72, 1]), { flat: false });
      b.add(G.sphere(16, 10), body, mat(-0.36, 0, 0, 0, 0, 0, [0.12, R, R]), { flat: false });
      b.add(G.cone(16), body, mat(0.44, 0.02, 0, 0, 0, -Math.PI / 2, [R, 0.16, R]));
      b.add(G.cyl(R * 1.02, R * 1.02, 16), accent, mat(0.02, 0, 0, 0, 0, Math.PI / 2, [1, 0.66, 1]).multiply(mat(0, 0, 0, 0, 0, 0, [1, 1, 1])));
      b.add(G.cyl(R * 1.03, R * 1.03, 16), body, mat(0.02, 0.03, 0, 0, 0, Math.PI / 2, [1, 0.67, 1]));
      b.add(G.box(), accent, mat(0.43, 0.13, 0, 0, 0, -0.55, [0.1, 0.2, 0.02]));
      b.add(G.box(), body, mat(0.04, -0.04, 0, 0, 0, 0, [0.14, 0.02, 0.95]).premultiply(new THREE.Matrix4()));
      b.add(G.box(), body, mat(0.44, 0.03, 0, 0, 0, 0, [0.07, 0.015, 0.34]));
      for (const z of [0.2, -0.2]) b.add(G.cyl(0.035, 0.035, 10), '#6c757d', mat(0.0, -0.08, z, 0, 0, Math.PI / 2, [1, 0.12, 1]));
      for (let k = 0; k < 10; k++) for (const z of [R, -R]) b.add(G.box(), '#1d3557', mat(-0.26 + k * 0.05, 0.03, z * 0.98, 0, 0, 0, [0.022, 0.028, 0.012]));
      b.add(G.box(), '#1d3557', mat(-0.4, 0.04, 0, 0, 0, 0.4, [0.03, 0.03, 0.14]));
      return b.build();
    }));
    const m = new THREE.Mesh(models[0], vcMat);
    grp.add(m);
    const trail = new THREE.Mesh(geo('contrail', () => new THREE.CylinderGeometry(0.06, 0.02, 1, 6)), glow('#ffffff', 0.45));
    trail.rotation.z = Math.PI / 2;
    trail.scale.set(0.5, 1.4, 0.5);
    trail.position.set(0.85, -0.08, 0.2);
    const trail2 = trail.clone();
    trail2.position.z = -0.2;
    grp.add(trail, trail2);
    grp.userData.models = models;
    grp.userData.mesh = m;
    return grp;
  },
  ufo() {
    const grp = new THREE.Group();
    const b = new Builder();
    b.add(G.sphere(24, 10), '#adb5bd', mat(0, 0, 0, 0, 0, 0, [1.3, 0.3, 1.3]), { flat: false });
    b.add(G.cyl(1.32, 1.32, 24), '#6c757d', mat(0, 0, 0, 0, 0, 0, [1, 0.08, 1]));
    b.add(G.sphere(20, 10), '#caf0f8', mat(0, 0.22, 0, 0, 0, 0, [0.55, 0.45, 0.55]), { flat: false });
    b.add(G.sphere(10, 8), '#80ed99', mat(0.1, 0.3, 0.25, 0, 0, 0, [0.16, 0.2, 0.16]));
    grp.add(new THREE.Mesh(geo('ufo', () => b.build()), vcMat));
    const lights = new THREE.Group();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const l = new THREE.Mesh(geo('ufoLight', () => new THREE.SphereGeometry(1, 6, 4)), glow(k % 2 ? '#ffd23f' : '#ff4d6d'));
      l.position.set(Math.cos(a) * 1.15, -0.06, Math.sin(a) * 1.15);
      l.scale.setScalar(0.09);
      lights.add(l);
    }
    grp.add(lights);
    const beam = new THREE.Mesh(geo('beam', () => { const g = new THREE.ConeGeometry(1, 1, 20, 1, true); g.translate(0, -0.5, 0); return g; }), glow('#9dffb0', 0.22, true));
    grp.add(beam);
    grp.userData.beam = beam;
    grp.userData.lights = lights;
    return grp;
  },
  satellite() {
    const b = new Builder();
    b.add(G.box(), '#d4a017', mat(0, 0, 0, 0, 0, 0, [0.7, 0.7, 0.7]));
    b.add(G.cyl(0.05, 0.05, 6), '#adb5bd', mat(0, 0, 0, Math.PI / 2, 0, 0, [1, 2.4, 1]));
    for (const s of [1, -1]) {
      b.add(G.box(), '#1d4ed8', mat(0, 0, 1.5 * s, 0, 0, 0, [0.9, 0.05, 1.6]));
      for (let k = 0; k < 3; k++) b.add(G.box(), '#93c5fd', mat(0, 0.03, (0.9 + k * 0.55) * s, 0, 0, 0, [0.86, 0.02, 0.04]));
    }
    b.add(G.cone(12), '#f8f9fa', mat(0, 0.6, 0, Math.PI, 0, 0, [0.4, 0.25, 0.4]));
    b.add(G.cyl(0.03, 0.03, 4), '#adb5bd', mat(0, 0.75, 0, 0, 0, 0, [1, 0.4, 1]));
    return new THREE.Mesh(geo('satellite', () => b.build()), vcMat);
  },
  asteroid() {
    const variants = [0, 1, 2, 3].map((v) => geo(`asteroid${v}`, () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 0.78 + hash01(Math.round(x * 100) + v * 7, Math.round(y * 100), Math.round(z * 100)) * 0.4;
        p.setXYZ(i, x * k, y * k, z * k);
      }
      const b = new Builder();
      b.addPainted(g, (x, y, z) => new THREE.Color(hash01(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50) + v) < 0.25 ? '#6f625a' : '#9a8c80'));
      return b.build();
    }));
    const m = new THREE.Mesh(variants[0], vcMat);
    m.userData.variants = variants;
    return m;
  },
  updraft() {
    const grp = new THREE.Group();
    const col = new THREE.Mesh(geo('draft', () => new THREE.CylinderGeometry(1, 1, 1, 20, 1, true)), glow('#bde0fe', 0.16, false));
    col.material = new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    grp.add(col);
    const rings = [];
    for (let k = 0; k < 6; k++) {
      const r = new THREE.Mesh(geo('draftRing', () => new THREE.TorusGeometry(1, 0.04, 4, 20)), glow('#ffffff', 0.5));
      r.rotation.x = Math.PI / 2;
      grp.add(r);
      rings.push(r);
    }
    grp.userData.col = col;
    grp.userData.rings = rings;
    return grp;
  },
  jetstream() {
    const grp = new THREE.Group();
    const streaks = [];
    for (let k = 0; k < 14; k++) {
      const s = new THREE.Mesh(geo('streak', () => new THREE.CapsuleGeometry(0.5, 1, 2, 6)), glow('#ffffff', 0.35));
      s.rotation.z = Math.PI / 2;
      grp.add(s);
      streaks.push(s);
    }
    const band = new THREE.Mesh(geo('band', () => new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshBasicMaterial({ color: '#bde0fe', transparent: true, opacity: 0.12, depthWrite: false }));
    grp.add(band);
    grp.userData.streaks = streaks;
    grp.userData.band = band;
    return grp;
  },
};

// Places and animates a pooled model for world object `o` at time t.
function place(m, o, t, ctx) {
  const u = m.userData;
  switch (o.type) {
    case 'coin': {
      const r = o.r * (o.star ? 1 : 1);
      m.position.set(o.x, o.y + Math.sin(t * 3 + o.x) * r * 0.1, 0);
      m.scale.setScalar(r);
      m.rotation.y = t * 3 + o.x * 0.3;
      break;
    }
    case 'star':
      m.position.set(o.x, o.y, 0);
      m.scale.setScalar(o.r * 1.3);
      m.rotation.y = t * 2.5;
      break;
    case 'fuel':
      m.position.set(o.x, o.y + Math.sin(t * 2.5 + o.x) * o.r * 0.12, 0);
      m.scale.setScalar(o.r * (ctx.hasRocket ? 1 : 0.7));
      m.rotation.set(0, Math.sin(t * 2 + o.y) * 0.6, Math.sin(t * 1.6 + o.x) * 0.15);
      break;
    case 'balloon':
      m.position.set(o.x, o.y + Math.sin(t * 1.7 + o.x) * o.r * 0.12, 0);
      m.scale.setScalar(o.r);
      m.rotation.z = Math.sin(t * 1.3 + o.y) * 0.08;
      u.skin.material = toon(o.color);
      break;
    case 'wballoon':
      m.position.set(o.x, o.y + Math.sin(t * 1.2 + o.x) * o.r * 0.08, 0);
      m.scale.setScalar(o.r);
      break;
    case 'goose': {
      m.position.set(o.x, o.y + Math.sin(t * 3 + o.phase) * o.r * 0.2, 0);
      m.scale.setScalar(o.r);
      m.rotation.y = 0.35;
      const f = Math.sin(t * 10 + o.phase);
      for (const w of u.wings) w.rotation.x = -w.userData.s * f * 0.7;
      break;
    }
    case 'thunder': {
      m.position.set(o.x, o.y, 0);
      m.scale.setScalar(o.r);
      const flash = Math.sin(t * 7 + o.phase * 3) + Math.sin(t * 13 + o.phase) > 1.3;
      u.bolt.visible = flash;
      u.bolt.rotation.y = Math.sin(t * 20) * 0.3;
      break;
    }
    case 'hotair':
      m.position.set(o.x, o.y + Math.sin(t * 1.3 + o.x) * o.r * 0.05, 0);
      m.scale.setScalar(o.r);
      m.rotation.y = t * 0.15;
      u.env.material.color.set(o.color);
      break;
    case 'plane':
      m.position.set(o.x, o.y, 0);
      m.scale.set(o.w, o.w, o.w);
      m.rotation.set(0, 0, 0);
      u.mesh.geometry = u.models[o.livery % u.models.length];
      break;
    case 'ufo':
      m.position.set(o.x, o.y + Math.sin(t * 2 + o.x) * o.r * 0.06, 0);
      m.scale.setScalar(o.r);
      m.rotation.y = t * 1.5;
      u.lights.rotation.y = t * 3;
      u.beam.visible = !ctx.carrying || ctx.carrying !== o;
      u.beam.scale.set(1.0, o.beam / o.r, 1.0);
      break;
    case 'satellite':
      m.position.set(o.x, o.y, 0);
      m.scale.setScalar(o.r);
      m.rotation.set(o.rot + t * 0.3, o.rot, 0.3);
      break;
    case 'asteroid':
      m.geometry = u.variants[o.seed % u.variants.length];
      m.position.set(o.x, o.y, 0);
      m.scale.setScalar(o.r);
      m.rotation.set(o.rot + t * 0.4, o.rot * 2 + t * 0.25, 0);
      break;
    case 'updraft': {
      const h = o.y1 - o.y0;
      const w = (o.x1 - o.x0) / 2;
      u.col.position.set(o.x, o.y0 + h / 2, 0);
      u.col.scale.set(w, h, w);
      u.rings.forEach((r, k) => {
        const f = ((t * 0.25 + k / u.rings.length) % 1);
        r.position.set(o.x, o.y0 + f * h, 0);
        r.scale.setScalar(w * (0.6 + f * 0.4));
        r.material = glow('#ffffff', 0.5 * Math.sin(f * Math.PI));
      });
      break;
    }
    case 'jetstream': {
      const len = o.x1 - o.x0;
      const hh = o.y1 - o.y0;
      u.band.position.set(o.x, o.y, 0);
      u.band.scale.set(len, hh, hh * 0.6);
      u.streaks.forEach((s, k) => {
        const f = (t * 0.35 + hash01(k, 3)) % 1;
        s.position.set(o.x0 + f * len, o.y0 + hash01(k, 5) * hh, (hash01(k, 7) - 0.5) * hh * 0.5);
        const sl = hh * (0.5 + hash01(k, 9));
        s.scale.set(hh * 0.05, sl, hh * 0.05);
      });
      break;
    }
    default:
      break;
  }
}

export function createObjects(scene) {
  const active = new Map();
  const pools = new Map();

  function acquire(type) {
    const pool = pools.get(type);
    if (pool && pool.length) return pool.pop();
    const make = MAKERS[type];
    if (!make) return null;
    const m = make();
    m.traverse((c) => { if (c.isMesh) c.castShadow = type !== 'updraft' && type !== 'jetstream'; });
    return m;
  }

  function release(id, m) {
    scene.remove(m);
    active.delete(id);
    const type = m.userData.type;
    if (!pools.has(type)) pools.set(type, []);
    pools.get(type).push(m);
  }

  return {
    // objs: world objects in view; taken: ids already used this flight.
    update(objs, t, { taken, hasRocket, carrying }) {
      const ctx = { hasRocket, carrying };
      const seen = new Set();
      for (const o of objs) {
        if (taken && taken.has(o.id) && o.type !== 'plane' && o.type !== 'thunder' && o.type !== 'ufo') continue;
        if (o === carrying) continue;
        const type = o.type === 'coin' && o.star ? 'star' : o.type;
        let m = active.get(o.id);
        if (m && m.userData.type !== type) { release(o.id, m); m = null; }
        if (!m) {
          m = acquire(type);
          if (!m) continue;
          m.userData.type = type;
          scene.add(m);
          active.set(o.id, m);
        }
        seen.add(o.id);
        place(m, o, t, ctx);
      }
      for (const [id, m] of active) if (!seen.has(id)) release(id, m);
    },
    clear() {
      for (const [id, m] of active) release(id, m);
    },
    // A standalone UFO carrying the pig during an abduction.
    makeUfo() {
      const m = MAKERS.ufo();
      m.userData.type = 'ufo';
      return m;
    },
    place,
  };
}
