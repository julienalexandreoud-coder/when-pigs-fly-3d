// Keyboard + pointer controls.
// Keys: ↑/W/← nose up, ↓/S/→ nose down, Space boost (and launch), Esc/P pause.
// Touch/mouse: with a rocket the left 55% pitches (top half up, bottom half down)
// and the right side boosts; without a rocket the whole screen pitches.

const UP = new Set(['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA']);
const DOWN = new Set(['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD']);
const BOOST = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ']);
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown']);

export function createInput(canvas, { onAction, onPause, isTyping }) {
  const keys = new Set();
  const pointers = new Map();
  let hasRocket = false;
  let usedTouch = false;
  let pitched = false;
  let boosted = false;

  function zoneOf(x, y) {
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (hasRocket && x > w * 0.55) return 'boost';
    return y < h / 2 ? 'up' : 'down';
  }

  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      onPause();
      return;
    }
    if (e.repeat) return;
    keys.add(e.code);
    onAction('key', e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointers.clear();
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'touch') usedTouch = true;
    pointers.set(e.pointerId, zoneOf(e.clientX, e.clientY));
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    onAction('pointer', e.pointerType);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, zoneOf(e.clientX, e.clientY));
  });
  const release = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    setRocket(v) { hasRocket = v; },
    get usedTouch() { return usedTouch; },
    // { pitch: -1 | 0 | 1, boost: bool }. Positive pitch = nose up.
    read() {
      let up = false;
      let down = false;
      let boost = false;
      for (const k of keys) {
        if (UP.has(k)) up = true;
        if (DOWN.has(k)) down = true;
        if (BOOST.has(k)) boost = true;
      }
      for (const z of pointers.values()) {
        if (z === 'up') up = true;
        else if (z === 'down') down = true;
        else boost = true;
      }
      const pitch = up === down ? 0 : up ? 1 : -1;
      if (pitch) pitched = true;
      if (boost) boosted = true;
      return { pitch, boost };
    },
    get pitched() { return pitched; },
    get boosted() { return boosted; },
    resetFlags() { pitched = false; boosted = false; },
    clear() { keys.clear(); pointers.clear(); },
  };
}
