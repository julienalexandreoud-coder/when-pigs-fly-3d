// Pip the pig as a low-poly 3D model. Unit size: body radius about 1,
// facing +x. Skins recolor the body; upgrade tiers swap visible gear
// (wings, rocket, helmet), rebuilt only when the tiers change.

import { THREE, Builder, G, mat, toon, glow } from './kit.js';

const INK = '#3a2230';
const WINGS = [
  { c: '#c8a26b', c2: '#9c7a48', span: 1.6, chord: 0.8, sweep: 0, kind: 'plank' },
  { c: '#ff4d6d', c2: '#ffffff', span: 1.7, chord: 0.9, sweep: 0.1, kind: 'dome' },
  { c: '#ffb703', c2: '#e63946', span: 1.9, chord: 1.1, sweep: 0, kind: 'kite' },
  { c: '#3a86ff', c2: '#bde0fe', span: 2.4, chord: 1.2, sweep: 0.5, kind: 'glider' },
  { c: '#ffd166', c2: '#e76f51', span: 2.1, chord: 0.7, sweep: 0, kind: 'biplane' },
  { c: '#343a40', c2: '#e63946', span: 2.4, chord: 0.8, sweep: 0.7, kind: 'swept' },
  { c: '#ced4da', c2: '#e63946', span: 2.6, chord: 0.9, sweep: 0.9, kind: 'jet' },
];
const ROCKETS = [
  null,
  { L: 1.15, r: 0.22, body: '#6ad17d', nose: '#e63946', band: '#ffffff', fins: null },
  { L: 1.3, r: 0.2, body: '#e63946', nose: '#ffd166', band: '#ffd166', fins: '#ffd166' },
  { L: 1.5, r: 0.26, body: '#f8f9fa', nose: '#e63946', band: '#3a86ff', fins: '#e63946' },
  { L: 1.5, r: 0.33, body: '#adb5bd', nose: '#495057', band: '#343a40', fins: null, jet: true },
  { L: 2.0, r: 0.34, body: '#f8f9fa', nose: '#343a40', band: '#e63946', fins: '#343a40' },
  { L: 2.1, r: 0.36, body: '#7b2cbf', nose: '#e0aaff', band: '#c77dff', fins: '#3c096c', warp: true },
];

function wingGeometry(tier, sign) {
  const w = WINGS[Math.min(tier, WINGS.length - 1)];
  const b = new Builder();
  const z = (v) => v * sign;
  const T = 0.07;
  const half = w.span / 2 + 0.2;
  switch (w.kind) {
    case 'plank':
      b.add(G.box(), w.c, mat(0, 0, z(half), 0, 0, 0, [w.chord, T, w.span]));
      b.add(G.box(), w.c2, mat(0.05, 0.04, z(half), 0, 0, 0, [w.chord * 0.2, T * 1.2, w.span * 0.9]));
      break;
    case 'dome':
      b.add(G.sphere(10, 6), w.c, mat(0, 0, z(half), 0, 0, 0, [w.chord * 0.6, 0.25, w.span * 0.55]));
      b.add(G.cyl(0.03, 0.03, 5), w.c2, mat(0, -0.1, z(half), Math.PI / 2, 0, 0, [1, w.span, 1]));
      break;
    case 'kite':
      b.add(G.box(), w.c, mat(0, 0, z(half), 0, Math.PI / 4, 0, [w.chord, T, w.chord]));
      b.add(G.box(), w.c2, mat(0, 0.02, z(half), 0, Math.PI / 4, 0, [w.chord * 0.5, T * 1.3, w.chord * 0.5]));
      break;
    case 'glider':
      b.add(G.cone(3), w.c, mat(-w.sweep * 0.5, 0, z(half), 0, 0, Math.PI / 2, [w.chord * 0.6, w.span, T]).multiply(mat(0, 0, 0, 0, Math.PI / 2 * 0, 0)));
      b.add(G.box(), w.c2, mat(-w.sweep * 0.4, 0.03, z(half), 0, 0, 0, [w.chord * 0.25, T * 1.3, w.span * 0.95]));
      break;
    case 'biplane':
      b.add(G.box(), w.c, mat(0, 0.35, z(half), 0, 0, 0, [w.chord, T, w.span]));
      b.add(G.box(), w.c, mat(0, -0.25, z(half), 0, 0, 0, [w.chord, T, w.span]));
      b.add(G.cyl(0.035, 0.035, 5), w.c2, mat(0, 0.05, z(half + w.span * 0.35), 0, 0, 0, [1, 0.6, 1]));
      b.add(G.box(), w.c2, mat(0.02, 0.36, z(half + w.span * 0.4), 0, 0, 0, [w.chord * 1.02, T * 1.2, 0.18]));
      break;
    default: {
      const tip = z(w.span + 0.2);
      b.add(G.box(), w.c, mat(-w.sweep * 0.3, 0, z(half), 0, z(w.sweep * 0.35), 0, [w.chord, T, w.span]));
      b.add(G.box(), w.c2, mat(-w.sweep * 0.62, 0.01, tip, 0, 0, 0, [w.chord * 0.6, T * 1.4, 0.16]));
      if (w.kind === 'jet') b.add(G.cyl(0.14, 0.12, 10), '#495057', mat(-0.1, -0.16, z(half * 0.8), 0, 0, Math.PI / 2, [1, 0.7, 1]));
    }
  }
  return b.build();
}

