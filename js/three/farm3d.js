// Launch site: barn, silo, windmill, fences, the farmer, a sign and the
// launcher (which changes model with the Launcher upgrade tier).

import { THREE, Builder, G, mat, toon, vertexToon } from './kit.js';
import { HILL, LAUNCH_ANGLE } from '../config.js';

const DIR = new THREE.Vector3(Math.cos(LAUNCH_ANGLE), Math.sin(LAUNCH_ANGLE), 0);
const SEAT = new THREE.Vector3(0, 3, 0);

function barn(b) {
  const x = -25;
  const z = -13;
  b.add(G.box(), '#d64045', mat(x, 4, z, 0, 0, 0, [11, 8, 9]));
  b.add(G.box(), '#d64045', mat(x, 8, z, Math.PI / 4, 0, 0, [11, 6.3, 6.3]));
  for (const s of [1, -1]) b.add(G.box(), '#6b2b2b', mat(x, 10.35, z + 2.35 * s, s * Math.PI / 4, 0, 0, [11.8, 0.35, 6.9]));
  b.add(G.box(), '#ffffff', mat(x + 5.55, 2.6, z, 0, 0, 0, [0.12, 5.2, 4.6]));
  b.add(G.box(), '#b8323a', mat(x + 5.6, 2.6, z, 0, 0, 0, [0.12, 4.6, 4]));
  b.add(G.box(), '#ffffff', mat(x + 5.66, 2.6, z, Math.atan2(4.6, 4), 0, 0, [0.1, 6, 0.3]));
  b.add(G.box(), '#ffffff', mat(x + 5.66, 2.6, z, -Math.atan2(4.6, 4), 0, 0, [0.1, 6, 0.3]));
  b.add(G.box(), '#ffffff', mat(x + 5.6, 7.4, z, 0, 0, 0, [0.12, 1.6, 1.6]));
  b.add(G.box(), '#3a2230', mat(x + 5.65, 7.4, z, 0, 0, 0, [0.12, 1.2, 1.2]));
  b.add(G.box(), '#ffffff', mat(x, 8.05, z, 0, 0, 0, [11.2, 0.25, 9.2]));
  // silo
  b.add(G.cyl(2.3, 2.3, 16), '#a9c4d6', mat(-36, 7, -17, 0, 0, 0, [1, 14, 1]));
  b.add(G.sphere(16, 8), '#e63946', mat(-36, 14, -17, 0, 0, 0, [2.4, 1.8, 2.4]));
  for (const y of [3, 7, 11]) b.add(G.cyl(2.36, 2.36, 16), '#7d9bb0', mat(-36, y, -17, 0, 0, 0, [1, 0.25, 1]));
  // hay bales and a cart near the barn
  for (const [hx, hz] of [[-17, -8], [-15.4, -9], [-16.4, -6.8]]) b.add(G.cyl(0.9, 0.9, 12), '#f2c14e', mat(hx, 0.9, hz, Math.PI / 2, 0.3, 0, [1, 1.6, 1]));
  // fences along the plateau
  for (let k = 0; k < 12; k++) b.add(G.box(), '#b07d4f', mat(-46 + k * 3, 0.7, -5.5, 0, 0, 0, [0.22, 1.4, 0.22]));
  for (const hy of [0.55, 1.05]) b.add(G.box(), '#c8925e', mat(-29.5, hy, -5.5, 0, 0, 0, [33, 0.16, 0.1]));
  // chickens
  for (const [cx, cz, r] of [[-12, -3, 0.2], [-10.5, -4, 1.8], [-19, -2.5, 3]]) {
    b.add(G.sphere(8, 6), '#ffffff', mat(cx, 0.45, cz, 0, r, 0, [0.45, 0.4, 0.35]));
    b.add(G.sphere(6, 4), '#ffffff', mat(cx + Math.cos(r) * 0.35, 0.8, cz - Math.sin(r) * 0.35, 0, 0, 0, 0.22));
    b.add(G.cone(4), '#e63946', mat(cx + Math.cos(r) * 0.35, 1.03, cz - Math.sin(r) * 0.35, 0, 0, 0, [0.08, 0.14, 0.08]));
    b.add(G.cone(4), '#ffb703', mat(cx + Math.cos(r) * 0.58, 0.8, cz - Math.sin(r) * 0.58, 0, -r, -Math.PI / 2, [0.06, 0.14, 0.06]));
  }
  // sign: posts and a board (text is a separate textured plane)
  b.add(G.box(), '#8d5a35', mat(-9.8, 1, 2, 0, 0, 0, [0.25, 2, 0.25]));
  b.add(G.box(), '#8d5a35', mat(-7.2, 1, 2, 0, 0, 0, [0.25, 2, 0.25]));
  b.add(G.box(), '#c8925e', mat(-8.5, 2.1, 2, 0, 0, 0, [3.6, 1.4, 0.18]));
}

