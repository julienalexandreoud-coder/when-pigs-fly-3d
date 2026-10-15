// One-button controls, like every "to the Moon" launcher:
// HOLD anything (mouse, finger, SPACE, ↑, W or any other key) = fly up:
// the rocket fires while it has fuel, then Pip flaps his wings.
// Let go = glide. ↓ / S still dive for players who look for it.
// Esc / P pause. SPACE and Enter also launch from the launch screen.

const DOWN = new Set(['ArrowDown', 'KeyS']);
// Keys that never count as "hold": modifiers, pause and browser shortcuts.
const IGNORE = new Set(['Escape', 'KeyP', 'Tab', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'F5', 'F11', 'F12']);
const isHoldKey = (code) => !DOWN.has(code) && !IGNORE.has(code);
export const LAUNCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'KeyW']);
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown']);

export function createInput(canvas, { onAction, onPause, isTyping }) {
  const keys = new Set();
  const pointers = new Set();
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
    if (isHoldKey(e.code)) pressed = true;
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
    pointers.add(e.pointerId);
    pressed = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    onAction('pointer', e.pointerType);
  });
  const release = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const holdingNow = () => {
    if (pointers.size) return true;
    for (const k of keys) if (isHoldKey(k)) return true;
    return false;
  };

  return {
    get usedTouch() { return usedTouch; },
    get holding() { return holdingNow(); },
    // { pitch: -1 | 0 | 1, boost, flap, pressed }. Positive pitch = nose up.
    // Holding drives everything at once: nose up, rocket, flapping.
    // `pressed` is true once per new press (consumed by this call).
    read() {
      const up = holdingNow();
      let down = false;
      for (const k of keys) if (DOWN.has(k)) down = true;
      const pitch = up === down ? 0 : up ? 1 : -1;
      if (pitch) pitched = true;
      if (up) boosted = true;
      const p = pressed;
      pressed = false;
      return { pitch, boost: up && !down, pressed: p, flap: up && !down };
    },
    get pitched() { return pitched; },
    get boosted() { return boosted; },
    resetFlags() { pitched = false; boosted = false; },
    clear() { keys.clear(); pointers.clear(); pressed = false; },
  };
}
