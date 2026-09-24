import { gunXpToNext } from "./gun.js";

export { gunXpToNext as droneXpToNext };

export const DRONE_COUNT_CAP = 6;
export const DRONE_CD_MIN = 0.07;

export function addDrones(drone, n) {
  drone.count = Math.min(DRONE_COUNT_CAP, drone.count + n);
}

export function hasten(drone, mul) {
  drone.cd = Math.max(DRONE_CD_MIN, drone.cd * mul);
}

function card(id, title, desc, apply, rarity = "legendary") {
  return { id, title, desc, rarity, apply };
}

const RARITY_WEIGHT = { common: 6, rare: 3, epic: 1 };

function at(id, title, desc, rarity, apply, once) {
  return { ...card(id, title, desc, apply, rarity), once };
}

function flockCards(level) {
  if (level === 10) {
    return [
      card("wing", "Эскадрилья", "+2 дрона", (r) => addDrones(r.drone, 2)),
      card("swarm-d", "Рой", "+1 дрон и стрельба быстрее", (r) => {
        addDrones(r.drone, 1);
        hasten(r.drone, 0.7);
      }),
      card("line", "Строй", "+2 дрона и урон +40%", (r) => {
        addDrones(r.drone, 2);
        r.drone.dmg *= 1.4;
      }),
    ];
  }
  return [
    card("carrier", "Авиагруппа", "+2 дрона", (r) => addDrones(r.drone, 2)),
    card("twin", "Спарка", "Каждый дрон стреляет 2 пулями", (r) => {
      r.drone.pellets += 1;
    }),
    card("flight", "Звено", "+1 дрон и стрельба намного быстрее", (r) => {
      addDrones(r.drone, 1);
      hasten(r.drone, 0.6);
    }),
  ];
}

function bombCards(level) {
  if (level === 10) {
    return [
      card("he", "Фугас", "Взрыв больше и больнее", (r) => {
        r.drone.bombs = true;
        r.drone.radius += 50;
        r.drone.bombMul += 0.8;
      }),
      card("carpet", "Ковёр", "Бомбы и +1 дрон", (r) => {
        r.drone.bombs = true;
        addDrones(r.drone, 1);
        r.drone.bombMul += 0.4;
      }),
      card("napalm", "Напалм", "Урон бомб ×2", (r) => {
        r.drone.bombs = true;
        r.drone.bombMul *= 2;
      }),
    ];
  }
  return [
    card("nuke", "Залп бомб", "Очень большой взрыв", (r) => {
      r.drone.bombs = true;
      r.drone.radius += 80;
      r.drone.bombMul += 1;
    }),
    card("cluster", "Кассеты", "Бомба взрывается при попадании", (r) => {
      r.drone.bombs = true;
      r.drone.bombOnHit = true;
      r.drone.bombMul += 0.6;
    }),
    card("arty", "Артобстрел", "Бомбы и стрельба быстрее", (r) => {
      r.drone.bombs = true;
      hasten(r.drone, 0.65);
      r.drone.radius += 30;
    }),
  ];
}

function huntCards(level) {
  if (level === 10) {
    return [
      card("ap-d", "Бронебой", "Пробивание +3 и урон +50%", (r) => {
        r.drone.pierce += 3;
        r.drone.dmg *= 1.5;
      }),
      card("snipe", "Снайпер", "Урон +80% и пули быстрее", (r) => {
        r.drone.dmg *= 1.8;
        r.drone.speed += 250;
      }),
      card("burst-d", "Очередь", "Стрельба намного быстрее", (r) => hasten(r.drone, 0.55)),
    ];
  }
  return [
    card("exec", "Казнь", "Урон дрона ×2", (r) => {
      r.drone.dmg *= 2;
    }),
    card("lance", "Пронзание", "Пробивание +4. Следующая цель получает 90%", (r) => {
      r.drone.pierce += 4;
      r.drone.falloff = 0.9;
    }),
    card("predator", "Хищник", "Урон +100% и стрельба быстрее", (r) => {
      r.drone.dmg *= 2;
      hasten(r.drone, 0.7);
    }),
  ];
}

