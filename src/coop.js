export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function coopSeatLayout(worldW, worldH) {
  const y = worldH / 2;
  const inset = worldW * 0.22;
  return [
    { x: inset, y },
    { x: worldW - inset, y },
  ];
}

export function ensureSeats(run, worldW, worldH) {
  const spots = coopSeatLayout(worldW, worldH);
  if (!run.seats) {
    run.seats = spots.map((spot) => ({
      x: spot.x,
      y: spot.y,
      r: 34,
      angle: -Math.PI / 2,
      cd: 0,
      hitCd: 0,
      pointer: { x: spot.x, y: spot.y - 120, down: false },
    }));
  }
  run.seats.forEach((seat, i) => {
    seat.x = spots[i].x;
    seat.y = spots[i].y;
    seat.r = 34;
  });
  run.tower.x = worldW / 2;
  run.tower.y = worldH / 2;
  return run.seats;
}

export function nearestSeat(seats, entity) {
  let best = seats[0];
  let bestD = Infinity;
  for (const seat of seats) {
    const d = Math.hypot(entity.x - seat.x, entity.y - seat.y);
    if (d < bestD) {
      best = seat;
      bestD = d;
    }
  }
  return best;
}

export function coopSnapshot(run, state) {
  const cards = run._cards || [];
  return {
    t: "snap",
    state,
    worldW: run.worldW,
    worldH: run.worldH,
    runId: run.runId,
    offerLevel: run.offer?.level || 1,
    cardKey: cards.map((card) => card.id).join("|"),
    cards: state === "cards" ? cards.map((card) => ({
      id: card.id, title: card.title, desc: card.desc, rarity: card.rarity, who: card.who || "",
    })) : [],
    heading: state === "cards" ? run._heading : null,
    levelClear: state === "levelclear" ? run._levelClear : null,
    result: state === "result" ? run._result : null,
    seats: (run.seats || []).map((seat) => ({ x: seat.x, y: seat.y, angle: seat.angle })),
    tower: { x: run.tower.x, y: run.tower.y, hp: run.tower.hp, maxHp: run.tower.maxHp },
    wave: run.wave,
    chapter: run.chapter,
    level: run.level,
    coins: run.coins,
    crit: run.crit?.chance || 0,
    overdrive: {
      left: run.overdrive.left,
      dur: run.overdrive.dur,
      charge: run.overdrive.charge,
      max: run.overdrive.max,
    },
    weapons: run.weapons,
    pips: run.pips,
    enemies: run.enemies.filter((e) => !e.dead).slice(0, 70).map((e) => ({
      id: e.id, x: e.x, y: e.y, r: e.r, color: e.color, type: e.type,
      hp: e.hp, maxHp: e.maxHp, shield: e.shield || 0, maxShield: e.maxShield || 0, boss: !!e.boss,
    })),
    bullets: run.bullets.slice(0, 140).map((b) => ({ id: b.id, x: b.x, y: b.y, r: b.r || 3, color: b.color || "#7ee8ff" })),
    drones: (run.drones || []).map((d, i) => ({ id: i, x: d.x, y: d.y })),
  };
}
