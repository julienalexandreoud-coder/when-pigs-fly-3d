// Victory scene on the Moon: cratered ground, Earth in a starry sky, a
// waving flag and Pip bouncing in low gravity.

import { THREE, Builder, G, mat, hash01, vertexToon, toon } from './kit.js';

function moonGround() {
  const geo = new THREE.CircleGeometry(90, 64, 0, Math.PI * 2);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const craters = [[-8, -6, 4], [9, -10, 6], [14, 4, 3], [-16, 2, 5], [3, -22, 8], [-4, 6, 2.2], [24, -18, 7]];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    let y = Math.sin(x * 0.15) * 0.4 + Math.sin(z * 0.21 + 1) * 0.35 + Math.max(0, Math.hypot(x, z) - 30) * 0.08;
    for (const [cx, cz, r] of craters) {
      const d = Math.hypot(x - cx, z - cz) / r;
      if (d < 1) y -= (1 - d * d) * r * 0.25;
      else if (d < 1.4) y += (1.4 - d) * r * 0.12;
    }
    p.setY(i, y);
  }
  const b = new Builder();
  b.addPainted(geo, (x, y, z) => new THREE.Color(y < -0.3 ? '#a9a391' : hash01(Math.floor(x), Math.floor(z)) < 0.3 ? '#cfc9b6' : '#dcd6c3'));
  for (let k = 0; k < 14; k++) {
    const a = hash01(k, 1) * Math.PI * 2;
    const r = 8 + hash01(k, 2) * 30;
    const s = 0.4 + hash01(k, 3) * 1.2;
    b.add(G.dodeca(0), '#bdb6a2', mat(Math.cos(a) * r, s * 0.3, Math.sin(a) * r - 6, k, k * 2, 0, s));
  }
  const m = b.mesh({ shadow: false });
  m.receiveShadow = true;
  return m;
}

function earth() {
  const b = new Builder();
  b.addPainted(new THREE.IcosahedronGeometry(1, 3), (x, y, z) => {
    const n = Math.sin(x * 4.2 + z * 2.1) + Math.sin(y * 5.1 - x * 1.7) + Math.sin(z * 6.3 + y * 2);
    if (Math.abs(y) > 0.85) return new THREE.Color('#f8f9fa');
    return new THREE.Color(n > 0.9 ? '#57cc99' : n > 0.6 ? '#80ed99' : '#3a86ff');
  });
  const m = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 32, 16), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.25, side: THREE.BackSide }));
  m.add(halo);
  return m;
}

function stars() {
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = hash01(i, 11) * Math.PI * 2;
    const u = hash01(i, 12);
    pos.set([Math.cos(a) * 400 * Math.sqrt(1 - u * u), u * 400, Math.sin(a) * 400 * Math.sqrt(1 - u * u) - 100], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false }));
}

export function createMoonScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050818');
  scene.add(new THREE.HemisphereLight('#dfe7ff', '#6b6655', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 2.6);
  sun.position.set(12, 20, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12;
  scene.add(sun);
  scene.add(moonGround(), stars());
  const e = earth();
  e.position.set(-26, 22, -70);
  e.scale.setScalar(9);
  scene.add(e);

  // Flag: pole plus a cloth whose vertices wave.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8), toon('#dee2e6'));
  pole.position.set(2.4, 2.1, -0.5);
  pole.castShadow = true;
  const clothGeo = new THREE.PlaneGeometry(2.4, 1.5, 12, 4);
  clothGeo.translate(1.2, 0, 0);
  const base = clothGeo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshToonMaterial({ color: '#ff5a7a', side: THREE.DoubleSide, gradientMap: toon('#fff').gradientMap }));
  cloth.position.set(2.45, 3.4, -0.5);
  cloth.castShadow = true;
  scene.add(pole, cloth);
  const heart = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
  heart.position.set(1.1, 0, 0.02);
  cloth.add(heart);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  let t0 = null;

  return {
    render(gl, pig, s, view) {
      if (t0 === null) t0 = s.t;
      const t = s.t - t0;
      if (pig.root.parent !== scene) scene.add(pig.root);
      pig.root.position.set(0, 1.05 + Math.abs(Math.sin(t * 2.4)) * 1.6, 0);
      pig.root.rotation.set(0, -0.5 + Math.sin(t * 0.7) * 0.15, Math.sin(t * 2.4) * 0.15);
      pig.root.scale.setScalar(1);
      pig.update({ skin: s.skin, tiers: s.tiers, face: 'happy', boosting: false, t: s.t, squash: 0, flap: 0.6 });
      const p = clothGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(x * 2.2 - t * 5) * 0.12 * x);
      }
      p.needsUpdate = true;
      clothGeo.computeVertexNormals();
      e.rotation.y = t * 0.1;
      const portrait = view.H > view.W;
      camera.aspect = view.W / view.H;
      camera.fov = portrait ? 62 : 45;
      camera.position.set(Math.sin(t * 0.15) * 2 + 1, 3.4, portrait ? 14 : 11);
      camera.lookAt(0.8, portrait ? 3.4 : 2.6, 0);
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
    },
  };
}

export { vertexToon };
