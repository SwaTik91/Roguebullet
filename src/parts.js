export const RARITY_STEP = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

export const BASES = {
  gun: [
    { id: "barrel", name: "Ствол" },
    { id: "belt", name: "Лента" },
    { id: "sight", name: "Прицел" },
    { id: "muzzle", name: "Дульный тормоз" },
  ],
  drone: [
    { id: "hull", name: "Корпус" },
    { id: "rotor", name: "Ротор" },
    { id: "grip", name: "Захват" },
    { id: "battery", name: "Батарея" },
  ],
  laser: [
    { id: "lens", name: "Линза" },
    { id: "coil", name: "Катушка" },
    { id: "prism", name: "Призма" },
    { id: "radiator", name: "Радиатор" },
  ],
  scatter: [
    { id: "chamber", name: "Патронник" },
    { id: "choke", name: "Чок" },
    { id: "stock", name: "Приклад" },
    { id: "powder", name: "Порох" },
  ],
  grenade: [
    { id: "shell", name: "Корпус снаряда" },
    { id: "fuze", name: "Взрыватель" },
    { id: "shrapnel", name: "Осколки" },
    { id: "primer", name: "Запал" },
  ],
  emp: [
    { id: "pulseCoil", name: "Катушка импульса" },
    { id: "pulseCap", name: "Конденсатор импульса" },
    { id: "antenna", name: "Антенна" },
    { id: "shield", name: "Экран" },
  ],
  orb: [
    { id: "ring", name: "Кольцо" },
    { id: "axis", name: "Ось" },
    { id: "heart", name: "Сердечник" },
    { id: "rim", name: "Обод" },
  ],
  common: [
    { id: "core", name: "Ядро" },
    { id: "actuator", name: "Привод" },
    { id: "sensor", name: "Датчик" },
    { id: "cooler", name: "Охладитель" },
  ],
};

