function card(id, title, desc, apply) {
  return { id, title, desc, rarity: "legendary", apply };
}

function wedgeCards(level) {
  if (level === 10) {
    return [
      card("wd-lane", "Просека", "Клин вытягивается в длинную полосу", (r) => {
        r.wepStats.grenade.reach = 2.4;
      }),
      card("wd-cross", "Крест", "Поперёк бьёт вторая полоса", (r) => {
        r.wepStats.grenade.shape = "cross";
      }),
      card("wd-briz", "Бризант", "Урон ×2 и заряды чаще", (r) => {
        r.wepStats.grenade.dmg *= 2;
        r.wepStats.grenade.cd *= 0.7;
      }),
    ];
  }
  return [
    card("wd-rift", "Расселина", "Фигура бьёт до края экрана", (r) => {
      r.wepStats.grenade.reach = 8;
    }),
    card("wd-star", "Звезда", "Из взрыва бьют четыре полосы", (r) => {
      r.wepStats.grenade.shape = "star";
    }),
    card("wd-slab", "Пласт", "Фигура втрое шире и урон ×2", (r) => {
      r.wepStats.grenade.width = (r.wepStats.grenade.width || 0.7) * 3;
      r.wepStats.grenade.dmg *= 2;
    }),
  ];
}

function cassCards(level) {
  if (level === 10) {
    return [
      card("cs-eight", "Гроздь", "8 бомб вместо 4", (r) => {
        r.wepStats.grenade.bombs = 8;
      }),
      card("cs-core", "Ядро", "В центре остаётся полный взрыв", (r) => {
        r.wepStats.grenade.core = true;
      }),
      card("cs-twin", "Дубль", "Следом летит вторая кассета", (r) => {
        r.wepStats.grenade.twin = true;
      }),
    ];
  }
  return [
    card("cs-rain", "Ливень", "12 бомб по широкой дуге", (r) => {
      r.wepStats.grenade.bombs = 12;
      r.wepStats.grenade.bombSpread = 1.6;
    }),
    card("cs-wave", "Вторая волна", "Каждая бомба взрывается ещё раз", (r) => {
      r.wepStats.grenade.twice = true;
    }),
    card("cs-war", "Боеголовка", "Урон бомб ×3", (r) => {
      r.wepStats.grenade.bombMul *= 3;
    }),
  ];
}

function craterCards(level) {
  if (level === 10) {
    return [
      card("cr-resin", "Смола", "Замедление не спадает, пока враг в луже", (r) => {
        r.wepStats.grenade.resin = true;
      }),
      card("cr-pull", "Омут", "Врагов стягивает к центру лужи", (r) => {
        r.wepStats.grenade.pull = true;
      }),
      card("cr-heat", "Пекло", "Урон лужи и взрыва ×2", (r) => {
        r.wepStats.grenade.dmg *= 2;
        r.wepStats.grenade.poolDmg *= 2;
      }),
    ];
  }
  return [
    card("cr-all", "Топь", "Лужа на весь экран", (r) => {
      r.wepStats.grenade.poolAll = true;
    }),
    card("cr-pit", "Яма", "Враги в луже замирают на 2 секунды", (r) => {
      r.wepStats.grenade.pit = 2;
    }),
    card("cr-magma", "Магма", "Урон лужи ×3, смерть в ней взрывается", (r) => {
      r.wepStats.grenade.poolDmg *= 3;
      r.wepStats.grenade.magma = true;
    }),
  ];
}

export function grenadeStep(level, branch) {
  if (level === 5) {
    return {
      cards: [
        card("wedge", "Клин", "Широкий клин вперёд по курсу, урон ×2", (r) => {
          const g = r.wepStats.grenade;
          g.branch = "wedge";
          g.shape = "wedge";
          g.dmg *= 2;
          g.width = 0.7;
          g.reach = 1.3;
        }),
        card("cassette", "Кассета", "На взрыве 4 бомбы рвутся вокруг цели", (r) => {
          const g = r.wepStats.grenade;
          g.branch = "cassette";
          g.bombs = 4;
          g.bombMul = 0.55;
          g.bombSpread = 1;
        }),
        card("crater", "Кратер", "3 секунды лужа: враги еле ползут и получают урон каждую секунду", (r) => {
          const g = r.wepStats.grenade;
          g.branch = "crater";
          g.pool = 3;
          g.poolDmg = g.dmg * 0.35;
        }),
      ],
    };
  }
  const cards = branch === "wedge" ? wedgeCards(level) : branch === "cassette" ? cassCards(level) : craterCards(level);
  return { cards };
}