function rocketGroup(tier) {
  const r = ROCKETS[tier];
  const grp = new THREE.Group();
  if (!r) return grp;
  const b = new Builder();
  const along = (x, len, rad0, rad1, color, seg = 12) => b.add(G.cyl(rad1, rad0, seg), color, mat(x, 0, 0, 0, 0, -Math.PI / 2, [1, len, 1]));
  along(0, r.L, r.r, r.r, r.body);
  b.add(G.cone(12), r.nose, mat(r.L / 2 + r.r * 0.8, 0, 0, 0, 0, -Math.PI / 2, [r.r, r.r * 1.6, r.r]));
  along(r.L * 0.12, r.L * 0.12, r.r * 1.04, r.r * 1.04, r.band);
  along(-r.L / 2 - 0.06, 0.14, r.r * 0.8, r.r * 0.95, '#495057');
  if (r.jet) along(r.L / 2 - 0.05, 0.1, r.r * 1.08, r.r * 1.08, '#212529');
  if (r.fins) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      b.add(G.box(), r.fins, mat(-r.L / 2 + 0.15, Math.cos(a) * r.r * 1.3, Math.sin(a) * r.r * 1.3, a, 0, 0, [0.4, r.r * 0.9, 0.05]));
    }
  }
  if (r.warp) for (let k = 0; k < 3; k++) along(-r.L * 0.3 + k * 0.35, 0.06, r.r * 1.1, r.r * 1.1, '#e0aaff');
  const body = new THREE.Mesh(b.build(), toon('#ffffff'));
  body.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap });
  if (r.warp) { body.material.emissive = new THREE.Color('#5a189a'); body.material.emissiveIntensity = 0.4; }
  body.castShadow = true;
  grp.add(body);
  // Flame: two nested additive cones behind the nozzle.
  const flame = new THREE.Group();
  const outer = new THREE.Mesh(G.cone(10), glow(r.warp ? '#c77dff' : '#ff7b00', 0.85, true));
  outer.rotation.z = Math.PI / 2;
  outer.scale.set(r.r * 1.1, 1.4, r.r * 1.1);
  outer.position.x = -0.7;
  const inner = new THREE.Mesh(G.cone(10), glow(r.warp ? '#ffffff' : '#ffe45c', 1, true));
  inner.rotation.z = Math.PI / 2;
  inner.scale.set(r.r * 0.6, 0.9, r.r * 0.6);
  inner.position.x = -0.5;
  flame.add(outer, inner);
  flame.position.x = -r.L / 2 - 0.12;
  flame.visible = false;
  grp.add(flame);
  grp.userData.flame = flame;
  grp.position.set(-0.15, 0.98 + r.r * 0.6, 0);
  return grp;
}

