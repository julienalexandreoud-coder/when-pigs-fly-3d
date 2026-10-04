// Thin, failure-tolerant wrapper around the web-portal SDKs. One build per
// portal: tools/pack.mjs sets window.WPF_PLATFORM (and the portal's game id)
// and swaps in that portal's SDK <script>. Every call is guarded so the game
// keeps working if the SDK is blocked or missing.
//
//   crazygames        CrazyGames HTML5 SDK v3 (window.CrazyGames.SDK)
//   gamedistribution  GameDistribution SDK (window.gdsdk, GD_OPTIONS)
//   gamemonetize      GameMonetize SDK (window.sdk, SDK_OPTIONS), interstitials only
//   poki              Poki SDK v2 (window.PokiSDK)
//   none              no ads (itch.io, own site)

let adapter = null;
let playing = false;
let lastMidgame = 0;
const MIDGAME_GAP_MS = 180_000;
const INIT_TIMEOUT_MS = 6000;
const MIDGAME_MIN_FLIGHTS = 3;

export const PLATFORM = (typeof window !== 'undefined' && window.WPF_PLATFORM) || 'crazygames';

const safe = (label, fn) => {
  try {
    return fn();
  } catch (err) {
    console.warn(`[sdk] ${label} failed`, err);
    return undefined;
  }
};

// Never let a stuck SDK keep the game on the loading screen.
const withTimeout = (promise, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), INIT_TIMEOUT_MS)),
]);

// Waits for a global that an async <script> defines; null after the timeout.
function waitFor(get) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      const v = safe('waitFor', get);
      if (v) resolve(v);
      else if (Date.now() - t0 > INIT_TIMEOUT_MS) resolve(null);
      else setTimeout(poll, 50);
    }());
  });
}

// ---------- CrazyGames ----------
async function crazyGames() {
  const api = window.CrazyGames && window.CrazyGames.SDK;
  if (!api) return null;
  await withTimeout(api.init(), 'CrazyGames init');
  return {
    // CrazyGames Basic Launch does not allow ads; flip once in Full Launch.
    ads: false,
    rewarded: true,
    loadingStart: () => api.game.loadingStart(),
    loadingStop: () => api.game.loadingStop(),
    gameplayStart: () => api.game.gameplayStart(),
    gameplayStop: () => api.game.gameplayStop(),
    happytime: () => api.game.happytime(),
    async username() {
      if (!api.user || !api.user.isUserAccountAvailable) return null;
      const user = await api.user.getUser();
      return user && user.username;
    },
    storage: api.data && typeof api.data.getItem === 'function' ? api.data : null,
    onSettings(listener) {
      if (api.game.settings) listener(api.game.settings);
      if (typeof api.game.addSettingsChangeListener === 'function') api.game.addSettingsChangeListener(listener);
    },
    requestAd(type, { onStart, onEnd }) {
      return new Promise((resolve) => {
        let started = false;
        const finish = (granted) => { if (started) onEnd(); resolve(granted); };
        api.ad.requestAd(type, {
          adStarted: () => { started = true; onStart(); },
          adFinished: () => finish(true),
          adError: (err) => { console.warn(`[sdk] ${type} ad error`, err); finish(false); },
        });
      });
    },
  };
}

// ---------- GameDistribution / GameMonetize ----------
// Both use an event-callback SDK. GD_OPTIONS / SDK_OPTIONS must exist before
// their script loads, so the build declares them in index.html and forwards
// every event to window.WPF_SDK_EVENT, which is hooked here.
// Ads the portal shows on its own (GD's pre-roll) still pause and mute the game.
let inAd = false;
let portalAd = null;
function eventBus() {
  const listeners = new Set();
  window.WPF_SDK_EVENT = (event) => {
    for (const l of listeners) safe('sdk event', () => l(event));
    if (inAd || !portalAd) return;
    if (event.name === 'SDK_GAME_PAUSE') safe('portal ad start', portalAd.onStart);
    if (event.name === 'SDK_GAME_START') safe('portal ad end', portalAd.onEnd);
  };
  return (l) => { listeners.add(l); return () => listeners.delete(l); };
}

async function gameDistribution() {
  const on = eventBus();
  const api = await waitFor(() => window.gdsdk && typeof window.gdsdk.showAd === 'function' && window.gdsdk);
  if (!api) return null;
  return {
    ads: true,
    rewarded: true,
    requestAd(type, { onStart, onEnd }) {
      return new Promise((resolve) => {
        let started = false;
        let watched = false;
        const off = on((e) => {
          if (e.name === 'SDK_GAME_PAUSE' && !started) { started = true; onStart(); }
          if (e.name === 'SDK_REWARDED_WATCH_COMPLETE') watched = true;
        });
        const finish = (ok) => {
          off();
          if (started) onEnd();
          // Rewards only after SDK_REWARDED_WATCH_COMPLETE, never on a rejection.
          resolve(type === 'rewarded' ? ok && watched : ok);
        };
        const show = type === 'rewarded'
          ? api.preloadAd('rewarded').then(() => api.showAd('rewarded'))
          : api.showAd();
        Promise.resolve(show).then(() => finish(true), (err) => {
          console.warn(`[sdk] ${type} ad error`, err);
          finish(false);
        });
      });
    },
  };
}