export function dronePool(branch) {
  const shared = [
    at("d-cal", "Калибр", "Урон +40%", "common", (r) => (r.drone.dmg *= 1.4)),
    at("d-rate", "Темп", "Стрельба быстрее", "common", (r) => hasten(r.drone, 0.8)),
    at("d-rush", "Разгон", "Пули быстрее", "common", (r) => (r.drone.speed += 140)),
    at("d-range", "Дальность", "Пули живут дольше", "common", (r) => (r.drone.life += 0.35)),
    at("d-mass", "Масса", "Урон +40%", "common", (r) => (r.drone.dmg *= 1.4)),
    at("d-barrel", "Ствол", "Стрельба быстрее", "common", (r) => hasten(r.drone, 0.8)),
    at("d-press", "Нажим", "Урон +45%", "common", (r) => (r.drone.dmg *= 1.45)),
    at("d-trace", "След", "Пули живут дольше", "common", (r) => (r.drone.life += 0.3)),
    at("d-heavy", "Тяжёлый калибр", "Урон +70%", "rare", (r) => (r.drone.dmg *= 1.7)),
    at("d-boost", "Ускоритель", "Стрельба намного быстрее", "rare", (r) => hasten(r.drone, 0.65)),
    at("d-shell", "Снаряд", "Урон +50% и пули быстрее", "rare", (r) => {
      r.drone.dmg *= 1.5;
      r.drone.speed += 160;
    }),
    at("d-long", "Длинный выстрел", "Пули живут намного дольше", "rare", (r) => (r.drone.life += 0.6)),
    at("d-ap", "Бронебой", "Урон +40% и пробивание +2", "rare", (r) => {
      r.drone.dmg *= 1.4;
      r.drone.pierce += 2;
    }),
    at("d-force", "Форсаж", "Урон +80% и стрельба быстрее", "epic", (r) => {
      r.drone.dmg *= 1.8;
      hasten(r.drone, 0.75);
    }),
    at("d-gale", "Шквал", "Стрельба очень быстрая", "epic", (r) => hasten(r.drone, 0.55)),
    at("d-mono", "Монолит", "Урон +100%", "epic", (r) => (r.drone.dmg *= 2)),
  ];
  const branches = {
    flock: [
      at("f-one", "Ещё дрон", "+1 дрон", "common", (r) => addDrones(r.drone, 1)),
      at("f-rate", "Ритм", "Стрельба быстрее", "common", (r) => hasten(r.drone, 0.8)),
      at("f-dmg", "Залп звена", "Урон +25%", "common", (r) => (r.drone.dmg *= 1.25)),
      at("f-two", "Пара", "+1 дрон и урон +20%", "rare", (r) => {
        addDrones(r.drone, 1);
        r.drone.dmg *= 1.2;
      }),
      at("f-fast", "Рой+", "+1 дрон и стрельба быстрее", "rare", (r) => {
        addDrones(r.drone, 1);
        hasten(r.drone, 0.75);
      }),
      at("f-wing", "Крыло", "+2 дрона", "epic", (r) => addDrones(r.drone, 2)),
      at("f-spark", "Спарка", "Каждый дрон стреляет ещё одной пулей", "epic", (r) => {
        r.drone.pellets += 1;
        r.drone.extraPellet = true;
      }, "extraPellet"),
    ],
    bomb: [
      at("b-on", "Бомба", "Дроны сбрасывают бомбы", "common", (r) => {
        r.drone.bombs = true;
      }),
      at("b-rad", "Воронка", "Взрыв больше", "common", (r) => {
        r.drone.bombs = true;
        r.drone.radius += 28;
      }),
      at("b-dmg", "Заряд", "Бомбы больнее", "common", (r) => {
        r.drone.bombs = true;
        r.drone.bombMul += 0.5;
      }),
      at("b-wide", "Фугас", "Взрыв намного больше", "rare", (r) => {
        r.drone.bombs = true;
        r.drone.radius += 46;
        r.drone.bombMul += 0.4;
      }),
      at("b-hot", "Жар", "Урон бомб +80%", "rare", (r) => {
        r.drone.bombs = true;
        r.drone.bombMul += 0.8;
      }),
      at("b-hit", "Кассета", "Бомба взрывается при попадании", "epic", (r) => {
        r.drone.bombs = true;
        r.drone.bombOnHit = true;
      }, "bombOnHit"),
      at("b-epic", "Мина", "Огромный взрыв", "epic", (r) => {
        r.drone.bombs = true;
        r.drone.radius += 70;
        r.drone.bombMul += 1;
      }),
    ],
    hunt: [
      at("h-dmg", "Прицел", "Урон +40%", "common", (r) => (r.drone.dmg *= 1.4)),
      at("h-prc", "Игла", "Пробивание +2", "common", (r) => (r.drone.pierce += 2)),
      at("h-spd", "Разгон", "Пули быстрее", "common", (r) => (r.drone.speed += 160)),
      at("h-both", "Охота", "Урон +50% и пробивание +1", "rare", (r) => {
        r.drone.dmg *= 1.5;
        r.drone.pierce += 1;
      }),
      at("h-fast", "Рывок", "Урон +40% и стрельба быстрее", "rare", (r) => {
        r.drone.dmg *= 1.4;
        hasten(r.drone, 0.75);
      }),
      at("h-lance", "Копьё", "Пробивание +3 и урон +40%", "epic", (r) => {
        r.drone.pierce += 3;
        r.drone.dmg *= 1.4;
      }),
      at("h-kill", "Добыча", "Урон +100%", "epic", (r) => (r.drone.dmg *= 2)),
    ],
  };
  return branch && branches[branch] ? shared.concat(branches[branch]) : shared;
}

export function rollDroneOffer(branch, drone = {}, n = 3, rng = Math.random) {
  const pool = dronePool(branch).filter((c) => !(c.once && drone[c.once]));
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 40) {
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

export function droneStep(level, branch) {
  if (level === 5) {
    return {
      kind: "choice",
      sub: "Выбери ветку дрона. До конца забега она не меняется.",
      cards: [
        card("flock", "Стая", "+1 дрон и стрельба быстрее", (r) => {
          r.drone.branch = "flock";
          addDrones(r.drone, 1);
          hasten(r.drone, 0.7);
        }),
        card("bomb", "Бомбы", "Дроны сбрасывают бомбы", (r) => {
          r.drone.branch = "bomb";
          r.drone.bombs = true;
          r.drone.radius += 24;
        }),
        card("hunt", "Охота", "Урон +60%, пули быстрее, пробивание +1", (r) => {
          r.drone.branch = "hunt";
          r.drone.dmg *= 1.6;
          r.drone.speed += 200;
          r.drone.pierce += 1;
        }),
      ],
    };
  }
  if (level === 10 || level === 15) {
    const cards = branch === "flock" ? flockCards(level) : branch === "bomb" ? bombCards(level) : huntCards(level);
    return { kind: "choice", sub: "Легендарное улучшение дрона", cards };
  }
  return {
    kind: "choice",
    sub: "Три усиления дрона. Обычные выпадают чаще, эпики реже.",
    cards: rollDroneOffer(branch),
  };
}
