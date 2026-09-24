export const GUN_RATE_CAP = 24;
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
      card("edge-q", "Остриё", "Шанс крита +20%", (r) => addCrit(r, 0.2)),
      card("drum", "Барабан", "+5 выстрелов в секунду", (r) => addRate(r.gun, 5)),
    ];
  }
  return [
    card("series", "Серия", "После крита следующий выстрел тоже критический", (r) => {
      r.gun.series = true;
    }),
    card("counter", "Счётчик", "Каждый 4-й выстрел — гарантированный крит", (r) => {
      r.gun.every = 4;
    }),
    card("burst", "Раскат", "+6 выстрелов в секунду и шанс крита +12%", (r) => {
      addRate(r.gun, 6);
      addCrit(r, 0.12);
    }),
  ];
}

function volleyCards(level) {
  if (level === 10) {
    return [
      card("fan", "Веер", "+4 пули", (r) => {
        r.gun.pellets += 4;
      }),
      card("pierce", "Пробой", "Пробивание +6 и урон +25%", (r) => {
        r.gun.pierce += 6;
        r.gun.dmg *= 1.25;
      }),
      card("buck", "Картечь", "+2 пули и пробивание +4", (r) => {
        r.gun.pellets += 2;
        r.gun.pierce += 4;
      }),
    ];
  }
  return [
    card("wall", "Стена", "+4 пули, залп плотнее", (r) => {
      r.gun.pellets += 4;
      r.gun.gap = Math.max(6, r.gun.gap * 0.6);
    }),
    card("through", "Насквозь", "Пуля не останавливается. Следующая цель получает 90% урона", (r) => {
      r.gun.falloff = 0.9;
    }),
    card("curtain", "Завеса", "+3 пули и пробивание +4", (r) => {
      r.gun.pellets += 3;
      r.gun.pierce += 4;
    }),
  ];
}

function ricochetCards(level) {
  if (level === 10) {
    return [
      card("carousel", "Карусель", "+3 отскока", (r) => {
        r.gun.bounces += 3;
      }),
      card("edge", "Кромка", "После каждого отскока урон пули ×2", (r) => {
        r.gun.edgeMul = Math.max(r.gun.edgeMul || 1, 2);
      }),
      card("bank", "Двойной край", "+2 отскока и урон после отскока +50%", (r) => {
        r.gun.bounces += 2;
        r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.5;
      }),
    ];
  }
  return [
    card("swarm", "Рой", "Удар о край выпускает короткую пулю в сторону, 80% урона", (r) => {
      r.gun.swarm = true;
    }),
    card("loop", "Петля", "+4 отскока, урон на отскоках не падает", (r) => {
      r.gun.bounces += 4;
    }),
    card("boom", "Бумеранг", "+3 отскока, пули живут дольше", (r) => {
      r.gun.bounces += 3;
      r.gun.life += 0.8;
    }),
  ];
}

function at(id, title, desc, rarity, apply, once) {
  return { ...card(id, title, desc, apply, rarity), once };
}

