// All sound is synthesized with WebAudio: no audio files are shipped.

const noteHz = (semis) => 261.63 * 2 ** (semis / 12);
const MAJOR_PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuf = null;
  let userMuted = false;
  let adMuted = false;
  let musicTimer = null;
  let nextBeat = 0;
  let beat = 0;
  let spaceMix = 0;
  let wind = null;
  let rocket = null;

  const applyGain = () => {
    if (!master) return;
    master.gain.setTargetAtTime(userMuted || adMuted ? 0 : 0.85, ctx.currentTime, 0.05);
  };

  function loopNoise(filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(sfxBus);
    src.start();
    return { filter, gain };
  }

  function unlock() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.13;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      wind = loopNoise('bandpass', 500, 0.8);
      rocket = loopNoise('lowpass', 700, 0.7);
      applyGain();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone({ freq, type = 'sine', dur = 0.2, vol = 0.3, slide = 0, delay = 0, bus = sfxBus, attack = 0.01 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.3, freq = 800, q = 1, type = 'bandpass', delay = 0, sweep = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // Bouncy farm tune that fades into a spacey arpeggio with altitude.
  function scheduleMusic() {
    if (!ctx) return;
    const spb = 60 / 116 / 2;
    if (nextBeat < ctx.currentTime - 0.2) nextBeat = ctx.currentTime + 0.05;
    while (nextBeat < ctx.currentTime + 0.3) {
      const d = nextBeat - ctx.currentTime;
      const bar = Math.floor(beat / 8) % 4;
      const root = [0, 5, 7, 5][bar];
      const farm = 1 - spaceMix;
      if (farm > 0.05) {
        if (beat % 4 === 0) tone({ freq: noteHz(root - 24), type: 'triangle', dur: 0.28, vol: 0.5 * farm, bus: musicBus, delay: d });
        if (beat % 4 === 2) tone({ freq: noteHz(root - 12 + 7), type: 'triangle', dur: 0.18, vol: 0.28 * farm, bus: musicBus, delay: d });
        const melody = [0, 2, 4, 2, 7, 4, 2, 4];
        if (beat % 2 === 0 || Math.random() < 0.2) {
          tone({ freq: noteHz(root + MAJOR_PENTA[(melody[beat % 8] + bar) % MAJOR_PENTA.length]), type: 'square', dur: 0.14, vol: 0.12 * farm, bus: musicBus, delay: d });
        }
      }
      if (spaceMix > 0.05) {
        if (beat % 16 === 0) tone({ freq: noteHz(root - 12), type: 'sine', dur: 3.2, vol: 0.4 * spaceMix, bus: musicBus, delay: d, attack: 0.8 });
        tone({ freq: noteHz(root + 12 + [0, 7, 12, 16][beat % 4]), type: 'sine', dur: 0.5, vol: 0.12 * spaceMix, bus: musicBus, delay: d });
      }
      nextBeat += spb;
      beat += 1;
    }
  }

  const at = (node, value, tc = 0.08) => node && ctx && node.setTargetAtTime(value, ctx.currentTime, tc);

  return {
    unlock,
    setMuted(m) { userMuted = m; applyGain(); },
    setAdMuted(m) { adMuted = m; applyGain(); },
    get muted() { return userMuted; },
    startMusic() {
      if (!ctx || musicTimer) return;
      nextBeat = ctx.currentTime + 0.1;
      musicTimer = setInterval(scheduleMusic, 100);
    },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; },
    setAltitude(alt) { spaceMix = Math.max(0, Math.min(1, (alt - 3500) / 3000)); },
    // Continuous layers, updated every frame.
    flight({ speed, boosting, rocketTier, active }) {
      if (!ctx) return;
      const s = active ? Math.min(1, speed / 250) : 0;
      at(wind && wind.gain.gain, active ? 0.04 + s * 0.22 : 0);
      at(wind && wind.filter.frequency, 300 + s * 1400);
      at(rocket && rocket.gain.gain, boosting ? 0.32 : 0, 0.04);
      at(rocket && rocket.filter.frequency, 400 + rocketTier * 180);
    },
    silence() {
      if (!ctx) return;
      at(wind.gain.gain, 0);
      at(rocket.gain.gain, 0, 0.03);
    },
    launch: (big) => {
      if (big) { noise({ dur: 0.6, vol: 0.7, freq: 200, type: 'lowpass', sweep: 0.3 }); tone({ freq: 90, type: 'sawtooth', dur: 0.4, vol: 0.2, slide: 0.4 }); }
      else { tone({ freq: 180, type: 'triangle', dur: 0.35, vol: 0.35, slide: 3 }); noise({ dur: 0.25, vol: 0.2, freq: 1500, sweep: 0.4 }); }
    },
    perfect: () => [0, 4, 7, 12].forEach((s, i) => tone({ freq: noteHz(s + 12), type: 'square', dur: 0.14, vol: 0.12, delay: i * 0.05 })),
    coin: (streak) => {
      const f = noteHz(19 + MAJOR_PENTA[Math.min(streak, MAJOR_PENTA.length - 1)]);
      tone({ freq: f, type: 'square', dur: 0.08, vol: 0.08 });
      tone({ freq: f * 1.5, type: 'sine', dur: 0.14, vol: 0.12, delay: 0.04 });
    },
    star: () => [0, 7, 12, 19].forEach((s, i) => tone({ freq: noteHz(s + 19), type: 'sine', dur: 0.2, vol: 0.14, delay: i * 0.04 })),
    pop: (chain) => { noise({ dur: 0.08, vol: 0.5, freq: 2500, q: 0.8 }); tone({ freq: noteHz(7 + Math.min(chain, 6) * 2), type: 'triangle', dur: 0.2, vol: 0.2, slide: 2 }); },
    honk: () => { tone({ freq: 330, type: 'sawtooth', dur: 0.16, vol: 0.14, slide: 0.8 }); tone({ freq: 300, type: 'sawtooth', dur: 0.18, vol: 0.12, slide: 0.75, delay: 0.14 }); },
    zap: () => { noise({ dur: 0.35, vol: 0.5, freq: 3000, q: 3, sweep: 0.2 }); tone({ freq: 880, type: 'square', dur: 0.3, vol: 0.1, slide: 0.2 }); },
    bonk: () => { noise({ dur: 0.25, vol: 0.45, freq: 160, type: 'lowpass' }); tone({ freq: 120, type: 'triangle', dur: 0.25, vol: 0.3, slide: 0.5 }); },
    boing: () => tone({ freq: 160, type: 'sine', dur: 0.45, vol: 0.4, slide: 3.5 }),
    surf: () => { tone({ freq: 400, type: 'triangle', dur: 0.3, vol: 0.2, slide: 2 }); noise({ dur: 0.4, vol: 0.25, freq: 1200, sweep: 2 }); },
    flip: () => tone({ freq: noteHz(24), type: 'triangle', dur: 0.25, vol: 0.2, slide: 1.5 }),
    fuel: () => { tone({ freq: 300, type: 'sine', dur: 0.2, vol: 0.25, slide: 2.2 }); tone({ freq: 600, type: 'sine', dur: 0.2, vol: 0.15, slide: 1.5, delay: 0.08 }); },
    wind: () => noise({ dur: 0.8, vol: 0.25, freq: 600, q: 0.6, sweep: 2.5 }),
    skid: () => noise({ dur: 0.18, vol: 0.18, freq: 500, q: 1.5 }),
    thud: (hard) => { noise({ dur: 0.3, vol: hard ? 0.55 : 0.35, freq: 120, type: 'lowpass' }); tone({ freq: 90, type: 'sine', dur: 0.25, vol: 0.4, slide: 0.5 }); },
    splat: () => { noise({ dur: 0.45, vol: 0.5, freq: 400, q: 0.6, sweep: 0.3 }); tone({ freq: 200, type: 'sawtooth', dur: 0.3, vol: 0.12, slide: 0.3 }); },
    splash: () => { noise({ dur: 0.7, vol: 0.5, freq: 1800, q: 0.5, sweep: 0.3 }); noise({ dur: 0.4, vol: 0.3, freq: 400, type: 'lowpass', delay: 0.05 }); },
    skip: () => noise({ dur: 0.18, vol: 0.3, freq: 2200, q: 1, sweep: 0.5 }),
    empty: () => [0, 1].forEach((i) => noise({ dur: 0.08, vol: 0.25, freq: 300, type: 'lowpass', delay: i * 0.1 })),
    sonic: () => { noise({ dur: 0.9, vol: 0.8, freq: 90, type: 'lowpass', sweep: 0.5 }); tone({ freq: 60, type: 'sine', dur: 0.8, vol: 0.5, slide: 0.5 }); },
    ufo: () => { for (let i = 0; i < 6; i++) tone({ freq: 500 + (i % 2) * 300, type: 'sine', dur: 0.25, vol: 0.12, slide: i % 2 ? 0.6 : 1.6, delay: i * 0.22 }); },
    layer: () => [0, 7, 12].forEach((s, i) => tone({ freq: noteHz(s + 7), type: 'triangle', dur: 0.4, vol: 0.14, delay: i * 0.09 })),
    record: () => [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone({ freq: noteHz(s + 12), type: i % 2 ? 'triangle' : 'square', dur: 0.2, vol: 0.1, delay: i * 0.06 })),
    mission: () => [0, 4, 7, 12, 16].forEach((s, i) => tone({ freq: noteHz(s + 12), type: 'triangle', dur: 0.3, vol: 0.16, delay: i * 0.07 })),
    medal: () => [0, 4, 7, 11, 12, 16, 19].forEach((s, i) => tone({ freq: noteHz(s + 12), type: 'triangle', dur: 0.55, vol: 0.15, delay: i * 0.1 })),
    moon: () => [0, 4, 7, 12, 16, 19, 24, 19, 24, 28].forEach((s, i) => tone({ freq: noteHz(s + 7), type: i % 3 ? 'triangle' : 'square', dur: 0.5, vol: 0.14, delay: i * 0.13 })),
    buy: () => [0, 7, 12].forEach((s, i) => tone({ freq: noteHz(s + 7), type: 'triangle', dur: 0.3, vol: 0.2, delay: i * 0.07 })),
    click: () => tone({ freq: 880, type: 'square', dur: 0.04, vol: 0.05 }),
    deny: () => tone({ freq: 200, type: 'square', dur: 0.12, vol: 0.08, slide: 0.8 }),
    tick: (i) => tone({ freq: 700 + (i % 12) * 40, type: 'sine', dur: 0.04, vol: 0.05 }),
  };
}
