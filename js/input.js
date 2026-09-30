// One-touch controls.
// HOLD anywhere (mouse, finger, ↑, W) = nose up; let go = glide down.
// A fresh press also arms the "flare" bounce when the pig is about to land.
// Keyboard: ↑ / W / ← / A = nose up, ↓ / S / → / D = dive.
// BOOST: the on-screen rocket button, SPACE, SHIFT, X or J. Before the rocket
// is bought SPACE flies up instead, so it always does something.
// SPACE and Enter still launch from the launch screen.
// Esc / P pause.

const UP = new Set(['Enter', 'ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA']);
const DOWN = new Set(['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD']);
const BOOST = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ']);
export const LAUNCH_KEYS = new Set([...UP, ...DOWN, 'Space']);
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown']);

export function createInput(canvas, { onAction, onPause, isTyping }) {
  const keys = new Set();
  const pointers = new Set();
  let boostHeld = false;
  let hasRocket = false;
  // Phones/tablets start in touch mode (the first touch may land on a button,
  // not the canvas); after that the last thing used decides: finger = touch,
  // mouse or keyboard = PC.
  let usedTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let pressed = false;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') usedTouch = true;
    else if (e.pointerType === 'mouse') usedTouch = false;
  }, { capture: true, passive: true });
  let pitched = false;
  let boosted = false;

  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      onPause();
      return;
    }
    usedTouch = false;
    if (e.repeat) {
      // A key still held after launch cleared the input keeps working.
      keys.add(e.code);
      return;
    }
    keys.add(e.code);
    if (UP.has(e.code) || (e.code === 'Space' && !hasRocket)) pressed = true;
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
    setRocket(v) { hasRocket = v; },
    get usedTouch() { return usedTouch; },
    get holding() {
      if (pointers.size) return true;
      for (const k of keys) if (UP.has(k) || (k === 'Space' && !hasRocket)) return true;
      return false;
    },
    // { pitch: -1 | 0 | 1, boost, pressed }. Positive pitch = nose up.
    // `pressed` is true once per new press (consumed by this call).
    read() {
      let up = pointers.size > 0;
      let down = false;
      let boost = boostHeld;
      for (const k of keys) {
        if (UP.has(k) || (k === 'Space' && !hasRocket)) up = true;
        else if (BOOST.has(k)) boost = true;
        if (DOWN.has(k)) down = true;
      }
      const pitch = up === down ? 0 : up ? 1 : -1;
      if (pitch) pitched = true;
      if (boost) boosted = true;
      const p = pressed;
      pressed = false;
      return { pitch, boost, pressed: p, flap: up && !down };
    },
    get pitched() { return pitched; },
    get boosted() { return boosted; },
    resetFlags() { pitched = false; boosted = false; },
    clear() { keys.clear(); pointers.clear(); boostHeld = false; pressed = false; },
  };
}
