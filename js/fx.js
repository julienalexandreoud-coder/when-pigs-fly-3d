// Particles, floating text, shock rings, screen shake and flashes.
// Positions are in world metres (y up); sizes are in screen pixels.

const MAX_PARTS = 450;

export function createFx() {
  const parts = [];
  const texts = [];
  const rings = [];
  let shake = 0;
  let flash = 0;
  let flashColor = '255,255,255';

  function spawn(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  }

  return {
    // Read-only views for renderers.
    get parts() { return parts; },
    get rings() { return rings; },
    burst(x, y, n, { colors = ['#ffffff'], speed = 8, life = 0.8, size = 6, kind = 'dot', gravity = 9, drag = 1.5, spread = Math.PI * 2, dir = 0, scale = 1 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread;
        const s = speed * scale * (0.35 + Math.random() * 0.65);
        spawn({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: life * (0.6 + Math.random() * 0.6), age: 0,
          size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length],
          kind, gravity: gravity * scale, drag, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
        });
      }
    },
    puff(x, y, color, size, scale = 1) {
      spawn({ x, y, vx: (Math.random() - 0.5) * scale, vy: (Math.random() - 0.3) * scale, life: 0.7, age: 0, size, color, kind: 'smoke', gravity: -1 * scale, drag: 2, rot: 0, spin: 0 });
    },
    text(x, y, str, { color = '#ffffff', size = 26, life = 1.1, rise = 60 } = {}) {
      if (texts.length > 24) texts.shift();
      texts.push({ x, y, str, color, size, life, age: 0, rise });
    },
    ring(x, y, color = '255,255,255', max = 420) {
      rings.push({ x, y, color, age: 0, life: 0.7, max });
    },
    shake(m) {
      shake = Math.min(18, Math.max(shake, m));
    },
    flash(color = '255,255,255', a = 0.6) {
      flashColor = color;
      flash = Math.max(flash, a);
    },
    reset() {
      parts.length = 0;
      texts.length = 0;
      rings.length = 0;
      shake = 0;
      flash = 0;
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { parts.splice(i, 1); continue; }
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy = p.vy * k - p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        texts[i].age += dt;
        if (texts[i].age >= texts[i].life) texts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].age += dt;
        if (rings[i].age >= rings[i].life) rings.splice(i, 1);
      }
      shake = Math.max(0, shake - dt * 40);
      flash = Math.max(0, flash - dt * 2.5);
    },
    shakeOffset() {
      if (shake <= 0.1) return [0, 0];
      return [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake];
    },
    // World transform active (1 unit = 1 m, y down); z = px per metre.
    drawWorld(g, z) {
      for (const p of parts) {
        const a = 1 - p.age / p.life;
        const s = p.size / z;
        g.globalAlpha = p.kind === 'smoke' ? a * 0.5 : a;
        g.fillStyle = p.color;
        if (p.kind === 'smoke') {
          g.beginPath(); g.arc(p.x, -p.y, s * (1 + p.age * 2.5), 0, Math.PI * 2); g.fill();
        } else if (p.kind === 'confetti' || p.kind === 'feather') {
          g.save();
          g.translate(p.x, -p.y);
          g.rotate(p.rot);
          if (p.kind === 'feather') { g.beginPath(); g.ellipse(0, 0, s, s * 0.35, 0, 0, Math.PI * 2); g.fill(); }
          else g.fillRect(-s / 2, -s / 4, s, s / 2);
          g.restore();
        } else if (p.kind === 'spark') {
          g.strokeStyle = p.color;
          g.lineWidth = s * 0.4;
          g.beginPath(); g.moveTo(p.x, -p.y); g.lineTo(p.x - p.vx * 0.04, -p.y + p.vy * 0.04); g.stroke();
        } else {
          g.beginPath(); g.arc(p.x, -p.y, s, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalAlpha = 1;
      for (const r of rings) {
        const k = r.age / r.life;
        g.strokeStyle = `rgba(${r.color},${1 - k})`;
        g.lineWidth = (10 * (1 - k) + 2) / z;
        g.beginPath(); g.arc(r.x, -r.y, (r.max * k) / z, 0, Math.PI * 2); g.stroke();
      }
    },
    // Screen space; toScreen(x, y) -> [sx, sy].
    drawTexts(g, toScreen) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const t of texts) {
        const k = t.age / t.life;
        const [sx, sy] = toScreen(t.x, t.y);
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        g.font = `900 ${Math.round(t.size * pop)}px Bangers, Impact, system-ui, sans-serif`;
        g.lineWidth = Math.max(3, t.size * 0.18);
        g.strokeStyle = 'rgba(58,34,48,0.9)';
        g.strokeText(t.str, sx, sy - k * t.rise);
        g.fillStyle = t.color;
        g.fillText(t.str, sx, sy - k * t.rise);
      }
      g.globalAlpha = 1;
    },
    drawFlash(g, W, H) {
      if (flash <= 0.01) return;
      g.fillStyle = `rgba(${flashColor},${flash})`;
      g.fillRect(0, 0, W, H);
    },
  };
}
