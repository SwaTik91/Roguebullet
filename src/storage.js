const KEY = "polyspire-v1";

const DEFAULTS = {
  coins: 0,
  bestWave: 0,
  chapter: 1,
  bestLevel: 1,
  atk: 0,
  hp: 0,
  charge: 0,
  seenHow: false,
  showDamage: true,
};

export function loadMeta() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveMeta(meta) {
  localStorage.setItem(KEY, JSON.stringify(meta));
}

export function upgradeCost(level) {
  return Math.round(40 * Math.pow(1.65, level));
}
