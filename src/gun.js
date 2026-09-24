export const GUN_RATE_CAP = 18;
export const GUN_CRIT_CAP = 0.75;

const XP_TO_NEXT = [0, 80, 100, 140, 180, 250, 300, 350, 400, 500, 700, 800, 900, 1100, 1400];

export function gunXpToNext(level) {
  return XP_TO_NEXT[level] || 0;
}

export function addRate(gun, amount) {
  gun.rate = Math.min(GUN_RATE_CAP, gun.rate + amount);
}

export function addCrit(run, amount) {
  run.crit.chance = Math.min(GUN_CRIT_CAP, run.crit.chance + amount);
}

function card(id, title, desc, apply, rarity = "legendary") {
  return { id, title, desc, rarity, apply };
}

const RARITY_WEIGHT = { common: 6, rare: 3, epic: 1 };

function addCritMul(run, amount) {
  run.crit.mul = Math.min(4, (run.crit.mul || 2) + amount);
}

function queueCards(level) {
  if (level === 10) {
    return [
      card("kazn", "Казнь", "Критический урон ×3", (r) => {
        r.crit.mul = Math.max(3, r.crit.mul || 2);
      }),
      card("edge-q", "Остриё", "Шанс крита +15%", (r) => addCrit(r, 0.15)),
      card("drum", "Барабан", "+3 выстрела в секунду, урон пули −10%", (r) => {
        addRate(r.gun, 3);
        r.gun.dmg *= 0.9;
      }),
    ];
  }
  return [
    card("series", "Серия", "После крита следующий выстрел тоже критический", (r) => {
      r.gun.series = true;
    }),
    card("counter", "Счётчик", "Каждый 4-й выстрел — гарантированный крит", (r) => {
      r.gun.every = 4;
    }),
    card("burst", "Раскат", "+4 выстрела в секунду и шанс крита +8%", (r) => {
      addRate(r.gun, 4);
      addCrit(r, 0.08);
    }),
  ];
}

function volleyCards(level) {
  if (level === 10) {
    return [
      card("fan", "Веер", "+2 пули, урон каждой −10%", (r) => {
        r.gun.pellets += 2;
        r.gun.dmg *= 0.9;
      }),
      card("pierce", "Пробой", "Пробивание +3", (r) => {
        r.gun.pierce += 3;
      }),
      card("buck", "Картечь", "+1 пуля и пробивание +2", (r) => {
        r.gun.pellets += 1;
        r.gun.pierce += 2;
      }),
    ];
  }
  return [
    card("wall", "Стена", "+3 пули, залп плотнее", (r) => {
      r.gun.pellets += 3;
      r.gun.gap = Math.max(6, r.gun.gap * 0.6);
    }),
    card("through", "Насквозь", "Пуля не останавливается. Следующая цель получает 75% урона", (r) => {
      r.gun.falloff = 0.75;
    }),
    card("curtain", "Завеса", "+2 пули и пробивание +1", (r) => {
      r.gun.pellets += 2;
      r.gun.pierce += 1;
    }),
  ];
}

function ricochetCards(level) {
  if (level === 10) {
    return [
      card("carousel", "Карусель", "+2 отскока", (r) => {
        r.gun.bounces += 2;
      }),
      card("edge", "Кромка", "После отскока урон пули +50%", (r) => {
        r.gun.edgeMul = Math.max(r.gun.edgeMul || 1, 1.5);
      }),
      card("bank", "Двойной край", "+1 отскок и урон после отскока +25%", (r) => {
        r.gun.bounces += 1;
        r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.25;
      }),
    ];
  }
  return [
    card("swarm", "Рой", "Удар о край выпускает короткую пулю в сторону, 50% урона", (r) => {
      r.gun.swarm = true;
    }),
    card("loop", "Петля", "+3 отскока, урон на отскоках не падает", (r) => {
      r.gun.bounces += 3;
    }),
    card("boom", "Бумеранг", "+2 отскока, пули живут дольше", (r) => {
      r.gun.bounces += 2;
      r.gun.life += 0.5;
    }),
  ];
}

function at(id, title, desc, rarity, apply, once) {
  return { ...card(id, title, desc, apply, rarity), once };
}