const AFFIX_META = {
  gun: {
    dmg: { name: "урон", minRarity: "common", bonus: "gunDmg", perStep: 0.04, cap: 0.4 },
    rate: { name: "скорострельность", minRarity: "common", bonus: "gunRate", perStep: 0.5, cap: 4 },
    pierce: { name: "пробивание", minRarity: "common", bonus: "gunPierce", perStep: 1, cap: 4 },
    bounce: {
      name: "рикошет",
      minRarity: "epic",
      bonus: "gunBounce",
      epic: 1,
      legendary: 2,
      cap: 2,
    },
  },
  drone: {
    dmg: { name: "урон", minRarity: "common", bonus: "droneDmg", perStep: 0.04, cap: 0.4 },
    cd: { name: "перезарядка", minRarity: "common", bonus: "droneCd", perStep: -0.02, cap: null },
    pierce: { name: "пробивание", minRarity: "common", bonus: "dronePierce", perStep: 1, cap: 2 },
    life: { name: "жизнь выстрела", minRarity: "common", bonus: "droneLife", perStep: 0.1, cap: null },
  },
  laser: {
    dmg: { name: "урон", minRarity: "common", bonus: "laserDmg", perStep: 0.04, cap: 0.4 },
    width: { name: "ширина", minRarity: "common", bonus: "laserWidth", perStep: 1, cap: null },
    cd: { name: "перезарядка", minRarity: "common", bonus: "laserCd", perStep: -0.04, cap: null },
    bounce: {
      name: "рикошет луча",
      minRarity: "epic",
      bonus: "laserBounce",
      epic: 1,
      legendary: 1,
      cap: 1,
    },
  },
  scatter: {
    dmg: { name: "урон", minRarity: "common", bonus: "scatterDmg", perStep: 0.04, cap: 0.4 },
    pellets: {
      name: "дробины",
      minRarity: "epic",
      bonus: "scatterPellets",
      epic: 1,
      legendary: 2,
      cap: 3,
    },
    knock: { name: "отброс", minRarity: "common", bonus: "scatterKnock", perStep: 8, cap: null },
    pierce: { name: "пробивание", minRarity: "common", bonus: "scatterPierce", perStep: 1, cap: null },
  },
  grenade: {
    dmg: { name: "урон", minRarity: "common", bonus: "grenadeDmg", perStep: 0.04, cap: 0.4 },
    radius: { name: "радиус", minRarity: "common", bonus: "grenadeRadius", perStep: 6, cap: null },
    cd: { name: "перезарядка", minRarity: "common", bonus: "grenadeCd", perStep: -0.06, cap: null },
    pool: { name: "урон лужи", minRarity: "common", bonus: "grenadePool", perStep: 3, cap: null },
  },
  emp: {
    dmg: { name: "урон", minRarity: "common", bonus: "empDmg", perStep: 0.04, cap: 0.4 },
    radius: { name: "радиус", minRarity: "common", bonus: "empRadius", perStep: 8, cap: null },
    slowDur: { name: "длительность замедления", minRarity: "common", bonus: "empSlowDur", perStep: 0.15, cap: null },
    slowMul: { name: "сила замедления", minRarity: "common", bonus: "empSlowMul", perStep: -0.04, cap: null },
  },
  orb: {
    dmg: { name: "урон", minRarity: "common", bonus: "orbDmg", perStep: 0.04, cap: 0.4 },
    radius: { name: "радиус", minRarity: "common", bonus: "orbRadius", perStep: 4, cap: null },
    spin: { name: "скорость вращения", minRarity: "common", bonus: "orbSpin", perStep: 0.15, cap: null },
    count: {
      name: "число сфер",
      minRarity: "epic",
      bonus: "orbCount",
      epic: 1,
      legendary: 1,
      cap: 1,
    },
  },
  common: {
    allDmg: { name: "урон всего оружия", minRarity: "common", bonus: "allDmg", perStep: 0.03, cap: 0.3 },
    hp: { name: "здоровье ядра", minRarity: "common", bonus: "hp", perStep: 15, cap: 150 },
    regen: { name: "регенерация", minRarity: "common", bonus: "regen", perStep: 0.4, cap: 2.5 },
    crit: { name: "шанс крита", minRarity: "common", bonus: "crit", perStep: 0.01, cap: 0.06 },
    charge: { name: "заряд овердрайва", minRarity: "common", bonus: "charge", perStep: 0.08, cap: 0.4 },
    overDur: { name: "длительность овердрайва", minRarity: "common", bonus: "overDur", perStep: 0.15, cap: 1.2 },
  },
};

export const AFFIXES = AFFIX_META;

const BONUS_KEYS = [
  "gunDmg",
  "gunRate",
  "gunPierce",
  "gunBounce",
  "droneDmg",
  "droneCd",
  "dronePierce",
  "droneLife",
  "laserDmg",
  "laserWidth",
  "laserCd",
  "laserBounce",
  "scatterDmg",
  "scatterPellets",
  "scatterKnock",
  "scatterPierce",
  "grenadeDmg",
  "grenadeRadius",
  "grenadeCd",
  "grenadePool",
  "empDmg",
  "empRadius",
  "empSlowDur",
  "empSlowMul",
  "orbDmg",
  "orbRadius",
  "orbSpin",
  "orbCount",
  "allDmg",
  "hp",
  "regen",
  "crit",
  "charge",
  "overDur",
];

function emptyBonuses() {
  const out = {};
  for (const k of BONUS_KEYS) out[k] = 0;
  return out;
}

function rarityAtOrAbove(rarity, minRarity) {
  return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(minRarity);
}

function affixPool(family, rarity) {
  const table = family ? AFFIX_META[family] : AFFIX_META.common;
  if (!table) return [];
  return Object.entries(table)
    .filter(([, meta]) => rarityAtOrAbove(rarity, meta.minRarity))
    .map(([id, meta]) => ({ id, name: meta.name }));
}

function rollRarity(rng) {
  const r = rng();
  if (r < 0.55) return "common";
  if (r < 0.85) return "rare";
  if (r < 0.95) return "epic";
  return "legendary";
}

function weaponFamilies(ownedWeapons) {
  const set = new Set(["gun", "drone"]);
  for (const w of ownedWeapons || []) {
    if (w && w !== "gun" && w !== "drone") set.add(w);
  }
  return [...set];
}