function signText() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 100;
  const g = cv.getContext('2d');
  g.fillStyle = '#c8925e';
  g.fillRect(0, 0, 256, 100);
  g.fillStyle = '#3a2230';
  g.font = '900 38px "Trebuchet MS", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MOON ➜', 128, 42);
  g.font = '800 18px "Trebuchet MS", system-ui, sans-serif';
  g.fillText('384,400 km', 128, 78);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.3), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(-8.5, 2.1, 2.1);
  return m;
}

function windmill() {
  const grp = new THREE.Group();
  const b = new Builder();
  b.add(G.cyl(1.2, 2.2, 8), '#f1e3c8', mat(0, 6, 0, 0, 0, 0, [1, 12, 1]));
  b.add(G.cone(8), '#8d5a35', mat(0, 13.2, 0, 0, 0, 0, [1.7, 2.4, 1.7]));
  b.add(G.box(), '#8d5a35', mat(0, 1.2, 2.1, 0, 0, 0, [1.2, 2.2, 0.2]));
  grp.add(b.mesh());
  const blades = new Builder();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    blades.add(G.box(), '#ffffff', mat(Math.cos(a) * 3.3, Math.sin(a) * 3.3, 0, 0, 0, a, [5.6, 1.1, 0.1]));
    blades.add(G.box(), '#8d5a35', mat(Math.cos(a) * 3.3, Math.sin(a) * 3.3, -0.06, 0, 0, a, [5.8, 0.15, 0.1]));
  }
  blades.add(G.sphere(8, 6), '#8d5a35', mat(0, 0, 0, 0, 0, 0, 0.5));
  const rotor = blades.mesh();
  const hub = new THREE.Group();
  hub.position.set(0, 11.5, 1.9);
  hub.add(rotor);
  grp.add(hub);
  grp.position.set(-50, HILL, -30);
  grp.rotation.y = 0.5;
  grp.userData.rotor = hub;
  return grp;
}

function farmer() {
  const grp = new THREE.Group();
  const body = new Builder();
  body.add(G.box(), '#2f5d9e', mat(-0.22, 0.5, 0, 0, 0, 0, [0.32, 1, 0.34]));
  body.add(G.box(), '#2f5d9e', mat(0.22, 0.5, 0, 0, 0, 0, [0.32, 1, 0.34]));
  body.add(G.box(), '#4a2c1d', mat(-0.22, 0.05, 0.06, 0, 0, 0, [0.36, 0.14, 0.5]));
  body.add(G.box(), '#4a2c1d', mat(0.22, 0.05, 0.06, 0, 0, 0, [0.36, 0.14, 0.5]));
  body.add(G.cyl(0.42, 0.48, 10), '#d64045', mat(0, 1.45, 0, 0, 0, 0, [1, 1, 0.8]));
  body.add(G.box(), '#2f5d9e', mat(0, 1.25, 0.25, 0, 0, 0, [0.7, 0.6, 0.2]));
  body.add(G.sphere(12, 10), '#f1c27d', mat(0, 2.3, 0, 0, 0, 0, 0.42));
  body.add(G.sphere(8, 6), '#e0a96d', mat(0, 2.25, 0.42, 0, 0, 0, 0.1));
  body.add(G.sphere(10, 6), '#f8f9fa', mat(0, 2.05, 0.25, 0, 0, 0, [0.36, 0.25, 0.2]));
  body.add(G.cyl(0.9, 0.9, 16), '#f2c14e', mat(0, 2.62, 0, 0, 0, 0, [1, 0.06, 1]));
  body.add(G.cyl(0.4, 0.46, 12), '#f2c14e', mat(0, 2.85, 0, 0, 0, 0, [1, 0.45, 1]));
  body.add(G.cyl(0.47, 0.47, 12), '#d64045', mat(0, 2.7, 0, 0, 0, 0, [1, 0.1, 1]));
  for (const s of [1, -1]) body.add(G.sphere(6, 4), '#3a2230', mat(0.15 * s, 2.38, 0.38, 0, 0, 0, 0.05));
  grp.add(body.mesh());
  const arms = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.5 * s, 1.8, 0);
    const a = new Builder();
    a.add(G.cyl(0.13, 0.13, 8), '#d64045', mat(0, -0.45, 0, 0, 0, 0, [1, 0.9, 1]));
    a.add(G.sphere(8, 6), '#f1c27d', mat(0, -0.95, 0, 0, 0, 0, 0.15));
    pivot.add(a.mesh());
    grp.add(pivot);
    arms.push(pivot);
  }
  grp.userData.arms = arms;
  grp.position.set(-4.6, HILL, 2.8);
  grp.rotation.y = 0.5;
  return grp;
}