function helmetMesh(tier) {
  if (!tier) return null;
  const b = new Builder();
  if (tier === 1) {
    b.add(G.sphere(12, 6), '#8d5a35', mat(0.9, 0.52, 0, 0, 0, -0.3, [0.66, 0.5, 0.7]));
    b.add(G.box(), '#5e3a20', mat(1.02, 0.25, 0, 0, 0, -0.3, [0.08, 0.5, 1.38]));
  } else if (tier === 2) {
    b.add(G.sphere(14, 8), '#e63946', mat(0.9, 0.42, 0, 0, 0, -0.2, [0.74, 0.62, 0.74]));
    b.add(G.box(), '#ffffff', mat(0.9, 0.55, 0, 0, 0, -0.2, [1.2, 0.12, 0.2]));
  } else if (tier === 3) {
    b.add(G.sphere(16, 8), '#dee2e6', mat(0.72, 0.38, 0, 0, 0, -0.1, [1.05, 0.66, 0.74]));
    b.add(G.box(), '#3a86ff', mat(0.7, 0.62, 0, 0, 0, -0.1, [1.3, 0.1, 0.16]));
  } else {
    b.add(G.cone(14), '#f8f9fa', mat(1.95, 0.24, 0, 0, 0, -Math.PI / 2, [0.42, 0.9, 0.42]));
    b.add(G.cyl(0.42, 0.42, 14), '#e63946', mat(1.5, 0.24, 0, 0, 0, -Math.PI / 2, [1, 0.12, 1]));
  }
  const m = b.mesh();
  return m;
}

