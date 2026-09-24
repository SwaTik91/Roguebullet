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

function card(id, title, desc, apply) {
  return { id, title, desc, rarity: "epic", apply };
}

function queueCards(level) {
  if (level === 10) {
    return [
      card("kazn", "Казнь", "Критический урон ×3", (r) => {
        r.crit.mul = 3;
      }),
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
  ];
}

function ricochetCards(level) {
  if (level === 10) {
    return [
      card("carousel", "Карусель", "+2 отскока", (r) => {
        r.gun.bounces += 2;
      }),
      card("edge", "Кромка", "После отскока урон пули +50%", (r) => {
        r.gun.edgeMul = 1.5;
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
  ];
}

function autoStep(level, branch) {
  const steps = {
    2: ["Урон +25%", (r) => (r.gun.dmg *= 1.25)],
    3: ["+1 выстрел в секунду", (r) => addRate(r.gun, 1)],
    4: ["Урон +25%", (r) => (r.gun.dmg *= 1.25)],
  };
  const byBranch = {
    queue: {
      6: ["+1 выстрел в секунду", (r) => addRate(r.gun, 1)],
      7: ["Шанс крита +6%", (r) => addCrit(r, 0.06)],
      8: ["Урон +20%", (r) => (r.gun.dmg *= 1.2)],
      9: ["+1 выстрел в секунду", (r) => addRate(r.gun, 1)],
      11: ["Шанс крита +6%", (r) => addCrit(r, 0.06)],
      12: ["Урон +20%", (r) => (r.gun.dmg *= 1.2)],
      13: ["+1 выстрел в секунду", (r) => addRate(r.gun, 1)],
      14: ["Шанс крита +6%", (r) => addCrit(r, 0.06)],
    },
    volley: {
      6: ["+1 пуля", (r) => (r.gun.pellets += 1)],
      7: ["Пробивание +1", (r) => (r.gun.pierce += 1)],
      8: ["Урон пули +20%", (r) => (r.gun.dmg *= 1.2)],
      9: ["+1 пуля", (r) => (r.gun.pellets += 1)],
      11: ["Урон пули +15%", (r) => (r.gun.dmg *= 1.15)],
      12: ["Пробивание +1", (r) => (r.gun.pierce += 1)],
      13: ["+1 пуля", (r) => (r.gun.pellets += 1)],
      14: ["Урон пули +15%", (r) => (r.gun.dmg *= 1.15)],
    },
    ricochet: {
      6: ["Урон +20%", (r) => (r.gun.dmg *= 1.2)],
      7: ["Пули живут дольше", (r) => (r.gun.life += 0.7)],
      8: ["+1 отскок", (r) => (r.gun.bounces += 1)],
      9: ["Урон +20%", (r) => (r.gun.dmg *= 1.2)],
      11: ["Урон +15%", (r) => (r.gun.dmg *= 1.15)],
      12: ["+1 отскок", (r) => (r.gun.bounces += 1)],
      13: ["Пули быстрее", (r) => (r.gun.speed += 160)],
      14: ["Урон +15%", (r) => (r.gun.dmg *= 1.15)],
    },
  };
  const row = steps[level] || byBranch[branch]?.[level];
  if (!row) return null;
  return { desc: row[0], apply: row[1] };
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
  const auto = autoStep(level, branch);
  return auto ? { kind: "auto", ...auto } : null;
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
