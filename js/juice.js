// Turns simulation events into sound, particles, floating text and banners.

import { LAYERS, scaleAt } from './config.js';
import { TRICKS } from './economy.js';

const HIT_TEXT = { goose: 'HONK!', thunder: 'ZAP!', satellite: 'CLANG!', asteroid: 'BONK!', plane: 'BONK!' };

export function createJuice({ fx, audio, ui }) {
  let streak = 0;
  let lastCoinT = -9;

  return {
    reset() {
      streak = 0;
      lastCoinT = -9;
    },
    // Returns flags main cares about (squash, trampoline bounce).
    handle(e, f, s) {
      const k = scaleAt(f.y);
      switch (e.type) {
        case 'coin': {
          streak = f.t - lastCoinT < 0.7 ? streak + 1 : 0;
          lastCoinT = f.t;
          if (e.star) audio.star(); else audio.coin(streak);
          fx.burst(e.x, e.y, e.star ? 14 : 5, { colors: ['#ffe45c', '#fff3b0', '#ffb703'], speed: 7, life: 0.45, size: 4, gravity: 0, scale: k });
          if (e.value >= 5 || streak >= 4) fx.text(e.x, e.y, `+${e.value}`, { color: '#ffe45c', size: e.value >= 25 ? 30 : 22 });
          break;
        }
        case 'fuel':
          audio.fuel();
          fx.burst(e.x, e.y, 10, { colors: ['#ffb703', '#fb5607'], speed: 8, life: 0.5, size: 5, gravity: 0, scale: k });
          fx.text(e.x, e.y, '+FUEL', { color: '#ffb703' });
          break;
        case 'pop':
          audio.pop(e.chain);
          fx.burst(e.x, e.y, 16, { colors: [e.color, '#ffffff'], speed: 12, life: 0.6, size: 6, kind: 'confetti', gravity: 6, scale: k });
          if (e.chain >= 3) fx.text(e.x, e.y, `CHAIN x${e.chain}!`, { color: '#ff7aa2', size: 28 });
          else fx.text(e.x, e.y, `+${TRICKS.balloon}`, { color: '#ffffff', size: 20 });
          return { squash: 0.25 };
        case 'hit':
          if (e.kind === 'goose') audio.honk();
          else if (e.kind === 'thunder') { audio.zap(); fx.flash('255,250,200', 0.5); }
          audio.bonk();
          fx.shake(9);
          fx.burst(e.x, e.y, 14, {
            colors: e.kind === 'goose' ? ['#ffffff', '#dee2e6'] : e.kind === 'thunder' ? ['#fff3b0', '#ffe45c'] : ['#adb5bd', '#ffd166'],
            speed: 10, life: 0.8, size: 6, kind: e.kind === 'goose' ? 'feather' : 'spark', gravity: 4, scale: k,
          });
          fx.text(e.x, e.y, HIT_TEXT[e.kind] || 'OUCH!', { color: '#ff6b6b', size: 26 });
          return { squash: -0.2 };
        case 'wind':
          audio.wind();
          fx.text(e.x, e.y, e.kind === 'updraft' ? 'UPDRAFT!' : 'JET STREAM!', { color: '#bde0fe', size: 22 });
          break;
        case 'surf':
          audio.surf();
          fx.shake(4);
          fx.text(e.x, e.y, `PLANE SURF! +${TRICKS.surf}`, { color: '#80ed99', size: 28 });
          return { squash: 0.3 };
        case 'abduct':
          audio.ufo();
          ui.banner('ABDUCTED 👽', 'ufo said mine', 1800);
          break;
        case 'dropped':
          fx.text(e.x, e.y, `+${TRICKS.abduct}`, { color: '#80ed99', size: 28 });
          break;
        case 'flip':
          audio.flip();
          fx.text(e.x, e.y, e.n > 1 ? `FLIP x${e.n}! +${TRICKS.flip}` : `FLIP! +${TRICKS.flip}`, { color: '#ffd23f', size: 26 });
          break;
        case 'bounce':
        case 'skip':
          audio.skip();
          fx.burst(e.x, e.y, 10, { colors: e.type === 'skip' ? ['#9bf6ff', '#ffffff'] : ['#8ac926', '#b08968'], speed: 6, life: 0.5, size: 5, gravity: 8 });
          if (e.type === 'skip') fx.text(e.x, e.y, 'SKIP!', { color: '#9bf6ff', size: 20 });
          return { squash: 0.3 };
        case 'hay':
          audio.boing();
          fx.burst(e.x, e.y, 14, { colors: ['#f2c14e', '#d4a017'], speed: 8, life: 0.7, size: 5, kind: 'feather', gravity: 6 });
          return { squash: 0.35 };
        case 'boing':
          audio.boing();
          fx.text(e.x, e.y, 'BOING!', { color: '#ffffff', size: 24 });
          return { squash: 0.4, trampoline: true };
        case 'thud':
          audio.thud(e.speed > 12);
          fx.shake(Math.min(12, 3 + e.speed * 0.4));
          fx.burst(e.x, e.y, 16, { colors: ['#b08968', '#8ac926', '#7f5539'], speed: 7, life: 0.7, size: 6, gravity: 9 });
          return { squash: -0.3 };
        case 'mud':
          audio.splat();
          fx.shake(6);
          fx.burst(e.x, e.y, 22, { colors: ['#6b4226', '#7f5539'], speed: 9, life: 0.9, size: 7, gravity: 12 });
          fx.text(e.x, e.y + 2, 'SPLAT', { color: '#b08968', size: 38 });
          return { squash: -0.4 };
        case 'splash':
          audio.splash();
          fx.burst(e.x, e.y, 30, { colors: ['#4cc9f0', '#caf0f8', '#ffffff'], speed: 12, life: 0.9, size: 6, gravity: 14, spread: 1.6, dir: Math.PI / 2 });
          fx.text(e.x, e.y + 2, 'SPLASH!', { color: '#caf0f8', size: 34 });
          break;
        case 'empty':
          audio.empty();
          break;
        case 'sonic':
          audio.sonic();
          fx.ring(e.x, e.y, '255,255,255', 520);
          fx.shake(10);
          ui.banner('SONIC BOOM!', `${Math.round(343 * 3.6).toLocaleString('en-US')} KM/H`, 1500);
          break;
        case 'layer':
          audio.layer();
          ui.banner(LAYERS[e.index].name.toUpperCase(), 'now entering', 1600);
          break;
        case 'rebound':
          audio.boing();
          fx.text(e.x, e.y, 'SECOND WIND!', { color: '#c77dff', size: 30 });
          return { squash: 0.4 };
        default:
          break;
      }
      void s;
      return null;
    },
  };
}
