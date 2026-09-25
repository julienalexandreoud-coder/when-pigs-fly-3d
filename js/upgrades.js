// Upgrade lines, pig skins and the flight stats they produce.
// `costs[i]` is the price of going from level i to level i + 1.

export const UPGRADES = Object.freeze([
  {
    id: 'launcher', name: 'Launcher', blurb: 'Launch speed',
    levels: [
      { name: 'Slingshot', v: 16 }, { name: 'Big Slingshot', v: 21 }, { name: 'Catapult', v: 27 },
      { name: 'Hay Cannon', v: 34 }, { name: 'Circus Cannon', v: 43 }, { name: 'Tractor Launcher', v: 54 },
      { name: 'Steam Cannon', v: 68 }, { name: 'Railgun', v: 86 },
    ],
    costs: [20, 55, 220, 600, 1500, 3800, 10000],
  },
  {
    id: 'wings', name: 'Wings', blurb: 'Lift and glide',
    levels: [
      { name: 'Cardboard Wings', qL: 0.010, K: 0.093 }, { name: 'Umbrella Wings', qL: 0.013, K: 0.070 },
      { name: 'Kite Wings', qL: 0.016, K: 0.056 }, { name: 'Hang Glider', qL: 0.019, K: 0.047 },
      { name: 'Biplane Wings', qL: 0.022, K: 0.040 }, { name: 'Carbon Wings', qL: 0.025, K: 0.035 },
      { name: 'Jet Wings', qL: 0.028, K: 0.031 },
    ],
    costs: [30, 90, 380, 1000, 2500, 7000],
  },
  {
    id: 'rocket', name: 'Rocket', blurb: 'Boost power',
    levels: [
      { name: 'No Rocket', thrust: 0 }, { name: 'Soda Bottle', thrust: 16 }, { name: 'Firework', thrust: 24 },
      { name: 'Toy Rocket', thrust: 34 }, { name: 'Jet Engine', thrust: 46 }, { name: 'Space Rocket', thrust: 64 },
      { name: 'Warp Thruster', thrust: 90 },
    ],
    costs: [45, 180, 750, 2100, 5400, 15000],
  },
  {
    id: 'tank', name: 'Fuel Tank', blurb: 'Boost time', requires: 'rocket',
    levels: [
      { name: 'Juice Box', fuel: 2 }, { name: 'Thermos', fuel: 3 }, { name: 'Milk Jug', fuel: 4.2 },
      { name: 'Gas Can', fuel: 5.6 }, { name: 'Oil Drum', fuel: 7.5 }, { name: 'Big Tank', fuel: 10 },
      { name: 'Mega Tank', fuel: 13.5 }, { name: 'Fusion Cell', fuel: 18 },
    ],
    costs: [40, 110, 450, 1200, 3000, 7500, 20000],
  },
  {
    id: 'helmet', name: 'Helmet', blurb: 'Less air drag',
    levels: [
      { name: 'Bare Head', cd: 0.0030 }, { name: 'Leather Cap', cd: 0.0025 }, { name: 'Racing Helmet', cd: 0.0020 },
      { name: 'Bullet Helmet', cd: 0.0016 }, { name: 'Nose Cone', cd: 0.0012 },
    ],
    costs: [35, 160, 1000, 4500],
  },
  {
    id: 'belly', name: 'Bouncy Belly', blurb: 'Skip along the ground',
    levels: [
      { name: 'Soft Belly', e: 0.25 }, { name: 'Rubber Belly', e: 0.33 }, { name: 'Bouncy Belly', e: 0.40 },
      { name: 'Super Bouncy', e: 0.47 }, { name: 'Pogo Belly', e: 0.54 }, { name: 'Flubber Belly', e: 0.6 },
    ],
    costs: [25, 80, 340, 900, 2400],
  },
  {
    id: 'magnet', name: 'Coin Magnet', blurb: 'Coin reach',
    levels: [
      { name: 'Snout', r: 1.2 }, { name: 'Fridge Magnet', r: 2 }, { name: 'Horseshoe', r: 3 },
      { name: 'Electro Magnet', r: 4.2 }, { name: 'Mega Magnet', r: 5.4 }, { name: 'Black Hole', r: 6.5 },
    ],
    costs: [30, 100, 450, 1200, 3000],
  },
  {
    id: 'bank', name: 'Piggy Bank', blurb: 'More coins per flight',
    levels: [
      { name: 'Empty Pocket', m: 1 }, { name: 'Piggy Bank', m: 1.1 }, { name: 'Big Piggy', m: 1.2 },
      { name: 'Golden Piggy', m: 1.3 }, { name: 'Piggy Vault', m: 1.4 }, { name: 'Piggy Empire', m: 1.5 },
      { name: 'Hog Heaven', m: 1.6 },
    ],
    costs: [70, 240, 1000, 2700, 6800, 16000],
  },
]);

