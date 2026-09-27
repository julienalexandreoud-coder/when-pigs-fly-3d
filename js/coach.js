// First-flight coaching: the action drops into slow motion with one big
// instruction until the player actually does it, so nobody has to have the
// controls explained. Also computes the "TAP!" landing cue shown every flight.

import { PIG_R } from './config.js';
import { FLARE_WINDOW } from './physics.js';

const SLOW = 0.1;
const HOLD_AT = 1.6;
const KEEP_HOLDING = 1.0;
const PRAISE = 1.3;
const GIVE_UP = 9;
const FLARE_TTI = 0.3;
const CUE_TTI = 1.0;
const MIN_FLARE_SPEED = 7;
const MIN_HOP_SPEED = 8;

// Seconds until the pig touches the ground at its current fall speed.
export function timeToImpact(f, groundAt) {
  if (f.grounded || f.abduct || f.done || f.vy >= -1) return Infinity;
  return Math.max(0, f.y - PIG_R - groundAt(f.x)) / -f.vy;
}

// Landing cue for the renderer: k grows 0..1 as the ground gets close;
// `now` means a tap right now will bounce.
export function landingCue(f, groundAt) {
  if (!f || f.done || f.abduct) return null;
  if (f.grounded) return Math.abs(f.vx) >= MIN_HOP_SPEED ? { k: 1, now: true, hop: true } : null;
  if (Math.hypot(f.vx, f.vy) < MIN_FLARE_SPEED) return null;
  const tti = timeToImpact(f, groundAt);
  if (tti > CUE_TTI) return null;
  return { k: 1 - tti / CUE_TTI, now: tti <= FLARE_WINDOW, hop: false };
}

export function createCoach(ui) {
  const need = { hold: false, flare: false };
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
      need.hold = !tips.includes('hold');
      need.flare = !tips.includes('flare');
      touch = isTouch;
      stop();
    },
    stop,
    get active() { return step !== null; },
    // Returns the time scale for this frame and the tips finished this frame.
    update(f, inp, holding, realDt, groundAt) {
      const done = [];
      if (f.done) {
        if (step) stop();
        return { scale: 1, done };
      }
      t += realDt;
      const flareDue = need.flare && timeToImpact(f, groundAt) < FLARE_TTI && Math.hypot(f.vx, f.vy) >= MIN_FLARE_SPEED;
      if (step === 'praise' && flareDue) {
        // The ground came first: the hold lesson counts as learned.
        need.hold = false;
        done.push('hold');
        step = null;
      }
      if (step === null) {
        if (need.hold && f.t > HOLD_AT && !f.grounded && !f.abduct && f.vy < 8) {
          step = 'hold';
          t = 0;
          show('HOLD TO FLY UP', touch ? 'keep your finger on the screen' : 'hold the mouse button or SPACE');
        } else if (flareDue && !need.hold) {
          step = 'flare';
          t = 0;
          show('TAP NOW!', 'tap right before you land = BOUNCE');
        }
      }
      switch (step) {
        case 'hold':
          if (holding) {
            step = 'holding';
            t = 0;
            show('NICE! NOSE UP = CLIMB', 'keep holding…');
          } else if (t > GIVE_UP) stop();
          return { scale: step === 'hold' ? SLOW : 1, done };
        case 'holding':
          if (!holding || t > KEEP_HOLDING) {
            step = holding ? 'letgo' : 'praise';
            t = 0;
            if (holding) show('NOW LET GO', 'let go = dive and build speed', { release: true });
            else show('THAT’S IT!', 'hold = up · let go = down', { release: true });
          }
          return { scale: 1, done };
        case 'letgo':
          if (!holding || t > GIVE_UP / 2) {
            step = 'praise';
            t = 0;
            show('THAT’S IT!', 'hold = up · let go = down', { release: true });
          }
          return { scale: holding ? 0.35 : 1, done };
        case 'praise':
          if (t > PRAISE) {
            need.hold = false;
            done.push('hold');
            stop();
          }
          return { scale: 1, done };
        case 'flare':
          if (inp.pressed || f.grounded) {
            if (inp.pressed) {
              need.flare = false;
              done.push('flare');
            }
            stop();
            return { scale: 1, done };
          }
          return { scale: t > GIVE_UP ? 1 : SLOW * 0.6, done };
        default:
          return { scale: 1, done };
      }
    },
  };
}