async function gameMonetize() {
  const on = eventBus();
  const api = await waitFor(() => window.sdk && typeof window.sdk.showBanner === 'function' && window.sdk);
  if (!api) return null;
  return {
    ads: true,
    // GameMonetize serves interstitials only; the reward buttons stay hidden.
    rewarded: false,
    requestAd(type, { onStart, onEnd }) {
      if (type === 'rewarded') return Promise.resolve(false);
      return new Promise((resolve) => {
        let started = false;
        let done = false;
        let off = () => {};
        let noAd = 0;
        const finish = (ok) => {
          if (done) return;
          done = true;
          off();
          clearTimeout(noAd);
          if (started) onEnd();
          resolve(ok);
        };
        off = on((e) => {
          if (e.name === 'SDK_GAME_PAUSE' && !started) { started = true; onStart(); }
          if (e.name === 'SDK_GAME_START') finish(true);
          if (e.name === 'SDK_ERROR') finish(false);
        });
        // When no ad is served the SDK can stay silent: carry on after a moment.
        noAd = setTimeout(() => { if (!started) finish(false); }, 3000);
        api.showBanner();
      });
    },
  };
}

// ---------- Poki ----------
async function poki() {
  const api = await waitFor(() => window.PokiSDK);
  if (!api) return null;
  await withTimeout(api.init(), 'Poki init');
  return {
    ads: true,
    rewarded: true,
    loadingStop: () => api.gameLoadingFinished(),
    gameplayStart: () => api.gameplayStart(),
    gameplayStop: () => api.gameplayStop(),
    async requestAd(type, { onStart, onEnd }) {
      let started = false;
      const start = () => { started = true; onStart(); };
      try {
        if (type === 'rewarded') return Boolean(await api.rewardedBreak(start));
        await api.commercialBreak(start);
        return true;
      } finally {
        if (started) onEnd();
      }
    },
  };
}

const ADAPTERS = { crazygames: crazyGames, gamedistribution: gameDistribution, gamemonetize: gameMonetize, poki };

export async function initSdk() {
  const make = ADAPTERS[PLATFORM];
  if (!make) {
    console.info(`[sdk] platform "${PLATFORM}": no ad SDK`);
    return false;
  }
  try {
    adapter = await make();
    if (!adapter) console.warn(`[sdk] ${PLATFORM} SDK not present, running standalone`);
  } catch (err) {
    console.warn(`[sdk] ${PLATFORM} init failed, running standalone`, err);
    adapter = null;
  }
  return adapter !== null;
}

const call = (name) => () => adapter && adapter[name] && safe(name, () => adapter[name]());

export const Sdk = {
  get available() {
    return adapter !== null;
  },
  get platform() {
    return PLATFORM;
  },
  // This portal allows ads and its SDK loaded.
  get adsEnabled() {
    return Boolean(adapter && adapter.ads);
  },
  // This portal also serves rewarded ads (the opt-in reward buttons).
  get rewardedEnabled() {
    return Boolean(adapter && adapter.ads && adapter.rewarded);
  },
  loadingStart: call('loadingStart'),
  loadingStop: call('loadingStop'),
  gameplayStart() {
    if (playing) return;
    playing = true;
    call('gameplayStart')();
  },
  gameplayStop() {
    if (!playing) return;
    playing = false;
    call('gameplayStop')();
  },
  happytime: call('happytime'),

  // Portal username when the player is logged in, otherwise null.
  async username() {
    if (!adapter || !adapter.username) return null;
    try {
      const name = await adapter.username();
      return typeof name === 'string' ? name.slice(0, 24) : null;
    } catch (err) {
      console.warn('[sdk] username failed', err);
      return null;
    }
  },

  // Returns a backend with getItem/setItem: the portal's cloud save when it
  // has one, otherwise localStorage, otherwise memory.
  storageBackend() {
    if (adapter && adapter.storage) return adapter.storage;
    try {
      const probe = '__wpf_probe';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch {
      const mem = new Map();
      return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
    }
  },

  onSettings(listener) {
    if (adapter && adapter.onSettings) safe('settings', () => adapter.onSettings(listener));
  },

  // Resolves true when the ad finished (rewarded: the reward should be granted).
  async requestAd(type, { onStart, onEnd }) {
    if (!adapter || !adapter.ads) return false;
    inAd = true;
    try {
      return await adapter.requestAd(type, { onStart, onEnd });
    } catch (err) {
      console.warn(`[sdk] requestAd ${type} threw`, err);
      return false;
    } finally {
      inAd = false;
    }
  },
  // Called for ads the portal starts by itself (not requested by the game).
  onPortalAd(handlers) {
    portalAd = handlers;
  },

  shouldShowMidgame(runs) {
    return runs >= MIDGAME_MIN_FLIGHTS && Date.now() - lastMidgame > MIDGAME_GAP_MS;
  },
  markMidgame() {
    lastMidgame = Date.now();
  },
};