export function gunPool(branch) {
  const shared = [
    at("cal", "Калибр", "Урон +15%", "common", (r) => (r.gun.dmg *= 1.15)),
    at("tempo", "Темп", "+1 выстрел в секунду", "common", (r) => addRate(r.gun, 1)),
    at("rush", "Разгон", "Пули быстрее", "common", (r) => (r.gun.speed += 80)),
    at("range", "Дальность", "Пули живут дольше", "common", (r) => (r.gun.life += 0.35)),
    at("mass", "Масса", "Урон +12%", "common", (r) => (r.gun.dmg *= 1.12)),
    at("barrel", "Ствол", "+1 выстрел в секунду", "common", (r) => addRate(r.gun, 1)),
    at("trace", "След", "Пули живут дольше", "common", (r) => (r.gun.life += 0.25)),
    at("press", "Нажим", "Урон +18%", "common", (r) => (r.gun.dmg *= 1.18)),
    at("heavy", "Тяжёлый калибр", "Урон +30%", "rare", (r) => (r.gun.dmg *= 1.3)),
    at("boost", "Ускоритель", "+2 выстрела в секунду", "rare", (r) => addRate(r.gun, 2)),
    at("shell", "Снаряд", "Урон +20% и пули быстрее", "rare", (r) => {
      r.gun.dmg *= 1.2;
      r.gun.speed += 80;
    }),
    at("long", "Длинный ствол", "Пули живут заметно дольше", "rare", (r) => (r.gun.life += 0.6)),
    at("ap", "Бронебой", "Урон +15% и пробивание +1", "rare", (r) => {
      r.gun.dmg *= 1.15;
      r.gun.pierce += 1;
    }),
    at("force", "Форсаж", "Урон +40% и +1 выстрел в секунду", "epic", (r) => {
      r.gun.dmg *= 1.4;
      addRate(r.gun, 1);
    }),
    at("gale", "Шквал", "+3 выстрела в секунду", "epic", (r) => addRate(r.gun, 3)),
    at("mono", "Монолит", "Урон +50%", "epic", (r) => (r.gun.dmg *= 1.5)),
  ];
  const branches = {
    queue: [
      at("spark", "Искра", "Шанс крита +4%", "common", (r) => addCrit(r, 0.04)),
      at("rhythm", "Ритм", "+1 выстрел в секунду", "common", (r) => addRate(r.gun, 1)),
      at("hone", "Заточка", "Шанс крита +4% и урон +8%", "common", (r) => {
        addCrit(r, 0.04);
        r.gun.dmg *= 1.08;
      }),
      at("cadence", "Каденция", "Шанс крита +4%", "common", (r) => addCrit(r, 0.04)),
      at("sharp", "Острота", "Шанс крита +8%", "rare", (r) => addCrit(r, 0.08)),
      at("drumlet", "Дробный темп", "+2 выстрела в секунду", "rare", (r) => addRate(r.gun, 2)),
      at("keen", "Лезвие", "Критический урон +0.25", "rare", (r) => addCritMul(r, 0.25)),
      at("sight", "Прицел", "Шанс крита +6% и урон +10%", "rare", (r) => {
        addCrit(r, 0.06);
        r.gun.dmg *= 1.1;
      }),
      at("reprisal", "Расправа", "Шанс крита +12%", "epic", (r) => addCrit(r, 0.12)),
      at("stream", "Непрерывный", "+3 выстрела в секунду и шанс крита +4%", "epic", (r) => {
        addRate(r.gun, 3);
        addCrit(r, 0.04);
      }),
      at("cleave", "Рассечение", "Критический урон +0.5", "epic", (r) => addCritMul(r, 0.5)),
    ],
    volley: [
      at("pel1", "Веер", "+1 пуля", "common", (r) => (r.gun.pellets += 1)),
      at("prc1", "Пробой", "Пробивание +1", "common", (r) => (r.gun.pierce += 1)),
      at("pel1b", "Шире", "+1 пуля", "common", (r) => (r.gun.pellets += 1)),
      at("heavy-p", "Тяжёлая дробь", "Урон пули +12%", "common", (r) => (r.gun.dmg *= 1.12)),
      at("buck-r", "Картечь", "+2 пули, урон каждой −5%", "rare", (r) => {
        r.gun.pellets += 2;
        r.gun.dmg *= 0.95;
      }),
      at("prc2", "Сквозной", "Пробивание +2", "rare", (r) => (r.gun.pierce += 2)),
      at("salvo", "Залп+", "+1 пуля и урон +20%", "rare", (r) => {
        r.gun.pellets += 1;
        r.gun.dmg *= 1.2;
      }),
      at("wall-s", "Плотнее", "+3 пули, залп чуть плотнее", "epic", (r) => {
        r.gun.pellets += 3;
        r.gun.gap = Math.max(6, r.gun.gap * 0.85);
      }),
      at("drill", "Бур", "Пробивание +3", "epic", (r) => (r.gun.pierce += 3)),
      at("cloud", "Облако", "+2 пули и пробивание +1", "epic", (r) => {
        r.gun.pellets += 2;
        r.gun.pierce += 1;
      }),
    ],
    ricochet: [
      at("b1", "Отскок", "+1 отскок", "common", (r) => (r.gun.bounces += 1)),
      at("b1b", "Кромка", "+1 отскок", "common", (r) => (r.gun.bounces += 1)),
      at("live", "Живучесть", "Пули живут дольше", "common", (r) => (r.gun.life += 0.35)),
      at("ric-d", "Удар от края", "Урон +10%", "common", (r) => (r.gun.dmg *= 1.1)),
      at("b2", "Карусель", "+2 отскока", "rare", (r) => (r.gun.bounces += 2)),
      at("edge-r", "Закалка", "После отскока урон +25%", "rare", (r) => {
        r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.25;
      }),
      at("fast-b", "Быстрый отскок", "+1 отскок и пули быстрее", "rare", (r) => {
        r.gun.bounces += 1;
        r.gun.speed += 80;
      }),
      at("b3", "Петля", "+3 отскока", "epic", (r) => (r.gun.bounces += 3)),
      at("mirror", "Зеркало", "После отскока урон +50%", "epic", (r) => {
        r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.5;
      }),
      at("spark-s", "Искра от стены", "Удар о край выпускает короткую пулю, 50% урона", "epic", (r) => {
        r.gun.swarm = true;
      }, "swarm"),
    ],
  };
  return branch && branches[branch] ? shared.concat(branches[branch]) : shared;
}