function pickIndex(rng, n) {
  if (n <= 0) return 0;
  return Math.floor(rng() * n);
}

function pickTwoAffixes(rng, family, rarity) {
  const pool = affixPool(family, rarity);
  const first = pickIndex(rng, pool.length);
  let second = pickIndex(rng, pool.length - 1);
  if (second >= first) second += 1;
  const step = RARITY_STEP[rarity];
  return [
    { id: pool[first].id, name: pool[first].name, step },
    { id: pool[second].id, name: pool[second].name, step },
  ];
}

export function rollPart(rng, ownedWeapons, options = {}) {
  const familyRoll = rng();
  let family = null;
  let baseList = BASES.common;

  if (familyRoll >= 0.4) {
    const families = weaponFamilies(ownedWeapons);
    const idx = pickIndex(rng, families.length);
    family = families[idx];
    baseList = BASES[family];
  }

  const baseEntry = baseList[pickIndex(rng, baseList.length)];
  const rarity = rollRarity(rng);
  const affixes = pickTwoAffixes(rng, family, rarity);

  const part = {
    base: baseEntry.id,
    baseName: baseEntry.name,
    family,
    rarity,
    affixes,
  };
  if (options.id) part.id = options.id;
  return part;
}

export function describeAffix(family, affix) {
  const table = family ? AFFIX_META[family] : AFFIX_META.common;
  const meta = table?.[affix.id];
  const name = affix.name || meta?.name || affix.id;
  const step = affix.step ?? 1;
  const rarity = RARITY_ORDER[step - 1] || "common";

  if (meta?.perStep != null) {
    const raw = meta.perStep * step;
    if (meta.bonus?.endsWith("Dmg")) {
      const pct = Math.round(Math.abs(raw) * 100);
      return `${name}: +${pct}%`;
    }
    if (meta.bonus === "crit") return `${name}: +${Math.round(raw * 100)}%`;
    if (meta.bonus === "charge") return `${name}: +${Math.round(raw * 100)}% к набору`;
    if (raw < 0) return `${name}: ${raw.toFixed(2).replace(/-0/, "-")}`;
    return `${name}: +${raw}`;
  }

  if (meta?.epic != null) {
    const val = rarity === "legendary" ? meta.legendary : meta.epic;
    return `${name}: +${val}`;
  }

  return `${name}`;
}

function partById(parts, partId) {
  return parts.find((p) => p.id === partId);
}

function equippedBases(slots, parts) {
  const bases = new Set();
  for (const id of slots) {
    if (!id) continue;
    const p = partById(parts, id);
    if (p) bases.add(p.base);
  }
  return bases;
}

function slotFamily(slots, parts, index) {
  const id = slots[index];
  if (!id) return null;
  const p = partById(parts, id);
  return p?.family ?? null;
}

function canPlaceWeapon(part, slots, parts, index) {
  if (index < 0 || index > 3) return false;
  const occupied = slots[index];
  if (!occupied) return true;
  const fam = slotFamily(slots, parts, index);
  return fam === part.family;
}

function firstWeaponSlot(part, slots, parts) {
  for (let i = 0; i < 4; i++) {
    if (!slots[i]) return i;
    if (slotFamily(slots, parts, i) === part.family) return i;
  }
  for (let i = 0; i < 4; i++) {
    if (!slots[i]) return i;
  }
  return -1;
}

function firstCommonSlot(slots) {
  for (let i = 4; i < 8; i++) if (!slots[i]) return i;
  return -1;
}

function tryEquip(parts, slots, partId, index) {
  const part = partById(parts, partId);
  if (!part) return { error: "Нет свободного слота" };

  if (equippedBases(slots, parts).has(part.base)) {
    return { error: "Такая уже надета" };
  }

  if (part.family === null) {
    if (index < 4) return { error: "Нет свободного слота" };
    if (index < 0 || index > 7 || slots[index]) return { error: "Нет свободного слота" };
    const next = [...slots];
    next[index] = partId;
    return { slots: next };
  }

  if (index >= 0) {
    if (index > 3) return { error: "Нет свободного слота" };
    if (!canPlaceWeapon(part, slots, parts, index)) return { error: "Нет свободного слота" };
    if (slots[index]) return { error: "Нет свободного слота" };
    const next = [...slots];
    next[index] = partId;
    return { slots: next };
  }

  const w = firstWeaponSlot(part, slots, parts);
  if (w >= 0 && !slots[w]) {
    const next = [...slots];
    next[w] = partId;
    return { slots: next };
  }
  const c = firstCommonSlot(slots);
  if (c < 0) return { error: "Нет свободного слота" };
  const next = [...slots];
  next[c] = partId;
  return { slots: next };
}

