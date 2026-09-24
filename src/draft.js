import { defaultWep } from "./content.js";
import { dronePool, droneStep } from "./drone.js";
import { addCrit, gunPool, gunStep } from "./gun.js";

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

const SIDE_LEGEND = {
  laser: {
    5: [
      card("laser-l5a", "Прожиг", "Урон лазера ×2", "legendary", (r) => (r.wepStats.laser.dmg *= 2)),
      card("laser-l5b", "Полотно", "Луч вдвое толще", "legendary", (r) => (r.wepStats.laser.width *= 2)),
      card("laser-l5c", "Импульс луча", "Лазер бьёт вдвое чаще", "legendary", (r) => (r.wepStats.laser.cd *= 0.5)),
    ],
    10: [
      card("laser-l10a", "Резак", "Урон лазера ×2", "legendary", (r) => (r.wepStats.laser.dmg *= 2)),
      card("laser-l10b", "Завеса", "Луч ещё вдвое толще", "legendary", (r) => (r.wepStats.laser.width *= 2)),
      card("laser-l10c", "Непрерывный", "Лазер бьёт ещё чаще", "legendary", (r) => (r.wepStats.laser.cd *= 0.6)),
    ],
    15: [
      card("laser-l15a", "Сверхновый", "Урон лазера ×3", "legendary", (r) => (r.wepStats.laser.dmg *= 3)),
      card("laser-l15b", "Горизонт", "Луч заполняет сектор", "legendary", (r) => (r.wepStats.laser.width += 18)),
      card("laser-l15c", "Спектр", "Урон ×2 и луч чаще", "legendary", (r) => {
        r.wepStats.laser.dmg *= 2;
        r.wepStats.laser.cd *= 0.7;
      }),
    ],
  },
  scatter: {
    5: [
      card("sc-l5a", "Шрапнель", "+6 дробинок", "legendary", (r) => (r.wepStats.scatter.n += 6)),
      card("sc-l5b", "Таран", "Урон дроби ×2", "legendary", (r) => (r.wepStats.scatter.dmg *= 2)),
      card("sc-l5c", "Отбой", "Отброс ×2", "legendary", (r) => (r.wepStats.scatter.knock *= 2)),
    ],
    10: [
      card("sc-l10a", "Облако", "+8 дробинок", "legendary", (r) => (r.wepStats.scatter.n += 8)),
      card("sc-l10b", "Молот", "Урон дроби ×2", "legendary", (r) => (r.wepStats.scatter.dmg *= 2)),
      card("sc-l10c", "Частый залп", "Дробь стреляет чаще", "legendary", (r) => (r.wepStats.scatter.cd *= 0.6)),
    ],
    15: [
      card("sc-l15a", "Буря", "+10 дробинок и урон ×2", "legendary", (r) => {
        r.wepStats.scatter.n += 10;
        r.wepStats.scatter.dmg *= 2;
      }),
      card("sc-l15b", "Стена дроби", "Отброс ×2 и урон ×2", "legendary", (r) => {
        r.wepStats.scatter.knock *= 2;
        r.wepStats.scatter.dmg *= 2;
      }),
      card("sc-l15c", "Автомат", "Дробь стреляет вдвое чаще", "legendary", (r) => (r.wepStats.scatter.cd *= 0.5)),
    ],
  },
  grenade: {
    5: [
      card("gr-l5a", "Воронка", "Радиус ×2", "legendary", (r) => (r.wepStats.grenade.radius *= 2)),
      card("gr-l5b", "Бризант", "Урон заряда ×2", "legendary", (r) => (r.wepStats.grenade.dmg *= 2)),
      card("gr-l5c", "Серия", "Заряды вдвое чаще", "legendary", (r) => (r.wepStats.grenade.cd *= 0.5)),
    ],
    10: [
      card("gr-l10a", "Кратер", "Радиус ещё ×1.6", "legendary", (r) => (r.wepStats.grenade.radius *= 1.6)),
      card("gr-l10b", "Тонна", "Урон ×2", "legendary", (r) => (r.wepStats.grenade.dmg *= 2)),
      card("gr-l10c", "Канонада", "Заряды чаще и больнее", "legendary", (r) => {
        r.wepStats.grenade.cd *= 0.7;
        r.wepStats.grenade.dmg *= 1.5;
      }),
    ],
    15: [
      card("gr-l15a", "Эпицентр", "Радиус ×2 и урон ×2", "legendary", (r) => {
        r.wepStats.grenade.radius *= 2;
        r.wepStats.grenade.dmg *= 2;
      }),
      card("gr-l15b", "Ковёр", "Заряды вдвое чаще", "legendary", (r) => (r.wepStats.grenade.cd *= 0.5)),
      card("gr-l15c", "Осадный", "Урон ×3", "legendary", (r) => (r.wepStats.grenade.dmg *= 3)),
    ],
  },
  emp: {
    5: [
      card("emp-l5a", "Купол", "Радиус EMP ×2", "legendary", (r) => (r.wepStats.emp.radius *= 2)),
      card("emp-l5b", "Разряд", "Урон EMP ×2", "legendary", (r) => (r.wepStats.emp.dmg *= 2)),
      card("emp-l5c", "Ступор", "Замедление сильнее", "legendary", (r) => (r.wepStats.emp.slow += 0.25)),
    ],
    10: [
      card("emp-l10a", "Полусфера", "Радиус ещё ×1.5", "legendary", (r) => (r.wepStats.emp.radius *= 1.5)),
      card("emp-l10b", "Шторм", "Урон ×2", "legendary", (r) => (r.wepStats.emp.dmg *= 2)),
      card("emp-l10c", "Частый пульс", "EMP срабатывает чаще", "legendary", (r) => (r.wepStats.emp.cd *= 0.6)),
    ],
    15: [
      card("emp-l15a", "Тишина", "Радиус ×2 и сильнее замедление", "legendary", (r) => {
        r.wepStats.emp.radius *= 2;
        r.wepStats.emp.slow += 0.2;
      }),
      card("emp-l15b", "Перегрузка", "Урон ×3", "legendary", (r) => (r.wepStats.emp.dmg *= 3)),
      card("emp-l15c", "Метроном", "EMP вдвое чаще", "legendary", (r) => (r.wepStats.emp.cd *= 0.5)),
    ],
  },
  orb: {
    5: [
      card("orb-l5a", "Кольцо", "+2 орбиты", "legendary", (r) => (r.wepStats.orb.count += 2)),
      card("orb-l5b", "Шипы+", "Урон орбит ×2", "legendary", (r) => (r.wepStats.orb.dmg *= 2)),
      card("orb-l5c", "Орбита шире", "Радиус ×1.6", "legendary", (r) => (r.wepStats.orb.radius *= 1.6)),
    ],
    10: [
      card("orb-l10a", "Рой+", "+2 орбиты", "legendary", (r) => (r.wepStats.orb.count += 2)),
      card("orb-l10b", "Иглы", "Урон ×2", "legendary", (r) => (r.wepStats.orb.dmg *= 2)),
      card("orb-l10c", "Карусель", "Орбиты крутятся быстрее", "legendary", (r) => (r.wepStats.orb.spin *= 1.8)),
    ],
    15: [
      card("orb-l15a", "Сфера", "+3 орбиты и урон ×2", "legendary", (r) => {
        r.wepStats.orb.count += 3;
        r.wepStats.orb.dmg *= 2;
      }),
      card("orb-l15b", "Ореол", "Радиус ×2", "legendary", (r) => (r.wepStats.orb.radius *= 2)),
      card("orb-l15c", "Вихрь", "Урон ×3", "legendary", (r) => (r.wepStats.orb.dmg *= 3)),
    ],
  },
};

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
  const who = UNLOCKS.find((spec) => spec.id === weaponKey)?.title || weaponKey;
  return tag(SIDE_LEGEND[weaponKey]?.[next] || [], who);
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
