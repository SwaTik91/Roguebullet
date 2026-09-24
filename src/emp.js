function card(id, title, desc, apply) {
  return { id, title, desc, rarity: "legendary", apply };
}

function cageCards(level) {
  if (level === 10) {
    return [
      card("cg-ice", "Лёд", "На секунду полная остановка", (r) => {
        r.wepStats.emp.freeze = 1;
      }),
      card("cg-trap", "Капкан", "Замедление не спадает, пока враг внутри радиуса", (r) => {
        r.wepStats.emp.trap = true;
      }),
      card("cg-mute", "Глушь", "Замедление держится вдвое дольше", (r) => {
        r.wepStats.emp.slowDur *= 2;
      }),
    ];
  }
  return [
    card("cg-stop", "Стоп-кадр", "Остановка на 2 секунды", (r) => {
      r.wepStats.emp.freeze = 2;
    }),
    card("cg-jail", "Тюрьма", "Вышедший из кольца ещё секунду ползёт", (r) => {
      r.wepStats.emp.prison = 1;
    }),
    card("cg-quiet", "Тишина", "Замедление на весь экран", (r) => {
      r.wepStats.emp.silence = true;
    }),
  ];
}

function stormCards(level) {
  if (level === 10) {
    return [
      card("st-arc", "Молния", "Урон перескакивает между врагами в кольце", (r) => {
        r.wepStats.emp.chain = "ring";
      }),
      card("st-gale", "Гроза", "Три удара вместо двух", (r) => {
        r.wepStats.emp.hits = 3;
      }),
      card("st-push", "Напор", "Урон ×2 и импульс чаще", (r) => {
        r.wepStats.emp.dmg *= 2;
        r.wepStats.emp.cd *= 0.7;
      }),
    ];
  }
  return [
    card("st-boom", "Гром", "Урон ×3", (r) => {
      r.wepStats.emp.dmg *= 3;
    }),
    card("st-all", "Цепь", "Молния прыгает по всему экрану", (r) => {
      r.wepStats.emp.chain = "all";
    }),
    card("st-fast", "Шквал", "Импульс срабатывает вдвое чаще", (r) => {
      r.wepStats.emp.cd *= 0.5;
    }),
  ];
}

function domeCards(level) {
  if (level === 10) {
    return [
      card("dm-ring", "Второе кольцо", "Ещё один импульс дальше первого", (r) => {
        r.wepStats.emp.ring2 = 1.55;
      }),
      card("dm-shell", "Панцирь", "Ядро получает 120 HP в момент импульса", (r) => {
        r.wepStats.emp.heal = 120;
      }),
      card("dm-tide", "Отлив", "Отброс вдвое сильнее", (r) => {
        r.wepStats.emp.knock *= 2;
      }),
    ];
  }
  return [
    card("dm-sky", "Горизонт", "Импульс на весь экран", (r) => {
      r.wepStats.emp.full = true;
    }),
    card("dm-fort", "Бастион", "+250 HP и щит: следующий удар по ядру не проходит", (r) => {
      r.wepStats.emp.heal = (r.wepStats.emp.heal || 0) + 250;
      r.wepStats.emp.guard = 1;
    }),
    card("dm-wave", "Волна", "Отброс выкидывает ближних к краю экрана", (r) => {
      r.wepStats.emp.wave = true;
    }),
  ];
}

export function empStep(level, branch) {
  if (level === 5) {
    return {
      cards: [
        card("cage", "Ступор", "Враги в кольце почти встают, замедление держится вдвое дольше", (r) => {
          r.wepStats.emp.branch = "cage";
          r.wepStats.emp.slowMul = 0.12;
          r.wepStats.emp.slowDur = (r.wepStats.emp.slowDur || 1.15) * 2;
        }),
        card("storm", "Разряд", "Урон +50%, импульс бьёт дважды", (r) => {
          r.wepStats.emp.branch = "storm";
          r.wepStats.emp.dmg *= 1.5;
          r.wepStats.emp.hits = 2;
        }),
        card("dome", "Купол", "Радиус +55%, врагов отталкивает от ядра", (r) => {
          r.wepStats.emp.branch = "dome";
          r.wepStats.emp.radius *= 1.55;
          r.wepStats.emp.knock = 90;
        }),
      ],
    };
  }
  const cards = branch === "cage" ? cageCards(level) : branch === "storm" ? stormCards(level) : domeCards(level);
  return { cards };
}