export function firstSlot(parts, slots, partId) {
  const part = partById(parts, partId);
  if (!part) return { error: "Нет свободного слота" };
  if (equippedBases(slots, parts).has(part.base)) {
    return { error: "Такая уже надета" };
  }

  if (part.family === null) {
    const idx = firstCommonSlot(slots);
    if (idx < 0) return { error: "Нет свободного слота" };
    const next = [...slots];
    next[idx] = partId;
    return { slots: next };
  }

  for (let i = 0; i < 4; i++) {
    if (slots[i]) continue;
    const next = [...slots];
    next[i] = partId;
    return { slots: next };
  }
  const c = firstCommonSlot(slots);
  if (c < 0) return { error: "Нет свободного слота" };
  const next = [...slots];
  next[c] = partId;
  return { slots: next };
}

export function equipAt(parts, slots, partId, index) {
  const part = partById(parts, partId);
  if (!part) return { error: "Нет свободного слота" };

  if (equippedBases(slots, parts).has(part.base)) {
    return { error: "Такая уже надета" };
  }

  if (part.family === null) {
    if (index < 4) return { error: "Нет свободного слота" };
  } else if (index < 4) {
    const fam = slotFamily(slots, parts, index);
    if (fam != null && fam !== part.family) return { error: "Нет свободного слота" };
  }

  if (index < 0 || index > 7 || slots[index]) {
    return { error: "Нет свободного слота" };
  }

  const next = [...slots];
  next[index] = partId;
  return { slots: next };
}

export function unequip(slots, index) {
  const next = [...slots];
  if (index >= 0 && index < next.length) next[index] = null;
  return next;
}

function affixContribution(family, affix, rarity) {
  const table = family ? AFFIX_META[family] : AFFIX_META.common;
  const meta = table?.[affix.id];
  if (!meta) return null;
  const step = affix.step ?? RARITY_STEP[rarity] ?? 1;

  if (meta.perStep != null) {
    return { key: meta.bonus, value: meta.perStep * step, cap: meta.cap };
  }
  const val = rarity === "legendary" ? meta.legendary : meta.epic;
  return { key: meta.bonus, value: val, cap: meta.cap };
}

function applyCap(key, sum, cap) {
  if (cap == null) return sum;
  if (key.includes("Cd") || key === "empSlowMul") {
    return sum;
  }
  return Math.min(sum, cap);
}

export function sumBonuses(parts, slots) {
  const raw = emptyBonuses();
  const caps = {};

  for (const id of slots) {
    if (!id) continue;
    const part = partById(parts, id);
    if (!part) continue;
    for (const affix of part.affixes) {
      const c = affixContribution(part.family, affix, part.rarity);
      if (!c) continue;
      raw[c.key] += c.value;
      if (c.cap != null) caps[c.key] = c.cap;
    }
  }

  const out = emptyBonuses();
  for (const key of BONUS_KEYS) {
    let sum = raw[key];
    if (caps[key] != null) sum = applyCap(key, sum, caps[key]);
    out[key] = sum;
  }
  return out;
}

const WEP_BONUS_MAP = {
  laser: { dmg: "laserDmg", width: "laserWidth", cd: "laserCd", bounces: "laserBounce" },
  scatter: { dmg: "scatterDmg", n: "scatterPellets", knock: "scatterKnock", pierce: "scatterPierce" },
  grenade: { dmg: "grenadeDmg", radius: "grenadeRadius", cd: "grenadeCd", poolDmg: "grenadePool" },
  emp: { dmg: "empDmg", radius: "empRadius", slowDur: "empSlowDur", slowMul: "empSlowMul" },
  orb: { dmg: "orbDmg", radius: "orbRadius", spin: "orbSpin", count: "orbCount" },
  drone: { dmg: "droneDmg", cd: "droneCd", pierce: "dronePierce", life: "droneLife" },
};

