export const VW = 720;
export const VH = 1280;

export const SHAPES = {
  circle: { glyph: "●", name: "Сфера" },
  triangle: { glyph: "▲", name: "Клин" },
  square: { glyph: "■", name: "Куб" },
  hex: { glyph: "⬢", name: "Призма" },
  diamond: { glyph: "◆", name: "Щит" },
  boss: { glyph: "✸", name: "Ядро" },
};

export const WEAPON_INFO = {
  gun: { name: "Пулемёт", color: "#7ee8ff" },
  laser: { name: "Лазер", color: "#60a5fa" },
  scatter: { name: "Дробь", color: "#fbbf24" },
  grenade: { name: "Заряд", color: "#fb7185" },
  emp: { name: "EMP", color: "#c084fc" },
  orb: { name: "Орбиты", color: "#34d399" },
  drone: { name: "Дрон", color: "#f472b6" },
};

export const META_UPGRADES = [
  { key: "atk", title: "Мощность ядра", desc: "+12% урона пулемёта навсегда" },
  { key: "hp", title: "Обшивка", desc: "+40 HP ядра навсегда" },
  { key: "charge", title: "Конденсатор", desc: "Овердрайв копится быстрее" },
];

export const CRYSTAL_SHOP = {
  critPrice: 25,
  critBonus: 2,
  critCap: 10,
  weaponPrice: 40,
  fourthPrice: 50,
};

