export function rayEnd(x, y, angle, w, h) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t = 1e9;
  let axis = "x";
  if (Math.abs(dx) > 1e-6) {
    const nt = dx > 0 ? (w - x) / dx : -x / dx;
    if (nt > 0.001 && nt < t) t = nt;
  }
  if (Math.abs(dy) > 1e-6) {
    const nt = dy > 0 ? (h - y) / dy : -y / dy;
    if (nt > 0.001 && nt < t) {
      t = nt;
      axis = "y";
    }
  }
  return { x: x + dx * t, y: y + dy * t, axis };
}

export function reflectAngle(angle, axis) {
  return axis === "x" ? Math.PI - angle : -angle;
}

function card(id, title, desc, apply) {
  return { id, title, desc, rarity: "legendary", apply };
}

function cutterCards(level) {
  if (level === 10) {
    return [
      card("cut-exec", "Казнь", "Враг ниже 25% здоровья умирает от луча", (r) => {
        r.wepStats.laser.execute = 0.25;
      }),
      card("cut-spread", "Огарок", "Горение перекидывается на следующего в линии", (r) => {
        r.wepStats.laser.burnSpread = true;
      }),
      card("cut-heat", "Накал", "Урон ×2 и луч бьёт чаще", (r) => {
        r.wepStats.laser.dmg *= 2;
        r.wepStats.laser.cd *= 0.6;
      }),
    ];
  }
  return [
    card("cut-hold", "Разрез", "Луч держится и жжёт всех в линии", (r) => {
      r.wepStats.laser.hold = 0.55;
    }),
    card("cut-ash", "Пепел", "Смерть от горения взрывается по соседям", (r) => {
      r.wepStats.laser.ash = true;
    }),
    card("cut-white", "Белый", "Урон ×3", (r) => {
      r.wepStats.laser.dmg *= 3;
    }),
  ];
}

function prismCards(level) {
  if (level === 10) {
    return [
      card("pr-spec", "Спектр", "+2 луча", (r) => {
        r.wepStats.laser.rays += 2;
      }),
      card("pr-lens", "Линза", "Лучи толще вдвое", (r) => {
        r.wepStats.laser.width *= 2;
      }),
      card("pr-fan", "Рассеяние", "Веер шире и луч бьёт чаще", (r) => {
        r.wepStats.laser.spread *= 1.8;
        r.wepStats.laser.cd *= 0.65;
      }),
    ];
  }
  return [
    card("pr-more", "Веер", "+3 луча", (r) => {
      r.wepStats.laser.rays += 3;
    }),
    card("pr-wide", "Полотна", "Каждый луч вдвое толще", (r) => {
      r.wepStats.laser.width *= 2;
    }),
    card("pr-spin", "Карусель", "Лучи крутятся вокруг ядра", (r) => {
      r.wepStats.laser.spin = true;
    }),
  ];
}

function mirrorCards(level) {
  if (level === 10) {
    return [
      card("mi-glass", "Второе стекло", "+1 отскок", (r) => {
        r.wepStats.laser.bounces += 1;
      }),
      card("mi-edge", "Кромка", "После отскока урон ×2", (r) => {
        r.wepStats.laser.edgeMul = 2;
      }),
      card("mi-spark", "Искра", "Отскок выпускает короткий боковой луч", (r) => {
        r.wepStats.laser.spark = true;
      }),
    ];
  }
  return [
    card("mi-loop", "Петля", "+2 отскока, урон на отскоках не падает", (r) => {
      r.wepStats.laser.bounces += 2;
      r.wepStats.laser.steady = true;
    }),
    card("mi-shard", "Осколки", "Каждый отскок даёт боковой луч", (r) => {
      r.wepStats.laser.shards = true;
    }),
    card("mi-back", "Бумеранг", "Отражённый луч возвращается к ядру и бьёт ещё раз", (r) => {
      r.wepStats.laser.boomerang = true;
    }),
  ];
}

export function laserStep(level, branch) {
  if (level === 5) {
    return {
      cards: [
        card("cut", "Резак", "Урон ×2. Цель горит и теряет ещё столько же урона за секунду", (r) => {
          r.wepStats.laser.branch = "cut";
          r.wepStats.laser.dmg *= 2;
          r.wepStats.laser.burn = 1;
        }),
        card("prism", "Призма", "Ещё 2 луча веером, каждый пробивает строй", (r) => {
          r.wepStats.laser.branch = "prism";
          r.wepStats.laser.rays = 3;
          r.wepStats.laser.spread = 0.28;
        }),
        card("mirror", "Зеркало", "Луч бьёт край экрана и отражается один раз", (r) => {
          r.wepStats.laser.branch = "mirror";
          r.wepStats.laser.bounces = 1;
          r.wepStats.laser.edgeMul = 1;
        }),
      ],
    };
  }
  const cards = branch === "cut" ? cutterCards(level) : branch === "prism" ? prismCards(level) : mirrorCards(level);
  return { cards };
}