// ---------- launchers ----------
// Every launcher has its launch point at SEAT (local) and returns the pig seat
// for a pull amount 0..1 via userData.seat(pull, out).
function slingshot(big) {
  const s = big ? 1.3 : 1.1;
  const b = new Builder();
  const wood = big ? '#6f4b2e' : '#8d5a35';
  const X = 0.7;
  b.add(G.cyl(0.3 * s, 0.4 * s, 8), wood, mat(X, 0.8 * s, 0, 0, 0, 0, [1, 1.6 * s, 1]));
  for (const z of [1, -1]) {
    b.add(G.cyl(0.22 * s, 0.28 * s, 8), wood, mat(X, 2.0 * s, 0.5 * z * s, z * 0.55, 0, 0, [1, 1.3 * s, 1]));
    b.add(G.cyl(0.3 * s, 0.3 * s, 8), '#e63946', mat(X, 2.55 * s, 0.85 * z * s, z * 0.55, 0, 0, [1, 0.25, 1]));
  }
  b.add(G.box(), '#6b4a3a', mat(X, 0.12, 0, 0, 0, 0, [2.4, 0.24, 2.4]));
  const grp = new THREE.Group();
  grp.add(b.mesh());
  const bandMat = toon('#e63946');
  const bands = [1, -1].map(() => {
    const m = new THREE.Mesh(G.box(), bandMat);
    grp.add(m);
    return m;
  });
  const pouch = new THREE.Mesh(G.box(), toon('#6b4a3a'));
  grp.add(pouch);
  const tip = new THREE.Vector3(X, 2.8 * s, 0);
  grp.userData.seat = (pull, out) => out.copy(tip).addScaledVector(DIR, -(0.9 + pull * 1.8)).add(new THREE.Vector3(0, 0.15, 0));
  grp.userData.animate = (pull) => {
    const seat = grp.userData.seat(pull, new THREE.Vector3());
    const back = seat.clone().addScaledVector(DIR, -0.9);
    pouch.position.copy(back);
    pouch.scale.set(0.25, 1.1, 1.3);
    pouch.rotation.z = LAUNCH_ANGLE;
    [1, -1].forEach((z, i) => {
      const a = new THREE.Vector3(X, 2.8 * s, 1.05 * z * s);
      const bz = back.clone().setZ(0.6 * z);
      const len = a.distanceTo(bz);
      const m = bands[i];
      m.position.copy(a).add(bz).multiplyScalar(0.5);
      m.scale.set(0.14, 0.14, len);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bz.clone().sub(a).normalize());
    });
  };
  return grp;
}

