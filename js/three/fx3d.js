// Particles as one Points draw call (sizes in screen pixels, like the 2D
// fx module), the pig's ribbon trail, and the dashed best-height line.

import { THREE, gradientMap } from './kit.js';

const MAX = 480;
const TRAIL_MAX = 40;
const RAINBOW = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].map((c) => new THREE.Color(c));
const SHAPES = { smoke: 0, dot: 1, spark: 1, confetti: 2, feather: 2 };

export function createFx3d(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const alpha = new Float32Array(MAX);
  const size = new Float32Array(MAX);
  const shape = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('shape', new THREE.BufferAttribute(shape, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { ratio: { value: 1 } },
    vertexShader: `attribute float alpha; attribute float size; attribute float shape; uniform float ratio;
      varying vec3 vColor; varying float vAlpha; varying float vShape;
      void main(){ vColor = color; vAlpha = alpha; vShape = shape;
        gl_PointSize = size * ratio; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha; varying float vShape;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = vAlpha;
        if (vShape < 0.5) { a *= smoothstep(0.5, 0.15, r); }
        else if (vShape < 1.5) { if (r > 0.5) discard; a *= smoothstep(0.5, 0.42, r); }
        else { if (abs(d.y) > 0.25) discard; }
        gl_FragColor = vec4(vColor, a);
      #include <colorspace_fragment>
      }`,
    vertexColors: true,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  // Trail ribbon: a strip facing the camera (+z), with per-vertex alpha.
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(TRAIL_MAX * 2 * 3);
  const tCol = new Float32Array(TRAIL_MAX * 2 * 4);
  const idx = [];
  for (let i = 0; i < TRAIL_MAX - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  tGeo.setIndex(idx);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 4).setUsage(THREE.DynamicDrawUsage));
  const trail = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false;
  scene.add(trail);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)]);
  const bestLine = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.03, gapSize: 0.02, transparent: true, opacity: 0.8 }));
  bestLine.computeLineDistances();
  bestLine.frustumCulled = false;
  scene.add(bestLine);

  const c = new THREE.Color();

  // ---------- explosions ----------
  const BOOM_STYLE = {
    fire: { core: '#fff6c2', ball: '#ffb020', edge: '#ff4d1a', smoke: '#d9d2dc', ring: '#ffe7a0' },
    spark: { core: '#ffffff', ball: '#ffe45c', edge: '#ff9f1c', smoke: '#e8e4ec', ring: '#fff3b0' },
    dirt: { core: '#fff1c9', ball: '#e0b27a', edge: '#9c6b3f', smoke: '#e6d3b8', ring: '#f5deb3' },
    mud: { core: '#c89a6a', ball: '#7a5230', edge: '#4d3019', smoke: '#a88466', ring: '#a0714b' },
    water: { core: '#ffffff', ball: '#9be7ff', edge: '#3fb8f0', smoke: '#dff6ff', ring: '#ffffff' },
  };
  const ballGeo = new THREE.IcosahedronGeometry(1, 2);
  const ringGeo = new THREE.TorusGeometry(1, 0.08, 6, 36);
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const boomPool = [];
  const boomActive = [];
  function makeBoom() {
    const g = new THREE.Group();
    const add = (geo, opts) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...opts })); g.add(m); return m; };
    const core = add(ballGeo, { blending: THREE.AdditiveBlending, fog: false });
    const ball = add(ballGeo, {});
    const ring = add(ringGeo, { fog: false });
    const puffs = [];
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshToonMaterial({ transparent: true, depthWrite: false, gradientMap: gradientMap() }));
      g.add(m);
      puffs.push({ m, a: (k / 5) * Math.PI * 2 + Math.random(), r: 0.6 + Math.random() * 0.5, up: 0.4 + Math.random() * 0.8 });
    }
    g.userData = { core, ball, ring, puffs };
    g.renderOrder = 4;
    return g;
  }
  function drawBooms(list) {
    while (boomActive.length > list.length) { const g = boomActive.pop(); scene.remove(g); boomPool.push(g); }
    while (boomActive.length < list.length) { const g = boomPool.pop() || makeBoom(); scene.add(g); boomActive.push(g); }
    list.forEach((b, i) => {
      const g = boomActive[i];
      const u = g.userData;
      const st = BOOM_STYLE[b.kind] || BOOM_STYLE.fire;
      const k = b.age / b.life;
      const e = 1 - (1 - Math.min(1, k * 2.2)) ** 3;
      g.position.set(b.x, b.y, 0.8);
      u.core.material.color.set(st.core);
      u.core.scale.setScalar(b.size * 0.7 * e * Math.max(0, 1 - k * 2.5));
      u.core.visible = k < 0.4;
      u.ball.material.color.set(st.ball).lerp(c.set(st.edge), Math.min(1, k * 1.6));
      u.ball.material.opacity = Math.max(0, 1 - k * 2.4);
      u.ball.scale.setScalar(b.size * (0.3 + e) * (b.kind === 'water' ? 0.6 : 1));
      u.ball.scale.y *= b.kind === 'water' ? 2.2 : 1;
      u.ball.position.y = b.kind === 'water' ? b.size * e : 0;
      u.ring.material.color.set(st.ring);
      u.ring.material.opacity = Math.max(0, 0.9 - k * 1.2);
      u.ring.scale.setScalar(b.size * (0.5 + k * 3.2));
      u.ring.rotation.x = b.kind === 'fire' || b.kind === 'spark' ? 0 : Math.PI / 2 - 0.25;
      for (const p of u.puffs) {
        p.m.material.color.set(st.smoke);
        p.m.material.opacity = Math.max(0, 0.7 - k) * (k < 0.08 ? k / 0.08 : 1);
        const d = b.size * (0.5 + e * 1.3) * p.r;
        p.m.position.set(Math.cos(p.a) * d, Math.sin(p.a) * d * 0.6 + k * b.size * p.up * 1.5, Math.sin(p.a * 2) * d * 0.4);
        p.m.scale.setScalar(b.size * 0.3 * p.r * (0.5 + e * 0.7));
      }
    });
  }

  // ---------- debris ----------
  const MAX_CHUNKS = 160;
  const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ gradientMap: gradientMap() }), MAX_CHUNKS);
  chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chunkMesh.frustumCulled = false;
  chunkMesh.castShadow = true;
  chunkMesh.count = 0;
  scene.add(chunkMesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const p3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  function drawChunks(list) {
    const n = Math.min(MAX_CHUNKS, list.length);
    for (let i = 0; i < n; i++) {
      const ch = list[i];
      const fade = Math.min(1, (ch.life - ch.age) / 0.3);
      e3.set(ch.rx, ch.ry, 0);
      q.setFromEuler(e3);
      p3.set(ch.x, ch.y, ch.z);
      s3.setScalar(ch.size * fade);
      m4.compose(p3, q, s3);
      chunkMesh.setMatrixAt(i, m4);
      chunkMesh.setColorAt(i, c.set(ch.color));
    }
    chunkMesh.count = n;
    chunkMesh.instanceMatrix.needsUpdate = true;
    if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
  }

  function updateParticles(fx, dpr) {
    const parts = fx.parts;
    const n = Math.min(MAX, parts.length);
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      const a = 1 - p.age / p.life;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = 0.5;
      c.set(p.color);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      alpha[i] = p.kind === 'smoke' ? a * 0.55 : a;
      size[i] = (p.kind === 'smoke' ? p.size * (1 + p.age * 2.5) : p.size) * 2;
      shape[i] = SHAPES[p.kind] ?? 1;
    }
    geo.setDrawRange(0, n);
    for (const k of ['position', 'color', 'alpha', 'size', 'shape']) geo.attributes[k].needsUpdate = true;
    material.uniforms.ratio.value = dpr;
  }

  function updateTrail(pts, head, skinTrail, width) {
    const n = Math.min(TRAIL_MAX - 1, pts.length);
    const all = n > 0 ? [...pts.slice(pts.length - n), head] : [];
    trail.visible = all.length >= 2;
    if (!trail.visible) return;
    const rainbow = skinTrail === 'rainbow';
    if (!rainbow) c.set(skinTrail);
    for (let i = 0; i < TRAIL_MAX; i++) {
      const p = all[Math.min(i, all.length - 1)];
      const q = all[Math.max(0, Math.min(i, all.length - 1) - 1)];
      const r = all[Math.min(all.length - 1, i + 1)];
      let dx = r.x - q.x;
      let dy = r.y - q.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const k = Math.min(i, all.length - 1) / (all.length - 1);
      const w = width * k;
      for (let s = 0; s < 2; s++) {
        const sign = s ? -1 : 1;
        const vi = (i * 2 + s) * 3;
        tPos[vi] = p.x - dy * w * sign;
        tPos[vi + 1] = p.y + dx * w * sign;
        tPos[vi + 2] = -0.2;
        const ci = (i * 2 + s) * 4;
        const cc = rainbow ? RAINBOW[i % RAINBOW.length] : c;
        tCol[ci] = cc.r;
        tCol[ci + 1] = cc.g;
        tCol[ci + 2] = cc.b;
        tCol[ci + 3] = i < all.length ? k * 0.6 : 0;
      }
    }
    tGeo.attributes.position.needsUpdate = true;
    tGeo.attributes.color.needsUpdate = true;
  }

  return {
    update({ fx, dpr, trailPts, head, skinTrail, trailWidth, best, x0, x1, showBest }) {
      updateParticles(fx, dpr);
      drawBooms(fx.booms);
      drawChunks(fx.chunks);
      updateTrail(trailPts || [], head, skinTrail, trailWidth);
      bestLine.visible = showBest;
      if (showBest) {
        bestLine.position.set((x0 + x1) / 2, best, 0);
        bestLine.scale.set((x1 - x0) / 2, 1, 1);
      }
    },
  };
}
