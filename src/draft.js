import { defaultWep } from "./content.js";
import { addDrones, dronePool, hasten } from "./drone.js";
import { addCrit, addRate, gunPool } from "./gun.js";

const RARITY_WEIGHT = { common: 6, rare: 3, epic: 1, legendary: 1 };

function card(id, title, desc, rarity, apply) {
  return { id, title, desc, rarity, apply };
}

const GENERAL = [
  card("gen-plates", "Пластины", "Ядро +80 HP и лёгкий реген", "common", (r) => {
    r.tower.maxHp += 80;
    r.tower.hp += 80;
    r.tower.regen += 1.2;
  }),
  card("gen-crit", "Крит", "Шанс крита +6%", "common", (r) => addCrit(r, 0.06)),
  card("gen-regen", "Регенерация", "Регенерация ядра +2", "common", (r) => {
    r.tower.regen += 2;
  }),
  card("gen-cap", "Конденсатор", "Овердрайв копится быстрее", "common", (r) => {
    r.overdrive.chargeGain = (r.overdrive.chargeGain || 0) + 0.35;
  }),
  card("gen-armor", "Обшивка", "Ядро +140 HP", "rare", (r) => {
    r.tower.maxHp += 140;
  }),
  card("gen-sharp", "Острота", "Шанс крита +10%", "rare", (r) => addCrit(r, 0.1)),
  card("gen-reson", "Резонатор", "Резонанс форм требует на 2 убийства меньше", "rare", (r) => {
    r.comboNeed = Math.max(3, r.comboNeed - 2);
  }),
  card("gen-core", "Ядро", "Ядро +220 HP", "epic", (r) => {
    r.tower.maxHp += 220;
  }),
  card("gen-critc", "Контур крита", "Шанс крита +15%", "epic", (r) => addCrit(r, 0.15)),
  card("gen-over", "Перегруз", "Овердрайв длится дольше и сильнее", "epic", (r) => {
    r.overdrive.dur += 1.4;
    r.overdrive.mul += 0.35;
  }),
];

const UNLOCKS = [
  { id: "laser", title: "Лазер", desc: "Луч бьёт сквозь линию врагов", rarity: "rare" },
  { id: "scatter", title: "Дробь", desc: "Близкий конус, сильный отброс", rarity: "rare" },
  { id: "grenade", title: "Заряд", desc: "АоЕ по скоплению", rarity: "rare" },
  { id: "emp", title: "Импульс", desc: "Пульс вокруг ядра, замедление", rarity: "epic" },
  { id: "orb", title: "Орбиты", desc: "Вращающиеся сферы-щиты", rarity: "rare" },
  { id: "drone", title: "Дрон", desc: "Автономный перехватчик", rarity: "epic" },
];

const GUN_BRANCHES = [
  card("queue", "Очередь", "+4 выстрела в секунду и шанс крита +15%", "legendary", (r) => {
    r.gun.branch = "queue";
    addRate(r.gun, 4);
    addCrit(r, 0.15);
  }),
  card("volley", "Залп", "+3 пули в залпе и пробивание +2", "legendary", (r) => {
    r.gun.branch = "volley";
    r.gun.pellets += 3;
    r.gun.pierce += 2;
  }),
  card("ricochet", "Рикошет", "Пули отскакивают 2 раза. Урон после отскока +25%", "legendary", (r) => {
    r.gun.branch = "ricochet";
    r.gun.bounces += 2;
    r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.25;
  }),
];

const DRONE_BRANCHES = [
  card("flock", "Стая", "+1 дрон и стрельба быстрее", "legendary", (r) => {
    r.drone.branch = "flock";
    addDrones(r.drone, 1);
    hasten(r.drone, 0.7);
  }),
  card("bomb", "Бомбы", "Дроны сбрасывают бомбы. Взрыв больше", "legendary", (r) => {
    r.drone.branch = "bomb";
    r.drone.bombs = true;
    r.drone.radius += 24;
  }),
  card("hunt", "Охота", "Урон +60%, пули быстрее, пробивание +1", "legendary", (r) => {
    r.drone.branch = "hunt";
    r.drone.dmg *= 1.6;
    r.drone.speed += 200;
    r.drone.pierce += 1;
  }),
];