// Classic catapult: the arm cranks back (bucket low behind the frame) and
// swings forward to a stop, flinging the pig from the bucket.
function catapult() {
  const PIVOT = new THREE.Vector3(0, 1.4, 0);
  const ARM = 2.3;
  const CUP = 0.75;
  const b = new Builder();
  for (const z of [0.95, -0.95]) {
    b.add(G.box(), '#8d5a35', mat(-0.9, 0.35, z, 0, 0, 0, [3.6, 0.35, 0.3]));
    b.add(G.box(), '#6f4b2e', mat(0, 0.95, z, 0, 0, 0, [0.3, 1.3, 0.3]));
    b.add(G.box(), '#6f4b2e', mat(-0.55, 0.9, z, 0, 0, 0.75, [0.25, 1.5, 0.25]));
    b.add(G.cyl(0.45, 0.45, 10), '#5c3a21', mat(-2.2, 0.45, z * 1.12, Math.PI / 2, 0, 0, [1, 0.2, 1]));
    b.add(G.cyl(0.45, 0.45, 10), '#5c3a21', mat(0.6, 0.45, z * 1.12, Math.PI / 2, 0, 0, [1, 0.2, 1]));
    // front posts with the stop bar the arm slams into
    b.add(G.box(), '#6f4b2e', mat(-0.12, 1.6, z, 0, 0, 0, [0.25, 2.5, 0.25]));
  }
  b.add(G.cyl(0.14, 0.14, 8), '#e63946', mat(-0.12, 2.75, 0, Math.PI / 2, 0, 0, [1, 2.1, 1]));
  b.add(G.cyl(0.16, 0.16, 8), '#495057', mat(PIVOT.x, PIVOT.y, 0, Math.PI / 2, 0, 0, [1, 2.1, 1]));
  b.add(G.box(), '#a47148', mat(-2.4, 0.9, 0, 0, 0, 0, [0.9, 0.9, 1.2]));
  const grp = new THREE.Group();
  grp.add(b.mesh());
  const arm = new THREE.Group();
  arm.position.copy(PIVOT);
  const ab = new Builder();
  ab.add(G.box(), '#a47148', mat(ARM / 2, 0, 0, 0, 0, 0, [ARM + 0.3, 0.28, 0.32]));
  ab.add(G.cyl(0.62, 0.42, 10), '#6f4b2e', mat(ARM, -0.22, 0, Math.PI, 0, 0, [1, 0.35, 1]));
  ab.add(G.cyl(0.28, 0.28, 10), '#495057', mat(-0.3, 0, 0, 0, 0, Math.PI / 2, [1, 0.4, 1]));
  arm.add(ab.mesh());
  grp.add(arm);
  // Angle from +x: ~106 deg when released (up, leaning back onto the stop), ~200 deg cranked back.
  const armAngle = (pull) => 1.85 + pull * 1.65;
  grp.userData.seat = (pull, out) => {
    const a = armAngle(pull);
    return out.set(PIVOT.x + Math.cos(a) * ARM + Math.sin(a) * CUP, PIVOT.y + Math.sin(a) * ARM - Math.cos(a) * CUP, 0);
  };
  grp.userData.animate = (pull) => { arm.rotation.z = armAngle(pull); };
  return grp;
}