export const upgradeById = (id) => UPGRADES.find((u) => u.id === id) || null;
export const maxLevel = (u) => u.levels.length - 1;

export const SKINS = Object.freeze([
  { id: 'pink', name: 'Classic Pink', cost: 0, body: '#ffb0c4', shade: '#ee88a4', snout: '#ff95b3', ear: '#f07c9c', trail: '#ffffff' },
  { id: 'spotted', name: 'Spotted', cost: 300, body: '#ffdbe4', shade: '#efb0c0', snout: '#ffb3c6', ear: '#e992a8', spots: '#5b3a2a', trail: '#ffe7ef' },
  { id: 'mud', name: 'Mud Pig', cost: 650, body: '#c29470', shade: '#976947', snout: '#d6a882', ear: '#8e6240', spots: '#6a4529', trail: '#b58860' },
  { id: 'boar', name: 'Wild Boar', cost: 1300, body: '#81604a', shade: '#5c4130', snout: '#a27a62', ear: '#5c4130', tusks: true, mohawk: '#2e2018', trail: '#d4ad86' },
  { id: 'robo', name: 'Robo Pig', cost: 2800, body: '#c9d4df', shade: '#93a3b3', snout: '#aebccb', ear: '#8898a8', antenna: true, eye: '#39e1ff', trail: '#39e1ff' },
  { id: 'astro', name: 'Astronaut', cost: 5500, body: '#ffb0c4', shade: '#ee88a4', snout: '#ff95b3', ear: '#f07c9c', bubble: true, trail: '#9fe3ff' },
  { id: 'unicorn', name: 'Unicorn', cost: 9500, body: '#fff2fb', shade: '#f0c8e6', snout: '#ffc6ea', ear: '#f3a9d9', horn: true, trail: 'rainbow' },
  { id: 'golden', name: 'Golden Pig', cost: null, unlock: 'moon', body: '#ffd54a', shade: '#e0a414', snout: '#ffe07a', ear: '#e6a51c', glow: true, trail: '#ffe45c' },
]);

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

const level = (upgrades, id) => {
  const u = upgradeById(id);
  const lv = upgrades && Number.isFinite(upgrades[id]) ? upgrades[id] : 0;
  return Math.max(0, Math.min(maxLevel(u), Math.floor(lv)));
};

export function computeStats(upgrades) {
  const lv = Object.fromEntries(UPGRADES.map((u) => [u.id, level(upgrades, u.id)]));
  const pickLevel = (id) => upgradeById(id).levels[lv[id]];
  const rocket = pickLevel('rocket');
  return Object.freeze({
    tiers: Object.freeze(lv),
    launchSpeed: pickLevel('launcher').v,
    qL: pickLevel('wings').qL,
    K: pickLevel('wings').K,
    thrust: rocket.thrust,
    fuel: rocket.thrust > 0 ? pickLevel('tank').fuel : 0,
    cdBody: pickLevel('helmet').cd,
    restitution: pickLevel('belly').e,
    magnet: pickLevel('magnet').r,
    payMult: pickLevel('bank').m,
  });
}

// Best glide ratio (lift / drag) for a wing and helmet at the best lift coefficient.
export function glideRatio(stats) {
  const cl = Math.min(1, Math.sqrt(stats.cdBody / (stats.qL * stats.K)));
  return (stats.qL * cl) / (stats.cdBody + stats.qL * stats.K * cl * cl);
}

// Short plain-language stat for an upgrade at a level (used on shop cards).
export function statText(id, lv) {
  const u = upgradeById(id);
  const l = u.levels[Math.max(0, Math.min(maxLevel(u), lv))];
  switch (id) {
    case 'launcher': return `${Math.round(l.v * 3.6)} km/h launch`;
    case 'wings': return `Glide ${glideRatio({ qL: l.qL, K: l.K, cdBody: 0.003 }).toFixed(1)}×`;
    case 'rocket': return l.thrust ? `${(l.thrust / 9.81).toFixed(1)} g thrust` : 'No boost';
    case 'tank': return `${l.fuel} s of fuel`;
    case 'helmet': return l.cd < 0.003 ? `−${Math.round((1 - l.cd / 0.003) * 100)}% drag` : 'Normal drag';
    case 'belly': return `${Math.round(l.e * 100)}% bounce`;
    case 'magnet': return `${l.r} m coin reach`;
    case 'bank': return l.m > 1 ? `+${Math.round((l.m - 1) * 100)}% coins` : 'No bonus';
    default: return '';
  }
}

export function isLocked(upgrades, u) {
  return Boolean(u.requires) && level(upgrades, u.requires) === 0;
}