export function createPig() {
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  const parts = {};
  let skinKey = null;
  let gearKey = null;
  let gear = { wings: [], rocket: null, helmet: null };
  const skinMats = {};

  function part(name, geom, material, m, parent = bodyG) {
    const mesh = new THREE.Mesh(geom, material);
    mesh.applyMatrix4(m);
    mesh.castShadow = true;
    parent.add(mesh);
    parts[name] = mesh;
    return mesh;
  }

  // Materials are replaced per skin; meshes are built once.
  const white = toon('#ffffff');
  const ink = toon(INK);
  function buildBase() {
    const m0 = toon('#ffb0c4');
    part('body', G.sphere(22, 16), m0, mat(0, 0, 0, 0, 0, 0, [1.15, 0.95, 0.95]));
    part('belly', G.sphere(16, 10), m0, mat(0.1, -0.25, 0, 0, 0, 0, [0.95, 0.7, 0.85]));
    part('head', G.sphere(20, 14), m0, mat(0.95, 0.32, 0, 0, 0, 0, 0.7));
    part('snout', G.cyl(0.3, 0.32, 18), m0, mat(1.58, 0.2, 0, 0, 0, -Math.PI / 2, [1, 0.28, 1]));
    part('nostrilL', G.sphere(8, 6), ink, mat(1.73, 0.24, 0.11, 0, 0, 0, [0.03, 0.08, 0.05]));
    part('nostrilR', G.sphere(8, 6), ink, mat(1.73, 0.24, -0.11, 0, 0, 0, [0.03, 0.08, 0.05]));
    part('smile', G.torus(0.22, Math.PI, 10), ink, mat(1.45, -0.08, 0, Math.PI / 2 * 0, Math.PI / 2, Math.PI, [0.16, 0.12, 0.12]));
    for (const s of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(1.36, 0.58, 0.3 * s);
      bodyG.add(eye);
      const w = new THREE.Mesh(G.sphere(12, 10), white);
      w.scale.setScalar(0.17);
      const p = new THREE.Mesh(G.sphere(10, 8), ink);
      p.scale.setScalar(0.095);
      p.position.set(0.12, 0.01, 0.03 * s);
      const hl = new THREE.Mesh(G.sphere(6, 4), white);
      hl.scale.setScalar(0.035);
      hl.position.set(0.19, 0.06, 0.05 * s);
      eye.add(w, p, hl);
      parts[`eye${s}`] = eye;
      parts[`pupil${s}`] = p;
      const ear = new THREE.Group();
      ear.position.set(0.78, 0.9, 0.36 * s);
      bodyG.add(ear);
      const cone = new THREE.Mesh(G.cone(8), m0);
      cone.scale.set(0.22, 0.42, 0.12);
      cone.position.y = 0.16;
      cone.castShadow = true;
      ear.add(cone);
      parts[`ear${s}`] = ear;
      parts[`earMesh${s}`] = cone;
      part(`cheek${s}`, G.sphere(8, 6), toon('#ff8fab'), mat(1.3, 0.28, 0.46 * s, 0, 0, 0, [0.12, 0.08, 0.06]));
    }
    for (const [lx, lz] of [[0.55, 0.42], [0.55, -0.42], [-0.5, 0.42], [-0.5, -0.42]]) {
      part(`leg${lx}${lz}`, G.cyl(0.17, 0.14, 10), m0, mat(lx, -0.82, lz, 0, 0, 0, [1, 0.45, 1]));
      part(`hoof${lx}${lz}`, G.cyl(0.15, 0.15, 10), toon('#6b4a3a'), mat(lx, -1.06, lz, 0, 0, 0, [1, 0.1, 1]));
    }
    const tail = new THREE.Group();
    tail.position.set(-1.12, 0.25, 0);
    bodyG.add(tail);
    const tm = new THREE.Mesh(G.torus(0.35, Math.PI * 1.6, 14), m0);
    tm.scale.setScalar(0.16);
    tail.add(tm);
    parts.tail = tail;
    parts.tailMesh = tm;
  }
  buildBase();

  const extras = new THREE.Group();
  bodyG.add(extras);

  function applySkin(skin) {
    const key = skin.id;
    if (key === skinKey) return;
    skinKey = key;
    const emissive = skin.glow ? '#ffb703' : null;
    skinMats.body = toon(skin.body, { emissive, emissiveIntensity: 0.35 });
    skinMats.snout = toon(skin.snout, { emissive, emissiveIntensity: 0.25 });
    skinMats.ear = toon(skin.ear, { emissive, emissiveIntensity: 0.25 });
    for (const n of ['body', 'belly', 'head', 'tailMesh']) parts[n].material = skinMats.body;
    for (const k of Object.keys(parts)) if (k.startsWith('leg')) parts[k].material = skinMats.body;
    parts.belly.material = skinMats.snout;
    parts.snout.material = skinMats.snout;
    parts.earMesh1.material = skinMats.ear;
    parts['earMesh-1'].material = skinMats.ear;
    const eyeC = skin.eye ? toon(skin.eye, { emissive: skin.eye, emissiveIntensity: 0.9 }) : ink;
    parts.pupil1.material = eyeC;
    parts['pupil-1'].material = eyeC;
    while (extras.children.length) extras.remove(extras.children[0]);
    const b = new Builder();
    if (skin.spots) {
      for (const [x, y, z, s] of [[-0.3, 0.55, 0.62, 0.3], [0.2, 0.75, -0.5, 0.26], [-0.7, 0.1, -0.7, 0.24], [-0.1, -0.2, 0.9, 0.2]]) {
        b.add(G.sphere(10, 6), skin.spots, mat(x, y, z, 0, 0, 0, [s, s * 0.8, s]));
      }
    }
    if (skin.tusks) for (const s of [1, -1]) b.add(G.cone(6), '#fff8e7', mat(1.62, 0.02, 0.24 * s, 0, 0, 0.3, [0.06, 0.26, 0.06]));
    if (skin.mohawk) for (let i = 0; i < 5; i++) b.add(G.cone(5), skin.mohawk, mat(0.9 - i * 0.38, 1.0 - Math.abs(i - 1) * 0.07, 0, 0, 0, 0.35, [0.12, 0.36, 0.08]));
    if (skin.antenna) {
      b.add(G.cyl(0.03, 0.03, 6), '#495057', mat(0.85, 1.15, 0, 0, 0, 0, [1, 0.5, 1]));
      b.add(G.sphere(8, 6), '#ff4d6d', mat(0.85, 1.42, 0, 0, 0, 0, 0.1));
      for (const s of [1, -1]) b.add(G.box(), '#93a3b3', mat(-0.1, 0.2, 0.93 * s, 0, 0, 0, [0.5, 0.35, 0.06]));
    }
    if (skin.horn) {
      b.add(G.cone(8), '#ffd6f5', mat(1.2, 1.05, 0, 0, 0, -0.5, [0.1, 0.55, 0.1]));
      b.add(G.torus(0.3, Math.PI * 2, 8), '#ffd54a', mat(1.12, 0.9, 0, Math.PI / 2, 0, -0.5, 0.11));
    }
    if (!b.empty) extras.add(b.mesh());
    if (skin.bubble) {
      const bubble = new THREE.Mesh(G.sphere(20, 14), new THREE.MeshToonMaterial({ color: '#bdefff', transparent: true, opacity: 0.28, gradientMap: toon('#fff').gradientMap, depthWrite: false }));
      bubble.position.set(1.05, 0.4, 0);
      bubble.scale.setScalar(0.95);
      extras.add(bubble);
      const collar = new THREE.Mesh(G.torus(0.18, Math.PI * 2, 18), toon('#f8f9fa'));
      collar.position.set(0.55, 0.2, 0);
      collar.rotation.y = Math.PI / 2;
      collar.rotation.x = 0.4;
      collar.scale.setScalar(0.72);
      extras.add(collar);
    }
  }

  function applyGear(tiers) {
    const w = tiers.wings || 0;
    const r = tiers.rocket || 0;
    const h = tiers.helmet || 0;
    const key = `${w}|${r}|${h}`;
    if (key === gearKey) return;
    gearKey = key;
    for (const g of gear.wings) bodyG.remove(g);
    if (gear.rocket) bodyG.remove(gear.rocket);
    if (gear.helmet) bodyG.remove(gear.helmet);
    gear = { wings: [], rocket: null, helmet: null };
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(-0.05, 0.4, 0.55 * s);
      const mesh = new THREE.Mesh(wingGeometry(w, s), toon('#fff').clone());
      mesh.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#fff').gradientMap });
      mesh.position.z = -0.55 * s;
      mesh.castShadow = true;
      pivot.add(mesh);
      pivot.userData.sign = s;
      bodyG.add(pivot);
      gear.wings.push(pivot);
    }
    gear.rocket = rocketGroup(r);
    bodyG.add(gear.rocket);
    gear.helmet = helmetMesh(h);
    if (gear.helmet) bodyG.add(gear.helmet);
    parts.snout.visible = h < 4;
    parts.nostrilL.visible = h < 4;
    parts.nostrilR.visible = h < 4;
  }

  function setFace(face, t) {
    let eyeY = 1;
    let eyeS = 1;
    let pupS = 1;
    if (face === 'determined') eyeY = 0.55;
    else if (face === 'scared') { eyeS = 1.25; pupS = 0.6; }
    else if (face === 'splat') eyeY = 0.12;
    for (const s of [1, -1]) {
      parts[`eye${s}`].scale.set(eyeS, eyeS * eyeY, eyeS);
      const p = parts[`pupil${s}`];
      p.scale.setScalar(0.095 * pupS);
      if (face === 'dizzy') {
        const a = t * 9 * s;
        p.position.set(0.12, Math.sin(a) * 0.06, 0.03 * s + Math.cos(a) * 0.06);
      } else {
        p.position.set(0.12, 0.01, 0.03 * s);
      }
    }
    parts.smile.visible = face === 'happy' || face === 'determined';
  }

  // ---------- shatter: cartoon break-apart into the model's own parts ----------
  const pieces = [];
  let pieceScene = null;
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();

  function shatter(scene, power = 1) {
    if (pieces.length) return;
    pieceScene = scene;
    root.updateMatrixWorld(true);
    const center = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
    const size = root.scale.x;
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      let vis = true;
      for (let p = o.parent; p; p = p.parent) if (!p.visible) vis = false;
      if (!vis || o.material.blending === THREE.AdditiveBlending) return;
      o.matrixWorld.decompose(tmpV, tmpQ, tmpS);
      const m = new THREE.Mesh(o.geometry, o.material);
      m.position.copy(tmpV);
      m.quaternion.copy(tmpQ);
      m.scale.copy(tmpS);
      m.castShadow = true;
      const dir = tmpV.clone().sub(center);
      dir.z += (Math.random() - 0.5) * size;
      if (dir.lengthSq() < 1e-4) dir.set(Math.random() - 0.5, 1, Math.random() - 0.5);
      dir.normalize();
      const sp = (6 + Math.random() * 8) * power * Math.sqrt(size);
      m.userData.v = new THREE.Vector3(dir.x * sp, Math.abs(dir.y) * sp + (5 + Math.random() * 6) * Math.sqrt(size), dir.z * sp);
      m.userData.w = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      m.userData.r = 0.25 * size;
      scene.add(m);
      pieces.push(m);
    });
    root.visible = false;
  }

  function updatePieces(dt, floorAt) {
    for (const m of pieces) {
      const u = m.userData;
      u.v.y -= 28 * dt;
      m.position.addScaledVector(u.v, dt);
      const floor = floorAt(m.position.x, m.position.z) + u.r;
      if (m.position.y < floor) {
        m.position.y = floor;
        u.v.y = Math.abs(u.v.y) * 0.38;
        u.v.x *= 0.62;
        u.v.z *= 0.62;
        u.w.multiplyScalar(0.6);
      }
      m.rotation.x += u.w.x * dt;
      m.rotation.y += u.w.y * dt;
      m.rotation.z += u.w.z * dt;
    }
  }

  function reassemble() {
    for (const m of pieces) pieceScene.remove(m);
    pieces.length = 0;
    root.visible = true;
  }

  return {
    root,
    shatter,
    updatePieces,
    reassemble,
    get shattered() { return pieces.length > 0; },
    // opts: { skin, tiers, face, boosting, t, squash, flap }
    update({ skin, tiers, face = 'happy', boosting = false, t = 0, squash = 0, flap = 1 }) {
      applySkin(skin);
      applyGear(tiers || {});
      setFace(face, t);
      const sq = Math.max(-0.45, Math.min(0.45, squash));
      bodyG.scale.set(1 + sq * 0.6, 1 - sq * 0.6, 1 + sq * 0.3);
      for (const s of [1, -1]) {
        parts[`ear${s}`].rotation.set(s * 0.25, 0, -0.5 + Math.sin(t * 9 + s) * 0.25 * flap);
      }
      parts.tail.rotation.set(0, Math.sin(t * 6) * 0.4, t * 2);
      for (const p of gear.wings) {
        const s = p.userData.sign;
        p.rotation.set(-s * (0.5 + Math.sin(t * (boosting ? 18 : 10)) * 0.25 * flap), -s * 0.45, 0);
      }
      if (gear.rocket && gear.rocket.userData.flame) {
        const fl = gear.rocket.userData.flame;
        fl.visible = boosting;
        if (boosting) {
          const k = 0.85 + Math.random() * 0.35;
          fl.scale.set(k, 1 + Math.random() * 0.15, 1 + Math.random() * 0.15);
        }
      }
    },
  };
}