function secondaryUpgrades(id) {
  switch (id) {
    case "laser":
      return [
        card("laser-d", "Ионизация", "Урон лазера +40%", "common", (r) => {
          r.wepStats.laser.dmg *= 1.4;
        }),
        card("laser-w", "Ширина луча", "Лазер толще на 70% и бьёт чаще", "rare", (r) => {
          r.wepStats.laser.width *= 1.7;
          r.wepStats.laser.cd *= 0.85;
        }),
      ];
    case "scatter":
      return [
        card("sc-n", "Картечь", "Дробинок на 40% больше", "common", (r) => {
          const n = r.wepStats.scatter.n;
          r.wepStats.scatter.n = n + Math.max(1, Math.round(n * 0.4));
        }),
        card("sc-k", "Отброс", "Урон дроби +70% и сильнее отталкивает", "rare", (r) => {
          r.wepStats.scatter.dmg *= 1.7;
          r.wepStats.scatter.knock *= 1.7;
        }),
      ];
    case "grenade":
      return [
        card("gr-r", "Фугас", "Радиус взрыва +40%", "common", (r) => {
          r.wepStats.grenade.radius *= 1.4;
        }),
        card("gr-d", "Запал", "Урон зарядов +70% и чаще", "rare", (r) => {
          r.wepStats.grenade.dmg *= 1.7;
          r.wepStats.grenade.cd *= 0.85;
        }),
      ];
    case "emp":
      return [
        card("emp-r", "Поле", "Радиус EMP +40%", "common", (r) => {
          r.wepStats.emp.radius *= 1.4;
        }),
        card("emp-s", "Клетка", "Урон EMP +70% и замедление сильнее", "rare", (r) => {
          r.wepStats.emp.dmg *= 1.7;
          r.wepStats.emp.slow *= 1.7;
        }),
      ];
    case "orb":
      return [
        card("orb-d", "Шипы", "Урон орбит +40%", "common", (r) => {
          r.wepStats.orb.dmg *= 1.4;
        }),
        card("orb-n", "Рой", "Орбит больше, радиус +70%", "rare", (r) => {
          const count = r.wepStats.orb.count;
          r.wepStats.orb.count = count + Math.max(1, Math.round(count * 0.7));
          r.wepStats.orb.radius *= 1.7;
        }),
      ];
    default:
      return [];
  }
}

function withoutOnce(cards, host) {
  return cards.filter((c) => !(c.once && host && host[c.once]));
}

function unlockCard(spec) {
  return card(spec.id, spec.title, spec.desc, spec.rarity, (r) => {
    r.weapons[spec.id] = true;
    r.wepStats[spec.id] = defaultWep(spec.id);
  });
}

export function battlePool(run) {
  const cards = [...GENERAL];
  const weapons = run.weapons || {};

  cards.push(...withoutOnce(gunPool(run.gun?.branch), run.gun));
  if (run.gun && run.gun.branch == null) cards.push(...GUN_BRANCHES);

  if (weapons.drone && run.drone) {
    cards.push(...withoutOnce(dronePool(run.drone.branch), run.drone));
    if (run.drone.branch == null) cards.push(...DRONE_BRANCHES);
  }

  for (const spec of UNLOCKS) {
    if (!weapons[spec.id]) {
      cards.push(unlockCard(spec));
      continue;
    }
    if (spec.id !== "drone") cards.push(...secondaryUpgrades(spec.id));
  }

  return cards;
}

export function rollBattleOffer(run, n = 3, rng = Math.random) {
  const pool = battlePool(run);
  const out = [];
  const used = new Set();
  while (out.length < n) {
    const available = pool.filter((c) => !used.has(c.id));
    if (!available.length) break;
    const sum = available.reduce((acc, c) => acc + (RARITY_WEIGHT[c.rarity] || 1), 0);
    let roll = rng() * sum;
    let picked = available[0];
    for (const c of available) {
      roll -= RARITY_WEIGHT[c.rarity] || 1;
      if (roll <= 0) {
        picked = c;
        break;
      }
    }
    used.add(picked.id);
    out.push(picked);
  }
  return out;
}