export function rollGunOffer(branch, gun = {}, n = 3, rng = Math.random) {
  const pool = gunPool(branch).filter((c) => !(c.once && gun[c.once]));
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

export function gunStep(level, branch) {
  if (level === 5) {
    return {
      kind: "choice",
      sub: "Выбери ветку. До конца забега она не меняется.",
      cards: [
        card("queue", "Очередь", "+2 выстрела в секунду и шанс крита +10%", (r) => {
          r.gun.branch = "queue";
          addRate(r.gun, 2);
          addCrit(r, 0.1);
        }),
        card("volley", "Залп", "+2 пули в залпе и пробивание +1", (r) => {
          r.gun.branch = "volley";
          r.gun.pellets += 2;
          r.gun.pierce += 1;
        }),
        card("ricochet", "Рикошет", "Пули один раз отскакивают от края. Урон тот же", (r) => {
          r.gun.branch = "ricochet";
          r.gun.bounces += 1;
        }),
      ],
    };
  }
  if (level === 10 || level === 15) {
    const cards = branch === "queue" ? queueCards(level) : branch === "volley" ? volleyCards(level) : ricochetCards(level);
    return { kind: "choice", sub: "Легендарное улучшение ветки", cards };
  }
  return {
    kind: "choice",
    sub: "Три усиления. Обычные выпадают чаще, эпики реже.",
    cards: rollGunOffer(branch),
  };
}

export function rollGunShot(gun) {
  const chained = !!gun.forceNext;
  if (chained) gun.forceNext = false;
  gun.shot = (gun.shot || 0) + 1;
  const counted = gun.every > 0 && gun.shot % gun.every === 0;
  return { guaranteedCrit: chained || counted, canChain: !!gun.series && !chained };
}

export function reflectBullet(b, worldW, worldH) {
  if (!b.canBounce || b.life <= 0) return null;
  let hit = false;
  const min = 8;
  if (b.x < min && b.vx < 0) {
    b.x = min;
    b.vx *= -1;
    hit = true;
  } else if (b.x > worldW - min && b.vx > 0) {
    b.x = worldW - min;
    b.vx *= -1;
    hit = true;
  }
  if (b.y < min && b.vy < 0) {
    b.y = min;
    b.vy *= -1;
    hit = true;
  } else if (b.y > worldH - min && b.vy > 0) {
    b.y = worldH - min;
    b.vy *= -1;
    hit = true;
  }
  if (!hit) return null;
  if (b.bounces <= 0) {
    b.life = 0;
    return { died: true };
  }
  b.bounces -= 1;
  if (b.edgeMul && b.edgeMul !== 1 && !b.edged) {
    b.dmg *= b.edgeMul;
    b.edged = true;
  }
  return { died: false, swarm: !!b.swarm };
}

export function bulletShouldStop(b) {
  if (b.falloff) {
    b.dmg *= b.falloff;
    return false;
  }
  if (!b.pierce) return true;
  b.pierce -= 1;
  return b.pierce < 0;
}