export function cardPool(run) {
  const cards = [
    { id: "dmg", title: "Калибр", desc: "Урон пулемёта +35%", rarity: "common", apply: (r) => (r.gun.dmg *= 1.35) },
    { id: "rate", title: "Темп", desc: "Скорострельность +25%", rarity: "common", apply: (r) => (r.gun.rate *= 1.25) },
    { id: "multi", title: "Веер", desc: "+1 пуля в залпе", rarity: "rare", apply: (r) => (r.gun.pellets += 1) },
    { id: "pierce", title: "Пробой", desc: "Пули прошивают +1 цель", rarity: "rare", apply: (r) => (r.gun.pierce += 1) },
    { id: "bounce", title: "Рикошет", desc: "Пули отскакивают от краёв", rarity: "rare", apply: (r) => (r.gun.bounce = true) },
    { id: "killstack", title: "Жатва", desc: "+0.4% урона за каждое убийство", rarity: "epic", apply: (r) => (r.gun.killStack += 0.004) },
    { id: "turn", title: "Сервопривод", desc: "Автонаводка быстрее", rarity: "common", apply: (r) => (r.gun.autoTurn *= 1.45) },
    { id: "focus", title: "Фокус", desc: "Ручной прицел даёт ещё +40% урона", rarity: "rare", apply: (r) => (r.gun.focusMul *= 1.4) },
    { id: "over", title: "Перегруз", desc: "Овердрайв длится дольше и сильнее", rarity: "epic", apply: (r) => { r.overdrive.dur += 1.4; r.overdrive.mul += 0.35; } },
    { id: "hp", title: "Пластины", desc: "Ядро +80 HP и лёгкий реген", rarity: "common", apply: (r) => { r.tower.maxHp += 80; r.tower.hp += 80; r.tower.regen += 1.2; } },
    { id: "combo", title: "Резонатор", desc: "Резонанс форм срабатывает с 4 убийств", rarity: "rare", apply: (r) => (r.comboNeed = Math.max(4, r.comboNeed - 2)) },
    { id: "crit", title: "Крит", desc: "Шанс крита +6%. Крит наносит ×2", rarity: "common", apply: (r) => (r.crit.chance = Math.min(0.75, r.crit.chance + 0.06)) },
    { id: "crit-r", title: "Острота", desc: "Шанс крита +10%. Крит наносит ×2", rarity: "rare", apply: (r) => (r.crit.chance = Math.min(0.75, r.crit.chance + 0.1)) },
    { id: "crit-e", title: "Казнь", desc: "Шанс крита +15%. Крит наносит ×2", rarity: "epic", apply: (r) => (r.crit.chance = Math.min(0.75, r.crit.chance + 0.15)) },
  ];

  const unlocks = [
    { id: "laser", title: "Лазер", desc: "Луч бьёт сквозь линию врагов", rarity: "rare", weapon: "laser" },
    { id: "scatter", title: "Дробь", desc: "Близкий конус, сильный отброс", rarity: "rare", weapon: "scatter" },
    { id: "grenade", title: "Заряд", desc: "АоЕ по скоплению", rarity: "rare", weapon: "grenade" },
    { id: "emp", title: "EMP", desc: "Пульс вокруг ядра, замедление", rarity: "epic", weapon: "emp" },
    { id: "orb", title: "Орбиты", desc: "Вращающиеся сферы-щиты", rarity: "rare", weapon: "orb" },
    { id: "drone", title: "Дрон", desc: "Автономный перехватчик", rarity: "epic", weapon: "drone" },
  ];

  for (const u of unlocks) {
    if (!run.weapons[u.weapon]) {
      cards.push({
        ...u,
        apply: (r) => {
          r.weapons[u.weapon] = true;
          r.wepStats[u.weapon] = defaultWep(u.weapon);
        },
      });
    }
  }

  if (run.weapons.laser) {
    cards.push(
      { id: "laser-d", title: "Ионизация", desc: "Урон лазера +40%", rarity: "common", apply: (r) => (r.wepStats.laser.dmg *= 1.4) },
      { id: "laser-w", title: "Ширина луча", desc: "Лазер толще и бьёт чаще", rarity: "rare", apply: (r) => { r.wepStats.laser.width += 4; r.wepStats.laser.cd *= 0.85; } },
    );
  }
  if (run.weapons.scatter) {
    cards.push(
      { id: "sc-n", title: "Картечь", desc: "+3 дробинки", rarity: "common", apply: (r) => (r.wepStats.scatter.n += 3) },
      { id: "sc-k", title: "Отброс", desc: "Дробь сильнее отталкивает", rarity: "rare", apply: (r) => (r.wepStats.scatter.knock += 40) },
    );
  }
  if (run.weapons.grenade) {
    cards.push(
      { id: "gr-r", title: "Фугас", desc: "Радиус взрыва +35%", rarity: "common", apply: (r) => (r.wepStats.grenade.radius *= 1.35) },
      { id: "gr-d", title: "Запал", desc: "Заряды чаще и больнее", rarity: "rare", apply: (r) => { r.wepStats.grenade.dmg *= 1.35; r.wepStats.grenade.cd *= 0.85; } },
    );
  }
  if (run.weapons.emp) {
    cards.push(
      { id: "emp-s", title: "Клетка", desc: "Замедление EMP сильнее", rarity: "rare", apply: (r) => (r.wepStats.emp.slow += 0.15) },
      { id: "emp-r", title: "Поле", desc: "Радиус EMP +30%", rarity: "common", apply: (r) => (r.wepStats.emp.radius *= 1.3) },
    );
  }
  if (run.weapons.orb) {
    cards.push(
      { id: "orb-n", title: "Рой", desc: "+1 орбита", rarity: "rare", apply: (r) => (r.wepStats.orb.count += 1) },
      { id: "orb-d", title: "Шипы", desc: "Орбиты наносят больше урона", rarity: "common", apply: (r) => (r.wepStats.orb.dmg *= 1.4) },
    );
  }
  if (run.weapons.drone) {
    cards.push(
      { id: "dr-n", title: "Эскадрилья", desc: "+1 дрон", rarity: "epic", apply: (r) => (r.wepStats.drone.count += 1) },
      { id: "dr-b", title: "Бомбы", desc: "Дрон сбрасывает заряды", rarity: "rare", apply: (r) => (r.wepStats.drone.bombs = true) },
    );
  }

  return cards;
}

const QUEUED_CARDS = {
  Калибр: (r) => (r.gun.dmg *= 1.35),
  Темп: (r) => (r.gun.rate *= 1.25),
  Сервопривод: (r) => (r.gun.autoTurn *= 1.45),
  Пластины: (r) => {
    r.tower.maxHp += 80;
    r.tower.hp += 80;
    r.tower.regen += 1.2;
  },
};

export function applyQueuedCard(run, title) {
  const apply = QUEUED_CARDS[title];
  if (!apply) return false;
  apply(run);
  return true;
}

export function startingLoadout(profile = {}) {
  const weapons = { gun: true, drone: true };
  const wepStats = {};
  for (const id of profile.weapons || []) {
    if (!WEAPON_INFO[id] || id === "gun" || id === "drone") continue;
    weapons[id] = true;
    wepStats[id] = defaultWep(id);
  }
  return { weapons, wepStats, cards: profile.fourthCard ? 4 : 3 };
}

