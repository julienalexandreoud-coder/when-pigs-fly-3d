// First-flight coaching: the action drops into slow motion with one big
// instruction until the player actually does it, so nobody has to have the
// controls explained. There is only one control to learn: hold to fly up,
// let go to glide.

const SLOW = 0.1;
const HOLD_AT = 1.6;
const KEEP_HOLDING = 1.6;
const PRAISE = 1.3;
const GIVE_UP = 6;

export function createCoach(ui) {
  let needHold = false;
  let step = null;
  let t = 0;
  let touch = false;

  function show(title, sub, opts) { ui.coach(title, sub, opts); }
  function stop() {
    step = null;
    ui.coach(null);
  }

  return {
    start(tips, isTouch) {
      needHold = !tips.includes('hold');
      touch = isTouch;
      stop();
    },
    stop,
    get active() { return step !== null; },
    // Returns the time scale for this frame and the tips finished this frame.
    update(f, inp, holding, realDt) {
      const done = [];
      if (f.done) {
        if (step) stop();
        return { scale: 1, done };
      }
      t += realDt;
      if (step === null && needHold && f.t > HOLD_AT && !f.grounded && !f.abduct && f.vy < 8) {
        step = 'hold';
        t = 0;
        show('HOLD TO FLY UP', touch ? 'keep your finger on the screen' : 'hold the mouse button or any key');
      }
      switch (step) {
        case 'hold':
          if (holding) {
            step = 'holding';
            t = 0;
            show('YOU’RE FLYING!', 'keep holding to climb');
          } else if (t > GIVE_UP) {
            // Not this flight: let it play at full speed (the lesson returns
            // next flight because the tip is not marked as learned).
            needHold = false;
            stop();
          }
          return { scale: step === 'hold' ? SLOW : 1, done };
        case 'holding':
          if (!holding || t > KEEP_HOLDING) {
            step = holding ? 'letgo' : 'praise';
            t = 0;
            if (holding) show('NOW LET GO', 'let go = glide', { release: true });
            else show('THAT’S IT!', 'hold = fly up · let go = glide', { release: true });
          }
          return { scale: 1, done };
        case 'letgo':
          if (!holding || t > GIVE_UP / 2) {
            step = 'praise';
            t = 0;
            show('THAT’S IT!', 'hold = fly up · let go = glide', { release: true });
          }
          return { scale: holding ? 0.35 : 1, done };
        case 'praise':
          if (t > PRAISE) {
            needHold = false;
            done.push('hold');
            stop();
          }
          return { scale: 1, done };
        default:
          return { scale: 1, done };
      }
    },
  };
}