function cannon(style) {
  const colors = {
    hay: { barrel: '#c8925e', band: '#f2c14e', wheel: '#6f4b2e' },
    circus: { barrel: '#e63946', band: '#ffd23f', wheel: '#3a86ff' },
    steam: { barrel: '#d4a017', band: '#8d5a35', wheel: '#495057' },
  }[style];
  const grp = new THREE.Group();
  const base = new Builder();
  for (const z of [1.1, -1.1]) {
    base.add(G.cyl(1.2, 1.2, 14), colors.wheel, mat(-1.6, 1.2, z, Math.PI / 2, 0, 0, [1, 0.3, 1]));
    base.add(G.cyl(0.3, 0.3, 8), '#dee2e6', mat(-1.6, 1.2, z * 1.12, Math.PI / 2, 0, 0, [1, 0.35, 1]));
  }
  base.add(G.box(), colors.wheel, mat(-1.6, 1.2, 0, 0, 0, 0, [0.5, 0.5, 2.4]));
  if (style === 'steam') {
    base.add(G.cyl(0.6, 0.6, 12), '#8d5a35', mat(-3.2, 1.6, 0.8, 0, 0, 0, [1, 3.2, 1]));
    base.add(G.cyl(0.2, 0.3, 8), '#495057', mat(-3.2, 3.6, 0.8, 0, 0, 0, [1, 1.2, 1]));
  }
  grp.add(base.mesh());
  const barrel = new THREE.Group();
  const bb = new Builder();
  const L = 5;
  bb.add(G.cyl(0.95, 1.15, 18), colors.barrel, mat(0, -L / 2, 0, 0, 0, 0, [1, L, 1]));
  bb.add(G.cyl(1.2, 1.2, 18), colors.band, mat(0, -0.25, 0, 0, 0, 0, [1, 0.45, 1]));
  bb.add(G.cyl(1.25, 1.25, 18), colors.band, mat(0, -L + 0.3, 0, 0, 0, 0, [1, 0.5, 1]));
  bb.add(G.sphere(14, 8), colors.barrel, mat(0, -L, 0, 0, 0, 0, 1.15));
  if (style === 'circus') for (let k = 0; k < 3; k++) bb.add(G.cyl(1.06, 1.06, 18), '#ffffff', mat(0, -1.4 - k * 1.1, 0, 0, 0, 0, [1, 0.2, 1]));
  bb.add(G.cyl(0.8, 0.8, 18), '#212529', mat(0, 0.02, 0, 0, 0, 0, [1, 0.05, 1]));
  barrel.add(bb.mesh());
  barrel.rotation.z = LAUNCH_ANGLE - Math.PI / 2;
  grp.add(barrel);
  barrel.position.copy(SEAT).addScaledVector(DIR, -0.6);
  const home = barrel.position.clone();
  grp.userData.seat = (pull, out) => out.copy(SEAT).addScaledVector(DIR, -0.9 - pull * 0.5);
  grp.userData.animate = (pull) => { barrel.position.copy(home).addScaledVector(DIR, -pull * 0.5); };
  return grp;
}

function tractor() {
  const grp = new THREE.Group();
  const b = new Builder();
  b.add(G.box(), '#2b9348', mat(-3.2, 1.8, 0, 0, 0, 0, [3.4, 1.6, 2]));
  b.add(G.box(), '#2b9348', mat(-4.2, 3.1, 0, 0, 0, 0, [1.6, 1.4, 1.8]));
  b.add(G.box(), '#bde0fe', mat(-3.4, 3.1, 0, 0, 0, 0, [0.1, 1, 1.5]));
  b.add(G.cyl(0.15, 0.15, 6), '#495057', mat(-2.2, 3.2, 0.6, 0, 0, 0, [1, 1.6, 1]));
  for (const z of [1.2, -1.2]) {
    b.add(G.cyl(1.3, 1.3, 14), '#212529', mat(-4.2, 1.3, z, Math.PI / 2, 0, 0, [1, 0.7, 1]));
    b.add(G.cyl(0.7, 0.7, 14), '#212529', mat(-1.9, 0.7, z, Math.PI / 2, 0, 0, [1, 0.5, 1]));
    b.add(G.cyl(0.6, 0.6, 10), '#ffd23f', mat(-4.2, 1.3, z * 1.2, Math.PI / 2, 0, 0, [1, 0.1, 1]));
  }
  const rampLen = 6;
  const mid = SEAT.clone().addScaledVector(DIR, -rampLen / 2 - 0.4);
  b.add(G.box(), '#ffd23f', mat(mid.x, mid.y - 0.9, 0, 0, 0, LAUNCH_ANGLE, [rampLen, 0.25, 2.2]));
  for (const z of [1, -1]) b.add(G.box(), '#e63946', mat(mid.x, mid.y - 0.7, z * 1.05, 0, 0, LAUNCH_ANGLE, [rampLen, 0.4, 0.12]));
  b.add(G.box(), '#adb5bd', mat(mid.x + 1, (mid.y - 0.9) / 2, 0, 0, 0, 0, [0.3, mid.y - 0.9, 0.3]));
  grp.add(b.mesh());
  grp.userData.seat = (pull, out) => out.copy(SEAT).addScaledVector(DIR, -1 - pull * 3.2);
  grp.userData.animate = () => {};
  return grp;
}

