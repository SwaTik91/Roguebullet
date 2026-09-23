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
  emp: { name: "Импульс", color: "#c084fc" },
  orb: { name: "Орбиты", color: "#34d399" },
  drone: { name: "Дрон", color: "#f472b6" },
};

export const META_UPGRADES = [
  { key: "atk", title: "Мощность ядра", desc: "+12% урона пулемёта навсегда" },
  { key: "hp", title: "Обшивка", desc: "+40 HP ядра навсегда" },
  { key: "charge", title: "Конденсатор", desc: "Овердрайв копится быстрее" },
];

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
    { id: "emp", title: "Импульс", desc: "Пульс вокруг ядра, замедление", rarity: "epic", weapon: "emp" },
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

export function defaultWep(id) {
  switch (id) {
    case "laser":
      return { dmg: 28, cd: 0.72, width: 7, timer: 0 };
    case "scatter":
      return { dmg: 9, cd: 1.05, n: 6, knock: 70, timer: 0 };
    case "grenade":
      return { dmg: 46, cd: 1.7, radius: 88, timer: 0 };
    case "emp":
      return { dmg: 22, cd: 3.1, radius: 170, slow: 0.45, timer: 0 };
    case "orb":
      return { dmg: 10, count: 2, radius: 92, spin: 1.8 };
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

export function enemyForWave(wave, chapter) {
  const scale = Math.pow(1.2, wave - 1) * (1 + (chapter - 1) * 0.28);
  const table = [
    { type: "circle", hp: 22, speed: 58, dmg: 8, r: 16, color: "#7dd3fc", xp: 6, coins: 2 },
    { type: "triangle", hp: 14, speed: 92, dmg: 7, r: 14, color: "#fbbf24", xp: 7, coins: 2, zigzag: true },
    { type: "square", hp: 48, speed: 40, dmg: 14, r: 20, color: "#fb7185", xp: 10, coins: 3 },
    { type: "hex", hp: 30, speed: 52, dmg: 9, r: 18, color: "#c084fc", xp: 11, coins: 3, split: 3 },
    { type: "diamond", hp: 36, speed: 48, dmg: 10, r: 17, color: "#34d399", xp: 10, coins: 3, shield: 22 },
  ];

  if (wave % 6 === 0) {
    return {
      type: "boss",
      hp: 420 * scale,
      speed: 28,
      dmg: 18,
      r: 42,
      color: "#f472b6",
      xp: 80,
      coins: 28,
      boss: true,
    };
  }

  let idx = 0;
  if (wave >= 2 && Math.random() < 0.35) idx = 1;
  if (wave >= 3 && Math.random() < 0.28) idx = 2;
  if (wave >= 4 && Math.random() < 0.22) idx = 3;
  if (wave >= 5 && Math.random() < 0.2) idx = 4;
  const e = { ...table[idx] };
  e.hp *= scale;
  e.dmg *= 1 + (wave - 1) * 0.06;
  return e;
}

export function waveCount(wave) {
  if (wave % 6 === 0) return 1;
  return 7 + wave * 2;
}