function applyDroneLike(target, bonuses, map) {
  if (!target) return;
  if (bonuses[map.dmg] != null) target.dmg *= 1 + bonuses[map.dmg] + bonuses.allDmg;
  if (map.cd && bonuses[map.cd] != null) target.cd += bonuses[map.cd];
  if (map.pierce && bonuses[map.pierce] != null) target.pierce = (target.pierce || 0) + bonuses[map.pierce];
  if (map.life && bonuses[map.life] != null) target.life = (target.life || 0) + bonuses[map.life];
}

export function applyBonuses(run, bonuses) {
  if (!run || !bonuses) return;
  const b = bonuses;

  if (run.gun) {
    run.gun.dmg *= 1 + (b.gunDmg || 0) + (b.allDmg || 0);
    run.gun.rate += b.gunRate || 0;
    run.gun.pierce += b.gunPierce || 0;
    run.gun.bounces += b.gunBounce || 0;
  }

  if (run.wepStats) {
    for (const [id, map] of Object.entries(WEP_BONUS_MAP)) {
      const st = run.wepStats[id];
      if (!st) continue;
      if (map.dmg) st.dmg *= 1 + (b[map.dmg] || 0) + (b.allDmg || 0);
      if (map.width && b[map.width] != null) st.width += b[map.width];
      if (map.cd && b[map.cd] != null) st.cd += b[map.cd];
      if (map.bounces && b[map.bounces] != null) st.bounces = (st.bounces || 0) + b[map.bounces];
      if (map.n && b[map.n] != null) st.n += b[map.n];
      if (map.knock && b[map.knock] != null) st.knock += b[map.knock];
      if (map.pierce && b[map.pierce] != null) st.pierce = (st.pierce || 0) + b[map.pierce];
      if (map.radius && b[map.radius] != null) st.radius += b[map.radius];
      if (map.poolDmg && b[map.poolDmg] != null) st.poolDmg += b[map.poolDmg];
      if (map.slowDur && b[map.slowDur] != null) st.slowDur = (st.slowDur || 0) + b[map.slowDur];
      if (map.slowMul && b[map.slowMul] != null) st.slowMul = (st.slowMul || 0) + b[map.slowMul];
      if (map.spin && b[map.spin] != null) st.spin += b[map.spin];
      if (map.count && b[map.count] != null) st.count += b[map.count];
    }
  }

  if (run.drone) {
    const map = WEP_BONUS_MAP.drone;
    applyDroneLike(run.drone, b, map);
  }

  if (run.tower) {
    run.tower.maxHp += b.hp || 0;
    run.tower.hp += b.hp || 0;
    run.tower.regen += b.regen || 0;
  }
  if (run.crit) run.crit.chance += b.crit || 0;
  if (run.overdrive) {
    run.overdrive.chargeGain += b.charge || 0;
    run.overdrive.dur += b.overDur || 0;
  }

  const droneCd = run.drone?.cd ?? run.wepStats?.drone?.cd;
  if (droneCd != null && droneCd < 0.12) {
    if (run.drone) run.drone.cd = 0.12;
    if (run.wepStats?.drone) run.wepStats.drone.cd = 0.12;
  }

  const laser = run.wepStats?.laser;
  if (laser) {
    if (laser.width > 22) laser.width = 22;
    if (laser.cd < 0.35) laser.cd = 0.35;
  }

  const grenade = run.wepStats?.grenade;
  if (grenade) {
    if (grenade.radius > 140) grenade.radius = 140;
    if (grenade.cd < 0.8) grenade.cd = 0.8;
  }

  const emp = run.wepStats?.emp;
  if (emp) {
    if (emp.radius > 190) emp.radius = 190;
    if (emp.slowDur > 2.6) emp.slowDur = 2.6;
    if (emp.slowMul < 0.15) emp.slowMul = 0.15;
  }
}