function railgun() {
  const grp = new THREE.Group();
  const b = new Builder();
  const L = 7;
  const mid = SEAT.clone().addScaledVector(DIR, -L / 2 + 0.4);
  b.add(G.box(), '#495057', mat(mid.x - 0.4, mid.y / 2 - 0.4, 0, 0, 0, 0, [2.4, mid.y - 0.4, 1.8]));
  for (const z of [0.95, -0.95]) {
    b.add(G.box(), '#343a40', mat(mid.x, mid.y, z, 0, 0, LAUNCH_ANGLE, [L, 0.5, 0.35]));
    b.add(G.box(), '#212529', mat(mid.x, mid.y + 0.3, z, 0, 0, LAUNCH_ANGLE, [L * 0.95, 0.12, 0.4]));
  }
  for (let k = 0; k < 4; k++) {
    const p = SEAT.clone().addScaledVector(DIR, -1.2 - k * 1.6);
    b.add(G.torus(0.2, Math.PI * 2, 14), '#6c757d', mat(p.x, p.y, 0, 0, Math.PI / 2, LAUNCH_ANGLE - Math.PI / 2 + Math.PI / 2, [1.2, 1.2, 1.2]).multiply(mat(0, 0, 0, 0, 0, 0)));
  }
  grp.add(b.mesh());
  const glowStrip = new Builder();
  for (const z of [0.76, -0.76]) glowStrip.add(G.box(), '#39e1ff', mat(mid.x, mid.y + 0.02, z, 0, 0, LAUNCH_ANGLE, [L * 0.9, 0.18, 0.05]));
  const gm = new THREE.Mesh(glowStrip.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  grp.add(gm);
  grp.userData.seat = (pull, out) => out.copy(SEAT).addScaledVector(DIR, -1 - pull * 4);
  grp.userData.animate = (pull, t) => { gm.material.color.setScalar(0.7 + Math.sin(t * 8) * 0.3 * (0.5 + pull)); };
  return grp;
}

function launcherFor(tier) {
  if (tier <= 0) return slingshot(false);
  if (tier === 1) return slingshot(true);
  if (tier === 2) return catapult();
  if (tier === 3) return cannon('hay');
  if (tier === 4) return cannon('circus');
  if (tier === 5) return tractor();
  if (tier === 6) return cannon('steam');
  return railgun();
}

export function createFarm(scene) {
  const grp = new THREE.Group();
  grp.position.set(0, HILL, 0);
  const b = new Builder();
  barn(b);
  const statics = b.mesh();
  statics.receiveShadow = true;
  grp.add(statics);
  grp.add(signText());
  scene.add(grp);
  const mill = windmill();
  scene.add(mill);
  const man = farmer();
  scene.add(man);
  let launcher = null;
  let tierNow = -1;
  const seat = new THREE.Vector3();

  function setTier(tier) {
    if (tier === tierNow) return;
    tierNow = tier;
    if (launcher) {
      grp.remove(launcher);
      launcher.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    launcher = launcherFor(tier);
    launcher.traverse((o) => { o.castShadow = true; });
    grp.add(launcher);
  }

  return {
    group: grp,
    // Returns the pig's seat position in world space for the pull amount.
    update({ tier, pull, t, cheer, visible }) {
      grp.visible = visible;
      mill.visible = visible;
      man.visible = visible;
      if (!visible) return seat;
      setTier(tier);
      launcher.userData.animate(pull, t);
      mill.userData.rotor.rotation.z = -t * 0.8;
      const arms = man.userData.arms;
      const up = cheer < 0 ? 1 : 0;
      arms[0].rotation.z = up ? 2.6 + Math.sin(t * 14) * 0.3 : 0.15 + Math.sin(t * 2) * 0.05;
      arms[1].rotation.z = up ? -2.6 - Math.sin(t * 14 + 1) * 0.3 : -0.15;
      man.position.y = HILL + (up ? Math.abs(Math.sin(t * 9)) * 0.35 : 0);
      launcher.userData.seat(pull, seat);
      return seat.clone().add(grp.position);
    },
  };
}

export { vertexToon };
