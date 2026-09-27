// One-touch controls.
// HOLD anywhere (mouse, finger, SPACE, ↑, W) = nose up; let go = glide down.
// A fresh press also arms the "flare" bounce when the pig is about to land.
// BOOST: the on-screen rocket button, SHIFT, → or D. Dive: ↓ / S (optional).
// Esc / P pause.

const UP = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const BOOST = new Set(['ShiftLeft', 'ShiftRight', 'ArrowRight', 'KeyD', 'KeyX', 'KeyJ']);
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown']);

export function createInput(canvas, { onAction, onPause, isTyping }) {
  const keys = new Set();
  const pointers = new Set();
  let boostHeld = false;
  let usedTouch = false;
  let pressed = false;
  let pitched = false;
  let boosted = false;

  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      onPause();
      return;
    }
    if (e.repeat) return;
    keys.add(e.code);
    if (UP.has(e.code)) pressed = true;
    onAction('key', e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointers.clear();
    boostHeld = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'touch') usedTouch = true;
    pointers.add(e.pointerId);
    pressed = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    onAction('pointer', e.pointerType);
  });
  const release = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // The boost button is a real element so it never counts as "hold to fly up".
  function bindBoost(button) {
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.pointerType === 'touch') usedTouch = true;
      boostHeld = true;
      button.classList.add('on');
      try { button.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    };
    const up = () => {
      boostHeld = false;
      button.classList.remove('on');
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return {
    bindBoost,
    get usedTouch() { return usedTouch; },
    get holding() {
      if (pointers.size) return true;
      for (const k of keys) if (UP.has(k)) return true;
      return false;
    },
    // { pitch: -1 | 0 | 1, boost, pressed }. Positive pitch = nose up.
    // `pressed` is true once per new press (consumed by this call).
    read() {
      let up = pointers.size > 0;
      let down = false;
      let boost = boostHeld;
      for (const k of keys) {
        if (UP.has(k)) up = true;
        if (DOWN.has(k)) down = true;
        if (BOOST.has(k)) boost = true;
      }
      const pitch = up === down ? 0 : up ? 1 : -1;
      if (pitch) pitched = true;
      if (boost) boosted = true;
      const p = pressed;
      pressed = false;
      return { pitch, boost, pressed: p };
    },
    get pitched() { return pitched; },
    get boosted() { return boosted; },
    resetFlags() { pitched = false; boosted = false; },
    clear() { keys.clear(); pointers.clear(); boostHeld = false; pressed = false; },
  };
}
