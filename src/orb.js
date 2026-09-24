function card(id, title, desc, apply) {
  return { id, title, desc, rarity: "legendary", apply };
}

function bladeCards(level) {
  if (level === 10) {
    return [
      card("bl-teeth", "Зубья", "+4 лезвия", (r) => {
        r.wepStats.orb.count += 4;
      }),
      card("bl-arc", "Размах", "Дуга лезвия вдвое длиннее", (r) => {
        r.wepStats.orb.reach *= 2;
      }),
      card("bl-hone", "Заточка", "Урон ×2 и оборот вдвое быстрее", (r) => {
        r.wepStats.orb.dmg *= 2;
        r.wepStats.orb.spin *= 2;
      }),
    ];
  }
  return [
    card("bl-saw", "Пила", "Лезвия смыкаются и режут всё кольцо", (r) => {
      r.wepStats.orb.saw = true;
    }),
    card("bl-inner", "Ближний круг", "Второе кольцо лезвий у ядра", (r) => {
      r.wepStats.orb.inner = true;
    }),
    card("bl-bleed", "Кровоток", "Порез жжёт ещё секунду тем же уроном", (r) => {
      r.wepStats.orb.bleed = true;
    }),
  ];
}

function wardCards(level) {
  if (level === 10) {
    return [
      card("wd-stock", "Запас", "Блок копится до двух зарядов", (r) => {
        r.wepStats.orb.guardMax = 2;
      }),
      card("wd-back", "Отдача", "Съеденный удар бьёт врага его уроном ×3", (r) => {
        r.wepStats.orb.reflect = true;
      }),
      card("wd-hold", "Упор", "Пока щит цел, враг на кольце почти стоит", (r) => {
        r.wepStats.orb.pin = true;
      }),
    ];
  }
  return [
    card("wd-wall", "Стена", "Враги не проходят кольцо, пока есть заряд", (r) => {
      r.wepStats.orb.wall = true;
    }),
    card("wd-flash", "Вспышка", "Съеденный удар взрывается по кольцу", (r) => {
      r.wepStats.orb.flash = true;
    }),
    card("wd-mend", "Отклик", "Каждый блок лечит ядро на 120 HP", (r) => {
      r.wepStats.orb.mend = 120;
    }),
  ];
}

function lungeCards(level) {
  if (level === 10) {
    return [
      card("lg-series", "Серия", "Выпады вдвое чаще", (r) => {
        r.wepStats.orb.lungeCd *= 0.5;
      }),
      card("lg-through", "Насквозь", "Удар ранит всех на пути к цели", (r) => {
        r.wepStats.orb.through = true;
      }),
      card("lg-hook", "Крюк", "После удара сфера бьёт ещё одну цель", (r) => {
        r.wepStats.orb.hook = true;
      }),
    ];
  }
  return [
    card("lg-salvo", "Залп", "Все сферы разом бьют в самую густую группу", (r) => {
      r.wepStats.orb.salvo = true;
    }),
    card("lg-anchor", "Якорь", "Сфера висит на враге и бьёт, пока тот жив", (r) => {
      r.wepStats.orb.anchor = true;
    }),
    card("lg-comet", "Комета", "Удар выпада ×3", (r) => {
      r.wepStats.orb.lungeMul *= 3;
    }),
  ];
}

export function orbStep(level, branch) {
  if (level === 5) {
    return {
      cards: [
        card("blade", "Серп", "Каждая сфера становится лезвием, режет втрое шире и бьёт ×2", (r) => {
          const o = r.wepStats.orb;
          o.branch = "blade";
          o.dmg *= 2;
          o.reach = 3;
        }),
        card("ward", "Барьер", "Кольцо отталкивает врагов и съедает один удар по ядру. Заряд возвращается за 4 с", (r) => {
          const o = r.wepStats.orb;
          o.branch = "ward";
          o.guardMax = 1;
          o.guard = 1;
          o.guardCd = 4;
          o.guardT = 4;
          o.knock = 70;
        }),
        card("lunge", "Выпад", "Каждая сфера срывается к ближайшему врагу, бьёт разово ×8 и возвращается", (r) => {
          const o = r.wepStats.orb;
          o.branch = "lunge";
          o.lunge = true;
          o.lungeCd = 1.3;
          o.lungeT = 0.4;
          o.lungeMul = 8;
          o.fly = [];
        }),
      ],
    };
  }
  const cards = branch === "blade" ? bladeCards(level) : branch === "ward" ? wardCards(level) : lungeCards(level);
  return { cards };
}
