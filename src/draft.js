import { defaultWep } from "./content.js";
import { dronePool, droneStep } from "./drone.js";
import { empStep } from "./emp.js";
import { grenadeStep } from "./grenade.js";
import { orbStep } from "./orb.js";
import { scatterStep } from "./scatter.js";
import { addCrit, gunPool, gunStep } from "./gun.js";
import { laserStep } from "./laser.js";

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

function tag(cards, who) {
  return cards.map((c) => ({ ...c, who }));
}

function withoutOnce(cards, host) {
  return cards.filter((c) => !(c.once && host && host[c.once]));
}

function unlockCard(spec) {
  return { ...card(spec.id, spec.title, spec.desc, spec.rarity, (r) => {
    r.weapons[spec.id] = true;
    r.wepStats[spec.id] = defaultWep(spec.id);
  }), unlock: true };
}

export function weaponMilestone(pipCount) {
  const next = pipCount + 1;
  if (next === 5 || next === 10 || next === 15) return next;
  return 0;
}

export function legendaryOffer(run, weaponKey) {
  const next = weaponMilestone((run.pips?.[weaponKey] || []).length);
  if (!next) return [];
  if (weaponKey === "gun") {
    const level = run.gun?.branch ? next : 5;
    return tag(gunStep(level, run.gun?.branch).cards, "Пулемёт");
  }
  if (weaponKey === "drone") {
    const level = run.drone?.branch ? next : 5;
    return tag(droneStep(level, run.drone?.branch).cards, "Дрон");
  }
  if (weaponKey === "laser") {
    const laser = run.wepStats?.laser;
    const level = laser?.branch ? next : 5;
    return tag(laserStep(level, laser?.branch).cards, "Лазер");
  }
  if (weaponKey === "emp") {
    const emp = run.wepStats?.emp;
    const level = emp?.branch ? next : 5;
    return tag(empStep(level, emp?.branch).cards, "Импульс");
  }
  if (weaponKey === "scatter") {
    const scatter = run.wepStats?.scatter;
    const level = scatter?.branch ? next : 5;
    return tag(scatterStep(level, scatter?.branch).cards, "Дробь");
  }
  if (weaponKey === "grenade") {
    const grenade = run.wepStats?.grenade;
    const level = grenade?.branch ? next : 5;
    return tag(grenadeStep(level, grenade?.branch).cards, "Заряд");
  }
  if (weaponKey === "orb") {
    const orb = run.wepStats?.orb;
    const level = orb?.branch ? next : 5;
    return tag(orbStep(level, orb?.branch).cards, "Орбиты");
  }
  return [];
}

function invested(run, key) {
  return (run.pips?.[key] || []).length;
}

export function battlePool(run) {
  const cards = tag(GENERAL, "Общая карта");
  const weapons = run.weapons || {};

  if (invested(run, "gun") < 15) cards.push(...tag(withoutOnce(gunPool(run.gun?.branch), run.gun), "Пулемёт"));

  if (weapons.drone && run.drone && invested(run, "drone") < 15) {
    cards.push(...tag(withoutOnce(dronePool(run.drone.branch), run.drone), "Дрон"));
  }

  for (const spec of UNLOCKS) {
    if (!weapons[spec.id]) {
      cards.push({ ...unlockCard(spec), who: spec.title });
      continue;
    }
    if (spec.id !== "drone" && invested(run, spec.id) < 15) cards.push(...tag(secondaryUpgrades(spec.id), spec.title));
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