export function defaultWep(id) {
  switch (id) {
    case "laser":
      return { dmg: 36, cd: 0.6, width: 14, timer: 0, branch: null, rays: 1, spread: 0.28, bounces: 0, edgeMul: 1, burn: 0 };
    case "scatter":
      return { dmg: 16, cd: 0.8, n: 7, knock: 70, gap: 0.1, pierce: 0, timer: 0, branch: null, centerMul: 1, shards: 0, shardMul: 0.45 };
    case "grenade":
      return { dmg: 58, cd: 1.45, radius: 100, timer: 0, branch: null, bombs: 0, bombMul: 0.55, poolDmg: 20 };
    case "emp":
      return { dmg: 14, cd: 2.7, radius: 145, slow: 0.45, slowMul: 0.45, slowDur: 1.7, hits: 1, knock: 0, timer: 0, branch: null };
    case "orb":
      return { dmg: 18, count: 3, radius: 104, spin: 2, branch: null, reach: 1, fly: [] };
    case "drone":
      return { dmg: 11, count: 1, cd: 0.28, bombs: false, timer: 0 };
    default:
      return {};
  }
}

export function pickCards(run, n = 3) {
  const pool = cardPool(run);
  const taken = new Set();
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 40) {
    const weights = pool.map((c) => (c.rarity === "epic" ? 1 : c.rarity === "rare" ? 3 : 6));
    const sum = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * sum;
    let card = pool[0];
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        card = pool[i];
        break;
      }
    }
    if (taken.has(card.id)) continue;
    taken.add(card.id);
    out.push(card);
  }
  return out;
}

export const ENEMY_KINDS = [
  { type: "circle", hp: 50, speed: 58, dmg: 7, r: 16, color: "#7dd3fc", xp: 6, coins: 2 },
  { type: "triangle", hp: 34, speed: 92, dmg: 6, r: 14, color: "#fbbf24", xp: 7, coins: 2, zigzag: true },
  { type: "square", hp: 110, speed: 40, dmg: 12, r: 20, color: "#fb7185", xp: 10, coins: 3 },
  { type: "hex", hp: 70, speed: 52, dmg: 8, r: 18, color: "#c084fc", xp: 11, coins: 3, split: 3 },
  { type: "diamond", hp: 84, speed: 48, dmg: 9, r: 17, color: "#34d399", xp: 10, coins: 3, shield: 50 },
];

export const ENEMY_SPAWN = [
  { minWave: 2, chance: 0.35 },
  { minWave: 3, chance: 0.28 },
  { minWave: 4, chance: 0.22 },
  { minWave: 5, chance: 0.2 },
];

export const WAVE_GROWTH = { hpPow: 1.32, chapter: 0.42, dmgPerWave: 0.06 };
export const BOSS_EVERY = 6;
export const BOSS_BASE = { hp: 800, speed: 28, dmg: 18, r: 78, color: "#f472b6", xp: 80, coins: 28 };
export const WAVE_COUNT_BASE = 40;
export const WAVE_COUNT_STEP = 12;
export const WAVE_COUNT_MULT = 10;

export function endlessEnemyWave(wave) {
  return ((wave - 1) % 5) + 1;
}

export function enemyForWave(wave, chapter, power = 1, rng = Math.random) {
  const scale = Math.pow(WAVE_GROWTH.hpPow, wave - 1) * (1 + (chapter - 1) * WAVE_GROWTH.chapter) * power;

  if (wave % BOSS_EVERY === 0) {
    return {
      type: "boss",
      hp: BOSS_BASE.hp * scale,
      speed: BOSS_BASE.speed,
      dmg: BOSS_BASE.dmg,
      r: BOSS_BASE.r,
      color: BOSS_BASE.color,
      xp: BOSS_BASE.xp,
      coins: BOSS_BASE.coins,
      boss: true,
    };
  }

  let idx = 0;
  for (let i = 0; i < ENEMY_SPAWN.length; i++) {
    const row = ENEMY_SPAWN[i];
    if (wave >= row.minWave && rng() < row.chance) idx = i + 1;
  }
  const e = { ...ENEMY_KINDS[idx] };
  e.hp *= scale;
  e.dmg *= (1 + (wave - 1) * WAVE_GROWTH.dmgPerWave) * power;
  return e;
}

export function waveCount(wave) {
  if (wave % BOSS_EVERY === 0) return 1;
  return (WAVE_COUNT_BASE + wave * WAVE_COUNT_STEP) * WAVE_COUNT_MULT;
}
