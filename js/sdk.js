// Thin, failure-tolerant wrapper around the CrazyGames HTML5 SDK v3.
// Every call is guarded so the game keeps working if the SDK is blocked.

let sdk = null;
let playing = false;
let lastMidgame = 0;
const MIDGAME_GAP_MS = 180_000;
const INIT_TIMEOUT_MS = 6000;
const MIDGAME_MIN_FLIGHTS = 3;

const safe = (label, fn) => {
  try {
    return fn();
  } catch (err) {
    console.warn(`[sdk] ${label} failed`, err);
    return undefined;
  }
};

export async function initSdk() {
  const api = window.CrazyGames && window.CrazyGames.SDK;
  if (!api) {
    console.warn('[sdk] CrazyGames SDK not present, running standalone');
    return false;
  }
  try {
    // Never let a stuck SDK keep the game on the loading screen.
    await Promise.race([
      api.init(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('init timed out')), INIT_TIMEOUT_MS)),
    ]);
    sdk = api;
    return true;
  } catch (err) {
    console.warn('[sdk] init failed, running standalone', err);
    return false;
  }
}

export const Sdk = {
  get available() {
    return sdk !== null;
  },
  loadingStart: () => sdk && safe('loadingStart', () => sdk.game.loadingStart()),
  loadingStop: () => sdk && safe('loadingStop', () => sdk.game.loadingStop()),
  gameplayStart() {
    if (playing) return;
    playing = true;
    if (sdk) safe('gameplayStart', () => sdk.game.gameplayStart());
  },
  gameplayStop() {
    if (!playing) return;
    playing = false;
    if (sdk) safe('gameplayStop', () => sdk.game.gameplayStop());
  },
  happytime: () => sdk && safe('happytime', () => sdk.game.happytime()),
  get raw() {
    return sdk;
  },

  // CrazyGames username when the player is logged in, otherwise null.
  async username() {
    if (!sdk || !sdk.user || !sdk.user.isUserAccountAvailable) return null;
    try {
      const user = await sdk.user.getUser();
      return user && typeof user.username === 'string' ? user.username.slice(0, 24) : null;
    } catch (err) {
      console.warn('[sdk] getUser failed', err);
      return null;
    }
  },

  // Returns a backend with getItem/setItem: the SDK data module (synced to
  // the player's CrazyGames account) or localStorage as a fallback.
  storageBackend() {
    if (sdk && sdk.data && typeof sdk.data.getItem === 'function') return sdk.data;
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
    if (!sdk || !sdk.game) return;
    safe('settings', () => {
      if (sdk.game.settings) listener(sdk.game.settings);
      if (typeof sdk.game.addSettingsChangeListener === 'function') {
        sdk.game.addSettingsChangeListener(listener);
      }
    });
  },

  // Resolves true when a rewarded ad finished (reward should be granted).
  requestAd(type, { onStart, onEnd }) {
    return new Promise((resolve) => {
      if (!sdk) {
        resolve(false);
        return;
      }
      let started = false;
      const finish = (granted) => {
        if (started) onEnd();
        resolve(granted);
      };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            started = true;
            onStart();
          },
          adFinished: () => finish(true),
          adError: (err) => {
            console.warn(`[sdk] ${type} ad error`, err);
            finish(false);
          },
        });
      } catch (err) {
        console.warn(`[sdk] requestAd ${type} threw`, err);
        finish(false);
      }
    });
  },

  shouldShowMidgame(runs) {
    return runs >= MIDGAME_MIN_FLIGHTS && Date.now() - lastMidgame > MIDGAME_GAP_MS;
  },
  markMidgame() {
    lastMidgame = Date.now();
  },
};
