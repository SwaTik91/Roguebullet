import { Game } from "./game.js";

const audio = new Proxy({}, { get: () => () => {} });

function publicCard(card) {
  return {
    id: card.id,
    title: card.title,
    desc: card.desc,
    rarity: card.rarity,
    who: card.who || "",
    unlock: !!card.unlock,
    milestone: !!card.milestone,
  };
}

function viewEnemy(e) {
  return {
    x: e.x, y: e.y, r: e.r, color: e.color, type: e.type,
    hp: e.hp, maxHp: e.maxHp, shield: e.shield || 0, maxShield: e.maxShield || 0,
    boss: !!e.boss,
  };
}

function viewBullet(b) {
  return { x: b.x, y: b.y, r: b.r || 3, color: b.color || "#7ee8ff" };
}

function viewFx(f) {
  return {
    kind: f.kind, x: f.x, y: f.y, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2,
    r: f.r, max: f.max, life: f.life, color: f.color, w: f.w, text: f.text, size: f.size,
    vx: f.vx, vy: f.vy,
  };
}

export function createBattle({ profile, level, worldW, worldH, runId, queuedCard }) {
  const ui = {
    cards: null,
    heading: null,
    used: 0,
    levelClear: null,
    result: null,
    toasts: [],
    endless: null,
    showPlay() {},
    updateHud() {},
    setCombo() {},
    save() {},
    applyProfile() {},
    hideCards() { this.cards = null; },
    hideLevelClear() { this.levelClear = null; },
    showCards(cards, heading, used = 0) {
      this.cards = cards;
      this.heading = heading;
      this.used = used || 0;
    },
    showLevelClear(info) { this.levelClear = info; },
    showResult(win, _run, granted, extra = {}) {
      this.result = { won: !!win, granted: granted || null, pending: !!extra.pending };
    },
    toast(text) { if (text) this.toasts.push(String(text)); },
    onEndlessWave(waveLevel, wave) { this.endless = { level: waveLevel, wave }; },
  };
  const game = new Game(null, ui, audio, { bestWave: 0, bestLevel: 1 }, {
    headless: true,
    worldW: worldW || 720,
    worldH: worldH || 1280,
    queuedCard: queuedCard || null,
  });
  game.profile = profile || {};
  game.startRun(level || 1);
  if (runId) game.run.runId = runId;
  return { game, ui, last: Date.now() };
}

export function stepBattle(session, input = {}, now = Date.now()) {
  const game = session.game;
  const ui = session.ui;
  if (input.worldW) game.worldW = Number(input.worldW) || game.worldW;
  if (input.worldH) game.worldH = Number(input.worldH) || game.worldH;
  if (input.pointer) {
    game.pointer.x = Number(input.pointer.x) || 0;
    game.pointer.y = Number(input.pointer.y) || 0;
    game.pointer.down = !!input.pointer.down;
  }
  const speed = Number(input.speed) || game.speed || 1;
  game.speed = Math.min(4, Math.max(1, speed));
  if (input.action === "pick") {
    const card = (ui.cards || []).find((item) => item.id === input.cardId);
    if (!card) throw new Error("Нет такой карты");
    game.applyCard(card);
  } else if (input.action === "reroll") {
    game.rerollOffer(Number(input.rerollUsed) || 0);
  } else if (input.action === "continue") {
    game.remote = false;
    game.continueLevel();
  } else if (input.action === "endless") {
    game.remote = false;
    game.beginEndless();
  } else if (input.action === "exit") {
    game.remote = false;
    game.exitAfterLevel();
  }
  const elapsed = Math.min(0.25, Math.max(0, (now - session.last) / 1000));
  session.last = now;
  let left = elapsed;
  while (left > 0) {
    const chunk = Math.min(0.033, left);
    game.update(chunk * game.speed);
    left -= chunk;
  }
  return snapshot(session);
}

export function snapshot(session) {
  const game = session.game;
  const run = game.run;
  const ui = session.ui;
  const cards = (ui.cards || []).map(publicCard);
  const orb = run.wepStats?.orb;
  const snap = {
    state: game.state,
    worldW: game.worldW,
    worldH: game.worldH,
    shake: game.shake || 0,
    offerLevel: run.offer?.level || 1,
    runId: run.runId,
    cardKey: cards.map((card) => card.id).join("|"),
    cards: game.state === "cards" ? cards : [],
    heading: game.state === "cards" ? ui.heading : null,
    rerollUsed: ui.used || 0,
    levelClear: game.state === "levelclear" ? ui.levelClear : null,
    result: game.state === "result" ? ui.result : null,
    facts: game.state === "result" ? game.facts() : null,
    endless: ui.endless,
    toasts: ui.toasts.splice(0),
    run: {
      runId: run.runId,
      wave: run.wave,
      chapter: run.chapter,
      level: run.level,
      coins: run.coins,
      won: !!run.won,
      crit: { chance: run.crit?.chance || 0 },
      weapons: run.weapons,
      pips: run.pips,
      combo: run.combo || 0,
      comboType: run.comboType,
      bossIntro: run.bossIntro || 0,
      gun: { angle: run.gun.angle },
      tower: { ...run.tower },
      overdrive: {
        left: run.overdrive.left,
        dur: run.overdrive.dur,
        charge: run.overdrive.charge,
        max: run.overdrive.max,
      },
      wepStats: {
        orb: orb ? { count: orb.count, branch: orb.branch, reach: orb.reach || 1, spots: orb.spots || [], radius: orb.radius } : null,
      },
      enemies: run.enemies.filter((e) => !e.dead).slice(0, 80).map(viewEnemy),
      bullets: run.bullets.slice(0, 240).map(viewBullet),
      fx: run.fx.slice(0, 160).map(viewFx),
      pools: (run.pools || []).slice(0, 40).map((pool) => ({ x: pool.x, y: pool.y, r: pool.r, life: pool.life })),
      drones: (run.drones || []).map((d) => ({ x: d.x, y: d.y })),
    },
  };
  return snap;
}

export function clearEndless(session) {
  session.ui.endless = null;
}