export function gunPool(branch) {
  const shared = [
    at("cal", "Калибр", "Урон +40%", "common", (r) => (r.gun.dmg *= 1.4)),
    at("tempo", "Темп", "+2 выстрела в секунду", "common", (r) => addRate(r.gun, 2)),
    at("rush", "Разгон", "Пули заметно быстрее", "common", (r) => (r.gun.speed += 160)),
    at("range", "Дальность", "Пули живут дольше", "common", (r) => (r.gun.life += 0.6)),
    at("mass", "Масса", "Урон +40%", "common", (r) => (r.gun.dmg *= 1.4)),
    at("barrel", "Ствол", "+2 выстрела в секунду", "common", (r) => addRate(r.gun, 2)),
    at("trace", "След", "Пули живут дольше", "common", (r) => (r.gun.life += 0.5)),
    at("press", "Нажим", "Урон +45%", "common", (r) => (r.gun.dmg *= 1.45)),
    at("heavy", "Тяжёлый калибр", "Урон +70%", "rare", (r) => (r.gun.dmg *= 1.7)),
    at("boost", "Ускоритель", "+4 выстрела в секунду", "rare", (r) => addRate(r.gun, 4)),
    at("shell", "Снаряд", "Урон +50% и пули быстрее", "rare", (r) => {
      r.gun.dmg *= 1.5;
      r.gun.speed += 160;
    }),
    at("long", "Длинный ствол", "Пули живут намного дольше", "rare", (r) => (r.gun.life += 1)),
    at("ap", "Бронебой", "Урон +40% и пробивание +2", "rare", (r) => {
      r.gun.dmg *= 1.4;
      r.gun.pierce += 2;
    }),
    at("force", "Форсаж", "Урон +80% и +3 выстрела в секунду", "epic", (r) => {
      r.gun.dmg *= 1.8;
      addRate(r.gun, 3);
    }),
    at("gale", "Шквал", "+6 выстрелов в секунду", "epic", (r) => addRate(r.gun, 6)),
    at("mono", "Монолит", "Урон +100%", "epic", (r) => (r.gun.dmg *= 2)),
  ];
  const branches = {
    queue: [
      at("spark", "Искра", "Шанс крита +8%", "common", (r) => addCrit(r, 0.08)),
      at("rhythm", "Ритм", "+2 выстрела в секунду", "common", (r) => addRate(r.gun, 2)),
      at("hone", "Заточка", "Шанс крита +8% и урон +25%", "common", (r) => {
        addCrit(r, 0.08);
        r.gun.dmg *= 1.25;
      }),
      at("cadence", "Каденция", "Шанс крита +8%", "common", (r) => addCrit(r, 0.08)),
      at("sharp", "Острота", "Шанс крита +14%", "rare", (r) => addCrit(r, 0.14)),
      at("drumlet", "Дробный темп", "+4 выстрела в секунду", "rare", (r) => addRate(r.gun, 4)),
      at("keen", "Лезвие", "Критический урон +0.5", "rare", (r) => addCritMul(r, 0.5)),
      at("sight", "Прицел", "Шанс крита +12% и урон +30%", "rare", (r) => {
        addCrit(r, 0.12);
        r.gun.dmg *= 1.3;
      }),
      at("reprisal", "Расправа", "Шанс крита +20%", "epic", (r) => addCrit(r, 0.2)),
      at("stream", "Непрерывный", "+5 выстрелов в секунду и шанс крита +10%", "epic", (r) => {
        addRate(r.gun, 5);
        addCrit(r, 0.1);
      }),
      at("cleave", "Рассечение", "Критический урон +1", "epic", (r) => addCritMul(r, 1)),
    ],
    volley: [
      at("pel1", "Веер", "+2 пули", "common", (r) => (r.gun.pellets += 2)),
      at("prc1", "Пробой", "Пробивание +4", "common", (r) => (r.gun.pierce += 4)),
      at("pel1b", "Шире", "+2 пули", "common", (r) => (r.gun.pellets += 2)),
      at("heavy-p", "Тяжёлая дробь", "Урон пули +40%", "common", (r) => (r.gun.dmg *= 1.4)),
      at("buck-r", "Картечь", "+3 пули", "rare", (r) => {
        r.gun.pellets += 3;
      }),
      at("prc2", "Сквозной", "Пробивание +5", "rare", (r) => (r.gun.pierce += 5)),
      at("salvo", "Залп+", "+2 пули и урон +40%", "rare", (r) => {
        r.gun.pellets += 2;
        r.gun.dmg *= 1.4;
      }),
      at("wall-s", "Плотнее", "+4 пули, залп плотнее", "epic", (r) => {
        r.gun.pellets += 4;
        r.gun.gap = Math.max(6, r.gun.gap * 0.7);
      }),
      at("drill", "Бур", "Пробивание +7", "epic", (r) => (r.gun.pierce += 7)),
      at("cloud", "Облако", "+3 пули и пробивание +4", "epic", (r) => {
        r.gun.pellets += 3;
        r.gun.pierce += 4;
      }),
    ],
    ricochet: [
      at("b1", "Отскок", "+2 отскока", "common", (r) => (r.gun.bounces += 2)),
      at("b1b", "Кромка", "+2 отскока", "common", (r) => (r.gun.bounces += 2)),
      at("live", "Живучесть", "Пули живут дольше", "common", (r) => (r.gun.life += 0.6)),
      at("ric-d", "Удар от края", "Урон +40%", "common", (r) => (r.gun.dmg *= 1.4)),
      at("b2", "Карусель", "+3 отскока", "rare", (r) => (r.gun.bounces += 3)),
      at("edge-r", "Закалка", "После отскока урон +50%", "rare", (r) => {
        r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.5;
      }),
      at("fast-b", "Быстрый отскок", "+2 отскока и пули быстрее", "rare", (r) => {
        r.gun.bounces += 2;
        r.gun.speed += 160;
      }),
      at("b3", "Петля", "+4 отскока", "epic", (r) => (r.gun.bounces += 4)),
      at("mirror", "Зеркало", "После отскока урон ×2", "epic", (r) => {
        r.gun.edgeMul = (r.gun.edgeMul || 1) * 2;
      }),
      at("spark-s", "Искра от стены", "Удар о край выпускает короткую пулю, 80% урона", "epic", (r) => {
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
        card("queue", "Очередь", "+4 выстрела в секунду и шанс крита +15%", (r) => {
          r.gun.branch = "queue";
          addRate(r.gun, 4);
          addCrit(r, 0.15);
        }),
        card("volley", "Залп", "+3 пули, пробивание +6, урон +35%. Пули толще и живут дольше", (r) => {
          r.gun.branch = "volley";
          r.gun.pellets += 3;
          r.gun.pierce += 6;
          r.gun.dmg *= 1.35;
          r.gun.life += 0.45;
        }),
        card("ricochet", "Рикошет", "4 отскока. Каждый отскок +45% урона, пуля дольше живёт и ищет цель", (r) => {
          r.gun.branch = "ricochet";
          r.gun.bounces += 4;
          r.gun.edgeMul = (r.gun.edgeMul || 1) * 1.45;
          r.gun.life += 0.9;
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
  if (b.edgeMul && b.edgeMul !== 1) {
    if (b.baseDmg == null) b.baseDmg = b.dmg;
    b.dmg = Math.min(b.dmg * b.edgeMul, b.baseDmg * 3);
    b.edged = true;
    b.color = "#fde68a";
  } else {
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
