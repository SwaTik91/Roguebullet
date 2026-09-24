function card(id, title, desc, apply) {
  return { id, title, desc, rarity: "legendary", apply };
}

function waveCards(level) {
  if (level === 10) {
    return [
      card("wv-dam", "Плотина", "Конус накрывает полкруга", (r) => {
        r.wepStats.scatter.gap = Math.PI / Math.max(3, r.wepStats.scatter.n);
      }),
      card("wv-out", "Выброс", "Отброс ×3", (r) => {
        r.wepStats.scatter.knock *= 3;
      }),
      card("wv-bog", "Топь", "Задетые на секунду вязнут на месте", (r) => {
        r.wepStats.scatter.bog = true;
      }),
    ];
  }
  return [
    card("wv-two", "Прибой", "Сразу второй вал, толчок ещё сильнее", (r) => {
      r.wepStats.scatter.volley = true;
      r.wepStats.scatter.knock *= 1.5;
    }),
    card("wv-cliff", "Обрыв", "Отброс уносит задетых на всю длину дроби", (r) => {
      r.wepStats.scatter.knock = Math.max(r.wepStats.scatter.knock, 420);
    }),
    card("wv-cord", "Кордон", "Отброшенный секунду не может идти к ядру", (r) => {
      r.wepStats.scatter.cordon = true;
    }),
  ];
}

function sheafCards(level) {
  if (level === 10) {
    return [
      card("sh-ham", "Кувалда", "Удар центра ×2", (r) => {
        r.wepStats.scatter.centerMul *= 2;
      }),
      card("sh-rim", "Обод", "Края бьют вдвое больнее, конус шире", (r) => {
        r.wepStats.scatter.rim = true;
        r.wepStats.scatter.gap = (r.wepStats.scatter.gap || 0.09) * 1.8;
      }),
      card("sh-fork", "Вилка", "Такой же удар по второй ближайшей цели", (r) => {
        r.wepStats.scatter.fork = true;
      }),
    ];
  }
  return [
    card("sh-pierce", "Прокол", "Центр прошивает строй, урон не падает", (r) => {
      r.wepStats.scatter.steady = true;
    }),
    card("sh-far", "Метель", "Края уходят широким веером и летят вдвое дальше", (r) => {
      r.wepStats.scatter.far = true;
      r.wepStats.scatter.gap = (r.wepStats.scatter.gap || 0.09) * 1.6;
    }),
    card("sh-bar", "Лом", "Урон центра ×3", (r) => {
      r.wepStats.scatter.centerMul *= 3;
    }),
  ];
}

function bunchCards(level) {
  if (level === 10) {
    return [
      card("bn-five", "Россыпь", "Осколков пять, летят вдвое дальше", (r) => {
        r.wepStats.scatter.shards = 5;
        r.wepStats.scatter.shardLife = 0.28;
      }),
      card("bn-heart", "Сердце", "Осколки бьют полным уроном дроби", (r) => {
        r.wepStats.scatter.shardMul = 1;
      }),
      card("bn-echo", "Эхо", "Каждый осколок лопается ещё раз", (r) => {
        r.wepStats.scatter.echo = true;
      }),
    ];
  }
  return [
    card("bn-fall", "Обвал", "Смерть от дроби выпускает новую гроздь", (r) => {
      r.wepStats.scatter.avalanche = true;
    }),
    card("bn-awl", "Шило", "Осколки пробивают одну цель", (r) => {
      r.wepStats.scatter.shardPierce = 1;
    }),
    card("bn-heat", "Жар", "Урон осколков ×3", (r) => {
      r.wepStats.scatter.shardMul = (r.wepStats.scatter.shardMul || 0.45) * 3;
    }),
  ];
}

export function scatterStep(level, branch) {
  if (level === 5) {
    return {
      cards: [
        card("wave", "Вал", "Конус шире, дробинки прошивают всех на пути и толкают вдвое сильнее", (r) => {
          const s = r.wepStats.scatter;
          s.branch = "wave";
          s.gap = 0.2;
          s.pierce = 4;
          s.knock *= 2;
        }),
        card("sheaf", "Сноп", "Средняя дробина наносит урон всего залпа одним ударом", (r) => {
          const s = r.wepStats.scatter;
          s.branch = "sheaf";
          s.center = true;
          s.centerMul = 1;
        }),
        card("bunch", "Гроздь", "Дробинка при попадании лопается на три короткие", (r) => {
          const s = r.wepStats.scatter;
          s.branch = "bunch";
          s.cluster = true;
          s.shards = 3;
          s.shardMul = 0.45;
          s.shardLife = 0.16;
        }),
      ],
    };
  }
  const cards = branch === "wave" ? waveCards(level) : branch === "sheaf" ? sheafCards(level) : bunchCards(level);
  return { cards };
}
