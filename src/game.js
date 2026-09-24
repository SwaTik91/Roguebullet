import { SHAPES, WEAPON_INFO, applyQueuedCard, endlessEnemyWave, enemyForWave, startingLoadout, waveCount } from "./content.js";
import { rayEnd, reflectAngle } from "./laser.js";
import { bulletShouldStop, gunStep, gunXpToNext, reflectBullet, rollGunShot } from "./gun.js";
import { legendaryOffer, rollBattleOffer, weaponMilestone } from "./draft.js";
import { api, newId } from "./api.js";
import { ensureSeats, nearestSeat } from "./coop.js";

const PENDING_KEY = "roguebullet-pending-run";
const gatling = typeof Image === "undefined" ? null : new Image();
if (gatling) gatling.src = "/gatling.png";

const LEVELS = 3;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const normAng = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class Game {
  constructor(canvas, ui, audio, meta, options = {}) {
    this.headless = !!options.headless;
    this.remote = false;
    this.remoteAction = null;
    this.syncing = false;
    this.canvas = canvas;
    this.ctx = this.headless ? null : canvas.getContext("2d");
    this.ui = ui;
    this.audio = audio;
    this.meta = meta;
    this.dpr = 1;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.worldW = options.worldW || 720;
    this.worldH = options.worldH || 1280;
    this.stars = [];
    this.pointer = { down: false, x: 360, y: 200 };
    this.shake = 0;
    this.speed = 1;
    this.state = "boot";
    this.queuedCard = options.queuedCard || null;
    this.coop = null;
    this.coopLock = false;
    if (this.headless) return;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => this.resize());
      window.visualViewport.addEventListener("scroll", () => this.resize());
    }
    this.bindInput();
  }

  resize() {
    const vv = window.visualViewport;
    const w = Math.max(1, vv?.width || window.innerWidth);
    const h = Math.max(1, vv?.height || window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (this.coopLock) {
      this.worldW = 720;
      this.worldH = 1280;
      this.scale = Math.min(w / this.worldW, h / this.worldH);
      this.ox = (w - this.worldW * this.scale) / 2;
      this.oy = (h - this.worldH * this.scale) / 2;
    } else {
      this.worldH = 1280;
      this.worldW = 1280 * (w / h);
      this.scale = h / this.worldH;
      this.ox = 0;
      this.oy = 0;
    }
    this.stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * this.worldW,
      y: Math.random() * this.worldH,
      s: Math.random() * 1.6 + 0.3,
      a: Math.random() * 0.5 + 0.15,
    }));
  }

  toVirtual(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left - this.ox) / this.scale;
    const y = (clientY - r.top - this.oy) / this.scale;
    return { x, y };
  }

  bindInput() {
    const down = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const v = this.toVirtual(p.clientX, p.clientY);
      this.pointer.down = true;
      this.pointer.x = v.x;
      this.pointer.y = v.y;
    };
    const move = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const v = this.toVirtual(p.clientX, p.clientY);
      this.pointer.x = v.x;
      this.pointer.y = v.y;
    };
    const up = () => {
      this.pointer.down = false;
    };
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.canvas.addEventListener("touchstart", (e) => { e.preventDefault(); down(e); }, { passive: false });
    this.canvas.addEventListener("touchmove", (e) => { e.preventDefault(); move(e); }, { passive: false });
    this.canvas.addEventListener("touchend", up);
  }

  async startRun(level = 1) {
    const profile = this.profile || {};
    const hangar = profile.hangar || { atk: 0, hp: 0, charge: 0 };
    const startLevel = Math.min(3, Math.max(1, Number(level) || 1));
    const atk = 1 + (hangar.atk || 0) * 0.12;
    const hp = 220 + (hangar.hp || 0) * 40;
    const gear = startingLoadout(profile);
    this.run = {
      runId: newId(),
      startedLevel: startLevel,
      level: startLevel,
      chapter: startLevel,
      wave: 1,
      kills: { circle: 0, triangle: 0, square: 0, hex: 0, diamond: 0, split: 0, boss: 0 },
      wavesCleared: 0,
      levelsCleared: 0,
      coins: 0,
      xp: 0,
      nextXp: 18,
      comboNeed: 6,
      comboType: null,
      combo: 0,
      comboFlash: 0,
      bossIntro: 0,
      bossPulse: 0,
      overdrive: { charge: 8 * (hangar.charge || 0), max: 100, dur: 3.4, left: 0, mul: 1.85, chargeGain: 0 },
      offer: { level: 1, xp: 0, next: gunXpToNext(1) },
      pips: {},
      endless: false,
      power: 1,
      levelCoins: 0,
      weapons: gear.weapons,
      wepStats: gear.wepStats,
      offerCount: gear.cards,
      drones: [],
      drone: {
        dmg: 24,
        count: 1,
        cd: 0.24,
        bombs: false,
        radius: 64,
        bombMul: 1.6,
        speed: 560,
        life: 0.9,
        pierce: 0,
        pellets: 1,
        falloff: 0,
        bombOnHit: false,
        level: 1,
        xp: 0,
        next: gunXpToNext(1),
        branch: null,
      },
      orbAngle: 0,
      gun: {
        angle: -Math.PI / 2,
        dmg: 17 * atk,
        rate: 8,
        pellets: 1,
        pierce: 0,
        bounces: 0,
        life: 1.15,
        speed: 680,
        gap: 12,
        edgeMul: 1,
        swarm: false,
        falloff: 0,
        series: false,
        every: 0,
        shot: 0,
        forceNext: false,
        level: 1,
        xp: 0,
        next: gunXpToNext(1),
        branch: null,
        autoTurn: 2.6,
        cd: 0,
      },
      crit: { chance: 0.08 + (profile.critBonus || 0) / 100, mul: 2 },
      tower: { x: this.worldW / 2, y: this.worldH / 2, r: 34, hp, maxHp: hp, regen: 0, slide: 280, hitCd: 0 },
      enemies: [],
      bullets: [],
      fx: [],
      beams: [],
      pools: [],
      spawnQueue: [],
      spawnTimer: 0,
      wavePause: 1.2,
      won: false,
      usedCard: false,
    };
    this.state = "play";
    this.ui.showPlay();
    this.syncDrones();
    this.queueWave();
    this.ui.updateHud(this.run);
    if (this.headless) {
      if (this.queuedCard) applyQueuedCard(this.run, this.queuedCard);
      return;
    }
    this.pullQueuedCard();
  }

  async pullQueuedCard() {
    if (!api?.takeCard || !this.run) return;
    const runId = this.run.runId;
    try {
      const taken = await api.takeCard(runId);
      if (taken?.profile) this.ui.applyProfile?.(taken.profile);
      if (!this.run || this.run.runId !== runId || !taken?.card) return;
      if (applyQueuedCard(this.run, taken.card)) {
        this.ui.toast(taken.card);
        this.ui.updateHud(this.run);
      }
    } catch {
      // The run still starts if the chest card cannot be fetched.
    }
  }

  queueWave() {
    const { wave, chapter } = this.run;
    this.run.spawnQueue = [];
    this.run.wavePause = 0;
    if (!this.run.endless && wave % 6 === 0) {
      this.run.bossIntro = 2.6;
      this.run.bossPulse = 0;
      this.shake = 12;
      this.audio.overdrive();
      this.ui.updateHud(this.run);
      return;
    }
    const n = this.run.endless ? 1000 : waveCount(wave);
    const power = this.run.power || 1;
    const kind = this.run.endless ? endlessEnemyWave(wave) : wave;
    for (let i = 0; i < n; i++) this.run.spawnQueue.push(enemyForWave(kind, chapter, power));
    this.run.spawnTimer = 0.45;
    this.ui.updateHud(this.run);
  }

  releaseBoss() {
    const { wave, chapter } = this.run;
    this.run.spawnQueue = [enemyForWave(wave, chapter)];
    const escorts = (26 + chapter * 8) * 10;
    for (let i = 0; i < escorts; i++) this.run.spawnQueue.push(enemyForWave(3 + (i % 3), chapter));
    this.run.spawnTimer = 0.2;
    this.shake = 18;
    this.audio.boom();
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    this.run.fx.push({ kind: "ring", x: cx, y: cy, r: 30, max: Math.max(this.worldW, this.worldH), life: 0.7, color: "#ff5d9a" });
    this.run.fx.push({ kind: "ring", x: cx, y: cy, r: 10, max: 220, life: 0.45, color: "#ffe08a" });
  }

  spawnGap() {
    const wave = this.run.wave;
    if (wave % 6 === 0) return 0.95;
    return clamp(1.35 - wave * 0.08, 0.72, 1.45);
  }

  spawnEnemy(def, fromSplit, at) {
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    if (fromSplit && at) {
      x = at.x + (Math.random() - 0.5) * 30;
      y = at.y + (Math.random() - 0.5) * 30;
    } else if (side === 0) {
      x = 40 + Math.random() * (this.worldW - 80);
      y = -36;
    } else if (side === 1) {
      x = 40 + Math.random() * (this.worldW - 80);
      y = this.worldH + 36;
    } else if (side === 2) {
      x = -36;
      y = 40 + Math.random() * (this.worldH - 80);
    } else {
      x = this.worldW + 36;
      y = 40 + Math.random() * (this.worldH - 80);
    }
    if (def.boss) {
      this.shake = Math.max(this.shake, 14);
      this.run.fx.push({ kind: "ring", x, y, r: 16, max: def.r * 3.2, life: 0.55, color: def.color });
    }
    this.run.enemies.push({
      ...def,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      shield: def.shield || 0,
      maxShield: def.shield || 0,
      slow: 0,
      phase: Math.random() * Math.PI * 2,
      dead: false,
      fromSplit: !!fromSplit,
      id: (this._eid = (this._eid || 0) + 1),
    });
  }

  nearest(from, pred) {
    let best = null;
    let bestD = 1e9;
    for (const e of this.run.enemies) {
      if (e.dead || (pred && !pred(e))) continue;
      const d = dist(from, e);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  densest() {
    let best = null;
    let score = -1;
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      let s = 0;
      for (const o of this.run.enemies) {
        if (!o.dead && dist(e, o) < 110) s++;
      }
      if (s > score) {
        score = s;
        best = e;
      }
    }
    return best;
  }

  damage(e, amt, src, canCrit = true, forcedCrit = false) {
    if (e.dead) return false;
    let crit = false;
    if (canCrit && this.run.crit && (forcedCrit || Math.random() < this.run.crit.chance)) {
      amt *= this.run.crit.mul;
      crit = true;
    }
    if (e.shield > 0) {
      const use = Math.min(e.shield, amt);
      e.shield -= use;
      amt -= use;
    }
    if (amt <= 0) {
      this.spark(e.x, e.y, "#34d399", 4);
      return crit;
    }
    const dealt = amt;
    e.hp -= dealt;
    if (crit) {
      this.spark(e.x, e.y, "#ffe08a", 10);
      this.floatDamage(e.x, e.y, dealt, true);
      this.audio.crit();
    } else {
      this.spark(e.x, e.y, src || e.color, 5);
      this.floatDamage(e.x, e.y, dealt, false);
    }
    if (e.hp <= 0) this.kill(e);
    return crit;
  }

  floatDamage(x, y, amount, crit) {
    if (this.meta.showDamage === false) return;
    const n = Math.max(1, Math.round(amount));
    this.run.fx.push({
      kind: "text",
      x: x + (Math.random() - 0.5) * 26,
      y: y - 16,
      vy: -62,
      life: 0.55,
      color: crit ? "#ffe08a" : "#f4f7ff",
      text: crit ? `${n}!` : String(n),
      size: crit ? 22 : 16,
    });
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    const bucket = e.fromSplit ? "split" : e.type;
    if (this.run.kills[bucket] === undefined) this.run.kills.split += 1;
    else this.run.kills[bucket] += 1;
    this.run.coins += e.coins;
    this.run.xp += e.xp;
    this.gainOfferXp(1);
    this.audio.hit();
    this.burst(e.x, e.y, e.color, e.boss ? 28 : 12);
    this.shake = Math.max(this.shake, e.boss ? 10 : 3);

    if (e.split) {
      for (let i = 0; i < e.split; i++) {
        this.spawnEnemy(
          { type: "circle", hp: e.maxHp * 0.28, speed: 78, dmg: 5, r: 11, color: "#e9d5ff", xp: 3, coins: 1 },
          true,
          e,
        );
      }
    }

    if (this.run.comboType === e.type) this.run.combo += 1;
    else {
      this.run.comboType = e.type;
      this.run.combo = 1;
    }
    this.run.comboFlash = 1.4;
    this.ui.setCombo(this.run);
    if (this.run.combo >= this.run.comboNeed) {
      this.prismBurst(e.x, e.y);
      this.run.combo = 0;
      this.run.comboType = null;
      this.ui.toast("РЕЗОНАНС ФОРМ");
    }

    this.ui.updateHud(this.run);
  }

  gainOfferXp(amount) {
    const offer = this.run?.offer;
    if (!offer) return;
    offer.xp += amount;
    while (offer.xp >= offer.next && offer.next > 0 && this.state === "play") {
      offer.xp -= offer.next;
      offer.level += 1;
      offer.next = gunXpToNext(offer.level) || 500 + offer.level * 40;
      const cards = rollBattleOffer(this.run, this.run.offerCount || 3);
      this.state = "cards";
      this.ui.showCards(cards, {
        title: "УСИЛЕНИЕ",
        sub: "Одно усиление: оружие или общая карта",
      });
      break;
    }
  }

  prismBurst(x, y) {
    this.audio.boom();
    this.burst(x, y, "#c084fc", 26);
    for (const e of this.run.enemies) {
      if (!e.dead && dist(e, { x, y }) < 210) this.damage(e, 55 + this.run.wave * 6, "#c084fc");
    }
    this.shake = 8;
  }

  applyCard(card) {
    if (this.coop) {
      this.sendCoop({ t: "pick", id: card.id });
      return;
    }
    if (this.remote) {
      this.remoteAction = { action: "pick", cardId: card.id };
      return;
    }
    const owner = Object.entries(WEAPON_INFO).find(([, info]) => info.name === card.who);
    if (owner && !card.unlock && !card.milestone) {
      const key = owner[0];
      const next = weaponMilestone((this.run.pips[key] || []).length);
      if (next) {
        const cards = legendaryOffer(this.run, key).map((item) => ({ ...item, milestone: true }));
        this.state = "cards";
        this.ui.showCards(cards, {
          title: `${card.who} · ${next}`,
          sub: "Каждое 5-е улучшение этого оружия — легендарка",
          reroll: false,
        });
        return;
      }
    }
    card.apply(this.run);
    if (owner && !card.unlock) {
      const key = owner[0];
      this.run.pips[key] = this.run.pips[key] || [];
      this.run.pips[key].push(card.rarity === "legendary" ? "legendary" : "normal");
    }
    this.state = "play";
    this.ui.hideCards();
    this.ui.toast(card.title);
    this.ui.updateHud(this.run);
    this.audio.pickup();
    this.syncDrones();
    this.gainOfferXp(0);
  }

  rerollOffer(used = 0) {
    this.ui.showCards(rollBattleOffer(this.run, this.run.offerCount || 3), null, used);
    this.audio.pickup();
  }

  async rerollCards() {
    if (this.coop) {
      const result = await api.buyReroll(this.run.runId, this.run.offer?.level || 1);
      if (result.profile) this.ui.applyProfile?.(result.profile);
      this.sendCoop({ t: "reroll", used: result.used || 0 });
      return;
    }
    if (this.remote) {
      this.remoteAction = { action: "reroll" };
      return;
    }
    const result = await api.buyReroll(this.run.runId, this.run.offer.level);
    if (result.profile) this.ui.applyProfile?.(result.profile);
    this.ui.showCards(rollBattleOffer(this.run, this.run.offerCount || 3), null, result.used);
    this.audio.pickup();
  }

  syncDrones() {
    const need = this.run.drone?.count || this.run.wepStats.drone?.count || 0;
    while (this.run.drones.length < need) {
      const i = this.run.drones.length;
      const a = (i / Math.max(need, 1)) * Math.PI * 2 - Math.PI / 2;
      this.run.drones.push({
        x: this.run.tower.x + Math.cos(a) * 120,
        y: this.run.tower.y + Math.sin(a) * 120,
        orbit: a,
        cd: i * 0.08,
      });
    }
  }

  fireGun(from) {
    const g = this.run.gun;
    const origin = from || this.run.tower;
    const over = this.run.overdrive.left > 0;
    const dmg = g.dmg * (over ? this.run.overdrive.mul : 1);
    const shot = rollGunShot(g);
    const a = from?.angle ?? g.angle;
    const spd = (g.speed || 680) * (over ? 1.15 : 1);
    const gap = g.gap || 12;
    const sideX = -Math.sin(a);
    const sideY = Math.cos(a);
    for (let i = 0; i < g.pellets; i++) {
      const off = (i - (g.pellets - 1) / 2) * gap;
      this.run.bullets.push({
        x: origin.x + Math.cos(a) * 38 + sideX * off,
        y: origin.y + Math.sin(a) * 38 + sideY * off,
        id: (this._bid = (this._bid || 0) + 1),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        dmg,
        r: over ? 6.2 : g.bounces > 0 ? 4.6 : g.pierce > 0 ? 5.4 : 3.2,
        pierce: g.pierce,
        falloff: g.falloff || 0,
        canBounce: g.bounces > 0,
        bounces: g.bounces,
        edgeMul: g.edgeMul || 1,
        swarm: !!g.swarm,
        guaranteedCrit: shot.guaranteedCrit,
        canChain: shot.canChain,
        life: g.life || 1.15,
        color: over ? "#fff1b8" : "#7ee8ff",
        kind: "gun",
        hit: new Set(),
      });
    }
    const gain = 1.6 * (1 + this.meta.charge * 0.18) * (1 + (this.run.overdrive.chargeGain || 0));
    if (this.run.overdrive.left <= 0) this.run.overdrive.charge += gain;
    if (this.run.overdrive.charge >= this.run.overdrive.max) {
      this.run.overdrive.charge = 0;
      this.run.overdrive.left = this.run.overdrive.dur;
      this.audio.overdrive();
      this.ui.toast("ОВЕРДРАЙВ");
    }
    this.audio.shoot();
  }

  steerBounce(b, dt) {
    let best = null;
    let bestD = 460 * 460;
    for (const e of this.run.enemies) {
      if (e.dead || b.hit.has(e)) continue;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        best = e;
        bestD = d2;
      }
    }
    if (!best) return;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const dx = best.x - b.x;
    const dy = best.y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const turn = Math.min(0.45, 2.6 * dt);
    const nx = (b.vx / sp) * (1 - turn) + (dx / len) * turn;
    const ny = (b.vy / sp) * (1 - turn) + (dy / len) * turn;
    const nlen = Math.hypot(nx, ny) || 1;
    b.vx = (nx / nlen) * sp;
    b.vy = (ny / nlen) * sp;
  }

  spawnSwarm(b) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const nx = -b.vy / sp;
    const ny = b.vx / sp;
    const sign = b.swarmSide || 1;
    b.swarmSide = -sign;
    this.run.bullets.push({
      x: b.x + nx * sign * 12,
      y: b.y + ny * sign * 12,
      vx: nx * sign * 480,
      vy: ny * sign * 480,
      dmg: b.dmg * 0.8,
      r: 3,
      pierce: 0,
      falloff: 0,
      canBounce: false,
      life: 0.35,
      color: "#d7f7ff",
      kind: "gun",
      hit: new Set(),
    });
  }

  fireLaser() {
    const s = this.run.wepStats.laser;
    const tw = this.run.tower;
    const target = this.nearest(tw, (e) => e.hp > e.maxHp * 0.3) || this.nearest(tw);
    if (!target && !s.spin) return;
    const base = s.spin ? s.spinAngle || 0 : angTo(tw, target);
    const n = Math.max(1, s.rays || 1);
    const gap = s.spread || 0.28;
    for (let i = 0; i < n; i++) this.castLaser(base + (i - (n - 1) / 2) * gap, s.dmg, s.width, s.bounces || 0);
  }

  castLaser(angle, dmg, width, bounces) {
    const s = this.run.wepStats.laser;
    const tw = this.run.tower;
    let x = tw.x;
    let y = tw.y;
    let a = angle;
    let power = dmg;
    const seen = new Set();
    let last = { x, y };
    for (let hop = 0; hop <= bounces; hop++) {
      const end = rayEnd(x, y, a, this.worldW, this.worldH);
      this.paintBeam(x, y, end.x, end.y, width, Math.max(s.hold || 0, 0.12), power);
      const along = this.run.enemies
        .filter((e) => !e.dead && !seen.has(e) && pointLine(e.x, e.y, x, y, end.x, end.y) < width + e.r)
        .sort((p, q) => dist({ x, y }, p) - dist({ x, y }, q));
      along.forEach((e, i) => {
        seen.add(e);
        this.damage(e, power, "#60a5fa");
        if (s.execute && !e.dead && e.hp / e.maxHp <= s.execute) this.damage(e, e.hp + 1, "#60a5fa", false);
        if (s.burn) this.ignite(e, power * s.burn);
        if (s.burn && s.burnSpread && along[i + 1]) this.ignite(along[i + 1], power * s.burn);
      });
      last = end;
      if (hop === bounces) break;
      if (s.spark || s.shards) this.sideBeam(end.x, end.y, a + Math.PI / 2, power * 0.8, width, s.shards);
      const fall = s.steady ? 1 : 0.75;
      power *= fall * (s.edgeMul || 1);
      a = reflectAngle(a, end.axis);
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      x = end.x + nx * 2;
      y = end.y + ny * 2;
    }
    if (s.boomerang) this.paintAndHit(last.x, last.y, tw.x, tw.y, width, power, seen);
  }

  sideBeam(x, y, angle, dmg, width, both) {
    const reach = 220;
    const ends = both ? [angle, angle + Math.PI] : [angle];
    for (const a of ends) {
      const x2 = x + Math.cos(a) * reach;
      const y2 = y + Math.sin(a) * reach;
      this.paintAndHit(x, y, x2, y2, width, dmg, new Set());
    }
  }

  paintAndHit(x1, y1, x2, y2, width, dmg, seen) {
    this.paintBeam(x1, y1, x2, y2, width, 0.12, dmg);
    for (const e of this.run.enemies) {
      if (e.dead || seen.has(e)) continue;
      if (pointLine(e.x, e.y, x1, y1, x2, y2) < width + e.r) {
        seen.add(e);
        this.damage(e, dmg, "#60a5fa");
      }
    }
  }

  paintBeam(x1, y1, x2, y2, width, life, dps) {
    const beam = { kind: "beam", x1, y1, x2, y2, life: Math.max(life, 0.46), color: "#7dd3fc", w: width, dps, tick: 0 };
    this.run.fx.push(beam);
    if (life > 0.2) this.run.beams.push(beam);
  }

  ignite(e, dps) {
    e.burn = Math.max(e.burn || 0, 1);
    e.burnDps = Math.max(e.burnDps || 0, dps);
  }

  fireScatter() {
    const s = this.run.wepStats.scatter;
    const first = this.nearest(this.run.tower);
    if (!first) return;
    const targets = [first];
    if (s.fork) {
      const second = this.nearest(this.run.tower, (e) => e !== first);
      if (second) targets.push(second);
    }
    for (const t of targets) this.scatterVolley(s, t);
    if (s.volley) {
      s.pending = 1;
      s.pendingIn = 0.14;
    }
  }

  scatterVolley(s, t) {
    const base = angTo(this.run.tower, t);
    const gap = s.gap || 0.09;
    const mid = (s.n - 1) / 2;
    for (let i = 0; i < s.n; i++) {
      const center = Math.abs(i - mid) < 0.6;
      const a = base + (i - mid) * gap;
      let dmg = s.dmg;
      if (s.center && center) dmg = s.dmg * s.n * (s.centerMul || 1);
      else if (s.rim) dmg *= 2;
      this.run.bullets.push({
        x: this.run.tower.x,
        y: this.run.tower.y,
        vx: Math.cos(a) * 620,
        vy: Math.sin(a) * 620,
        dmg,
        r: center && s.center ? 6 : 3,
        pierce: center && s.steady ? 12 : s.pierce || 0,
        falloff: center && s.steady ? 1 : 0,
        knock: s.knock,
        life: !center && s.far ? 0.76 : 0.38,
        color: "#fbbf24",
        kind: "pellet",
        bog: !!s.bog,
        cordon: !!s.cordon,
        cluster: !!s.cluster,
        shards: s.shards || 0,
        shardMul: s.shardMul || 0.45,
        shardLife: s.shardLife || 0.16,
        echo: !!s.echo,
        avalanche: !!s.avalanche,
        shardPierce: s.shardPierce || 0,
        hit: new Set(),
      });
    }
  }

  updateOrbs(dt, tw) {
    const o = this.run.wepStats.orb;
    const r = this.run;
    r.orbAngle += o.spin * dt;
    if (o.branch === "ward") {
      o.guardT = (o.guardT ?? o.guardCd ?? 4) - dt;
      if ((o.guard || 0) < (o.guardMax || 1) && o.guardT <= 0) {
        o.guard = (o.guard || 0) + 1;
        o.guardT = o.guardCd || 4;
      }
    }
    if (o.lunge) {
      o.lungeT = (o.lungeT || 0) - dt;
      if (o.lungeT <= 0) {
        o.lungeT = o.lungeCd || 1.3;
        const pack = o.salvo ? this.densest() : null;
        o.fly = [];
        for (let i = 0; i < o.count; i++) {
          const home = this.orbHome(o, i, tw);
          const target = pack || this.nearest(home);
          if (!target) continue;
          o.fly.push({ i, x: home.x, y: home.y, tx: target.x, ty: target.y, hit: false, back: false, anchor: null, hook: !!o.hook });
        }
      }
    }
    const spots = [];
    for (let i = 0; i < o.count; i++) {
      const home = this.orbHome(o, i, tw);
      const fly = (o.fly || []).find((f) => f.i === i && !f.done);
      let x = home.x;
      let y = home.y;
      if (fly) {
        const dest = fly.back ? home : { x: fly.tx, y: fly.ty };
        const a = angTo(fly, dest);
        fly.x += Math.cos(a) * 720 * dt;
        fly.y += Math.sin(a) * 720 * dt;
        x = fly.x;
        y = fly.y;
        if (o.through && !fly.back) {
          for (const e of r.enemies) {
            if (!e.dead && dist(e, fly) < e.r + 14) this.damage(e, o.dmg * dt * 10, "#34d399", false);
          }
        }
        if (!fly.hit && dist(fly, { x: fly.tx, y: fly.ty }) < 18) {
          fly.hit = true;
          const victim = this.nearest(fly);
          if (victim) {
            this.damage(victim, o.dmg * (o.lungeMul || 8), "#34d399");
            if (o.anchor && !victim.dead) fly.anchor = victim;
          }
          if (fly.hook) {
            const next = this.nearest(fly, (e) => e !== victim);
            if (next) {
              fly.tx = next.x;
              fly.ty = next.y;
              fly.hit = false;
              fly.hook = false;
            } else fly.back = true;
          } else if (!fly.anchor) fly.back = true;
        }
        if (fly.anchor && !fly.anchor.dead) {
          fly.x = fly.anchor.x;
          fly.y = fly.anchor.y;
          x = fly.x;
          y = fly.y;
          this.damage(fly.anchor, o.dmg * dt * 8, "#34d399", false);
        } else if (fly.anchor) fly.back = true;
        if (fly.back && dist(fly, home) < 16) fly.done = true;
      }
      spots.push({ x, y, home });
      const reach = 12 * (o.reach || 1);
      for (const e of r.enemies) {
        if (e.dead) continue;
        const touch = dist(e, { x, y }) < e.r + reach;
        const onRing = o.saw && Math.abs(dist(e, tw) - o.radius) < 16 + e.r;
        if (touch || onRing) {
          this.damage(e, o.dmg * dt * (o.saw && onRing ? 6 : 8), "#34d399", false);
          if (o.bleed) this.ignite(e, o.dmg * 4);
          if (o.knock && o.branch === "ward") {
            const a = angTo(tw, e);
            e.x += Math.cos(a) * o.knock * dt;
            e.y += Math.sin(a) * o.knock * dt;
          }
          if (o.pin && o.guard > 0 && touch) {
            e.slow = Math.max(e.slow || 0, 0.2);
            e.slowMul = 0.08;
          }
        }
        if (o.wall && o.guard > 0 && dist(e, tw) < o.radius && dist(e, home) < 28) {
          const a = angTo(tw, e);
          e.x = tw.x + Math.cos(a) * (o.radius + e.r);
          e.y = tw.y + Math.sin(a) * (o.radius + e.r);
        }
      }
      if (o.inner) {
        const inner = { x: tw.x + (home.x - tw.x) * 0.45, y: tw.y + (home.y - tw.y) * 0.45 };
        for (const e of r.enemies) {
          if (!e.dead && dist(e, inner) < e.r + reach) this.damage(e, o.dmg * dt * 8, "#34d399", false);
        }
      }
    }
    o.spots = spots;
  }

  orbHome(o, i, tw) {
    const a = this.run.orbAngle + (i * Math.PI * 2) / Math.max(1, o.count);
    return { x: tw.x + Math.cos(a) * o.radius, y: tw.y + Math.sin(a) * o.radius };
  }

  burstPellets(x, y, n, dmg, life, pierce, again) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      this.run.bullets.push({
        x,
        y,
        vx: Math.cos(a) * 460,
        vy: Math.sin(a) * 460,
        dmg,
        r: 3,
        pierce,
        life,
        color: "#fde68a",
        kind: "pellet",
        cluster: again,
        shards: again ? 3 : 0,
        shardMul: 0.45,
        shardLife: 0.12,
        echo: false,
        avalanche: false,
        hit: new Set(),
      });
    }
  }

  fireGrenade(quiet = false) {
    const s = this.run.wepStats.grenade;
    const t = this.densest() || this.nearest(this.run.tower);
    if (!t) return;
    this.run.bullets.push({
      x: this.run.tower.x,
      y: this.run.tower.y,
      vx: (t.x - this.run.tower.x) * 1.6,
      vy: (t.y - this.run.tower.y) * 1.6,
      dmg: s.dmg,
      r: 7,
      life: 0.85,
      color: "#fb7185",
      kind: "nade",
      radius: s.radius,
      shape: s.shape || "",
      reach: s.reach || 1,
      width: s.width || 0.7,
      bombs: s.bombs || 0,
      bombMul: s.bombMul || 0.55,
      bombSpread: s.bombSpread || 1,
      core: !!s.core,
      twin: !!s.twin && !quiet,
      pool: s.pool || 0,
      poolDmg: s.poolDmg || s.dmg * 0.35,
      poolAll: !!s.poolAll,
      resin: !!s.resin,
      pull: !!s.pull,
      pit: s.pit || 0,
      magma: !!s.magma,
      twice: !!s.twice,
      hit: new Set(),
    });
  }

  fireEmp() {
    const s = this.run.wepStats.emp;
    this.pulseEmp(false);
    const extra = Math.max(0, (s.hits || 1) - 1);
    if (extra) {
      s.pending = extra;
      s.pendingIn = 0.16;
    }
  }

  pulseEmp(quiet) {
    const s = this.run.wepStats.emp;
    const tw = this.run.tower;
    const reach = s.full ? Math.hypot(this.worldW, this.worldH) : s.radius;
    this.run.fx.push({ kind: "ring", x: tw.x, y: tw.y, r: 20, max: Math.min(reach, 520), life: 0.35, color: "#c084fc" });
    const hit = new Set();
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      const inside = dist(e, tw) < reach || s.silence;
      if (!inside) continue;
      hit.add(e);
      this.strikeEmp(e, s, tw, reach);
    }
    if (s.ring2) {
      const outer = reach * s.ring2;
      this.run.fx.push({ kind: "ring", x: tw.x, y: tw.y, r: reach, max: Math.min(outer, 640), life: 0.4, color: "#e9d5ff" });
      for (const e of this.run.enemies) {
        if (e.dead || hit.has(e)) continue;
        if (dist(e, tw) < outer) this.strikeEmp(e, s, tw, outer);
      }
    }
    this.chainEmp(s, hit, reach);
    if (!quiet && s.heal) tw.hp = Math.min(tw.maxHp, tw.hp + s.heal);
    if (!quiet && s.guard) tw.guard = Math.max(tw.guard || 0, s.guard);
    this.audio.boom();
  }

  strikeEmp(e, s, tw, reach) {
    this.damage(e, s.dmg, "#c084fc");
    if (e.dead) return;
    const mul = s.slowMul ?? 0.45;
    const dur = s.slowDur || 1.15;
    if (s.freeze) e.freeze = Math.max(e.freeze || 0, s.freeze);
    e.slow = Math.max(e.slow || 0, dur);
    e.slowMul = mul;
    e.inEmp = dist(e, tw) < reach;
    if (s.wave) {
      const a = angTo(tw, e);
      const edge = rayEnd(tw.x, tw.y, a, this.worldW, this.worldH);
      e.x = tw.x + (edge.x - tw.x) * 0.82;
      e.y = tw.y + (edge.y - tw.y) * 0.82;
    } else if (s.knock) {
      const a = angTo(tw, e);
      e.x = clamp(e.x + Math.cos(a) * s.knock, e.r, this.worldW - e.r);
      e.y = clamp(e.y + Math.sin(a) * s.knock, e.r, this.worldH - e.r);
    }
  }

  chainEmp(s, hit, reach) {
    if (!s.chain) return;
    const jumps = s.chain === "all" ? 8 : 5;
    const pool = [...hit];
    for (let n = 0; n < jumps; n++) {
      const from = pool[n];
      if (!from) break;
      let next = null;
      let best = 1e9;
      for (const e of this.run.enemies) {
        if (e.dead || hit.has(e)) continue;
        if (s.chain !== "all" && dist(e, this.run.tower) > reach) continue;
        const d = dist(from, e);
        if (d < best) {
          best = d;
          next = e;
        }
      }
      if (!next || (s.chain !== "all" && best > 180)) break;
      hit.add(next);
      pool.push(next);
      this.damage(next, s.dmg * 0.8, "#c084fc");
      this.run.fx.push({ kind: "beam", x1: from.x, y1: from.y, x2: next.x, y2: next.y, life: 0.12, color: "#e9d5ff", w: 3 });
    }
  }

  blast(b) {
    const x = b.x;
    const y = b.y;
    if (!b.shape) this.explode(x, y, b.radius, b.dmg);
    else this.shapeBlast(b);
    if (b.core) this.explode(x, y, b.radius, b.dmg);
    if (b.bombs) {
      const spread = (b.radius || 70) * (b.bombSpread || 1);
      for (let i = 0; i < b.bombs; i++) {
        const a = (Math.PI * 2 * i) / b.bombs;
        const bx = x + Math.cos(a) * spread * 0.65;
        const by = y + Math.sin(a) * spread * 0.65;
        this.explode(bx, by, 36 * (b.bombSpread || 1), b.dmg * (b.bombMul || 0.55));
        if (b.twice) this.explode(bx, by, 28, b.dmg * (b.bombMul || 0.55) * 0.6);
      }
    }
    if (b.pool) {
      this.run.pools.push({
        x,
        y,
        r: b.poolAll ? Math.hypot(this.worldW, this.worldH) : b.radius,
        life: b.pool,
        dps: b.poolDmg,
        resin: b.resin,
        pull: b.pull,
        pit: b.pit,
        magma: b.magma,
      });
    }
    if (b.twin) this.fireGrenade(true);
  }

  shapeBlast(b) {
    const ang = Math.atan2(b.vy, b.vx);
    const arms = b.shape === "star" ? 4 : b.shape === "cross" ? 2 : 1;
    const reach = (b.radius || 88) * (b.reach || 1.3);
    const width = b.width || 0.7;
    this.run.fx.push({ kind: "ring", x: b.x, y: b.y, r: 8, max: b.radius, life: 0.25, color: "#fb7185" });
    for (let arm = 0; arm < arms; arm++) {
      const a = ang + (arm * Math.PI) / arms;
      const x2 = b.x + Math.cos(a) * reach;
      const y2 = b.y + Math.sin(a) * reach;
      this.run.fx.push({ kind: "beam", x1: b.x, y1: b.y, x2, y2, life: 0.16, color: "#fb7185", w: 10 + width * 8 });
      for (const e of this.run.enemies) {
        if (e.dead) continue;
        const rel = normAng(angTo(b, e) - a);
        if (Math.abs(rel) < width && dist(b, e) < reach + e.r) this.damage(e, b.dmg, "#fb7185");
      }
    }
  }

  explode(x, y, radius, dmg) {
    this.burst(x, y, "#fb7185", 18);
    this.audio.boom();
    for (const e of this.run.enemies) {
      if (!e.dead && dist(e, { x, y }) < radius) this.damage(e, dmg, "#fb7185");
    }
  }

  spark(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.run.fx.push({
        kind: "dot",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.28 + Math.random() * 0.25,
        color,
        r: 1.6,
      });
    }
  }

  burst(x, y, color, n) {
    this.spark(x, y, color, n);
    this.run.fx.push({ kind: "ring", x, y, r: 8, max: 48, life: 0.25, color });
  }

  showLevelClear() {
    const r = this.run;
    r.levelsCleared += 1;
    this.state = "levelclear";
    const coins = r.coins - (r.levelCoins || 0);
    const first = { 1: 8, 2: 12, 3: 20 };
    const cleared = new Set(this.profile?.clearedLevels || []);
    const crystals = cleared.has(r.level) ? 0 : first[r.level] || 0;
    this.audio.win();
    this.ui.showLevelClear({
      level: r.level,
      coins,
      crystals,
      canNext: r.level < LEVELS,
    });
  }

  continueLevel() {
    if (this.coop) {
      this.sendCoop({ t: "continue" });
      return;
    }
    if (this.remote) {
      this.remoteAction = { action: "continue" };
      return;
    }
    const r = this.run;
    if (r.level >= LEVELS) {
      this.end(true);
      return;
    }
    r.level += 1;
    r.chapter = r.level;
    r.wave = 1;
    r.endless = false;
    r.power = 1;
    r.levelCoins = r.coins;
    r.tower.hp = r.tower.maxHp;
    r.enemies = [];
    r.bullets = [];
    r.spawnQueue = [];
    r.combo = 0;
    r.comboType = null;
    this.state = "play";
    this.ui.hideLevelClear();
    this.ui.updateHud(r);
    this.queueWave();
  }

  beginEndless() {
    if (this.coop) {
      this.sendCoop({ t: "endless" });
      return;
    }
    if (this.remote) {
      this.remoteAction = { action: "endless" };
      return;
    }
    const r = this.run;
    r.endless = true;
    r.power = 2;
    r.wave = 7;
    r.tower.hp = r.tower.maxHp;
    r.enemies = [];
    r.bullets = [];
    r.spawnQueue = [];
    this.state = "play";
    this.ui.hideLevelClear();
    this.ui.toast("БЕСКОНЕЧНЫЙ РЕЖИМ");
    this.queueWave();
  }

  exitAfterLevel() {
    if (this.coop) {
      this.sendCoop({ t: "exit" });
      return;
    }
    if (this.remote) {
      this.remoteAction = { action: "exit" };
      return;
    }
    const r = this.run;
    const won = r.levelsCleared >= LEVELS && (r.startedLevel || 1) === 1;
    this.end(won);
  }

  facts() {
    return {
      runId: this.run.runId,
      startedLevel: this.run.startedLevel || 1,
      kills: { ...this.run.kills },
      wavesCleared: Math.min(18, this.run.wavesCleared),
      levelsCleared: this.run.levelsCleared,
      endedLevel: this.run.level,
      endedWave: Math.min(6, this.run.wave),
      won: !!this.run.won,
    };
  }

  end(win) {
    this.state = "result";
    this.run.won = win;
    const run = this.run;
    const progress = (run.level - 1) * 6 + run.wave;
    this.meta.bestWave = Math.max(this.meta.bestWave, progress);
    this.meta.bestLevel = Math.max(this.meta.bestLevel || 1, win ? LEVELS : run.level);
    this.ui.save();
    const facts = this.facts();
    rememberPending(facts);
    this.ui.showResult(win, run, null, { pending: true });
    this.claimFacts(facts, run);
    win ? this.audio.win() : this.audio.lose();
  }

  async claimFacts(facts, run) {
    if (!api?.claimRun) return;
    try {
      const result = await api.claimRun(facts);
      forgetPending(facts.runId);
      if (result.profile) this.ui.applyProfile?.(result.profile);
      if (this.run && this.run.runId === facts.runId) this.ui.showResult(!!facts.won, run, result.granted);
    } catch {
      if (this.run && this.run.runId === facts.runId) this.ui.showResult(!!facts.won, run, null, { pending: true });
    }
  }

  update(dt) {
    if (this.state !== "play" || !this.run) {
      this.draw(0);
      return;
    }
    const r = this.run;
    const tw = r.tower;

    if (r.seats) ensureSeats(r, this.worldW, this.worldH);
    else {
      tw.x = this.worldW / 2;
      tw.y = this.worldH / 2;
    }

    if (r.seats) {
      for (const seat of r.seats) {
        const focused = seat.pointer?.down;
        let targetAng = seat.angle;
        if (focused) targetAng = angTo(seat, seat.pointer);
        else {
          const nearest = this.nearest(seat);
          if (nearest) targetAng = angTo(seat, nearest);
        }
        const diff = normAng(targetAng - seat.angle);
        const turn = focused ? 12 : Math.max(r.gun.autoTurn, 8);
        seat.angle += clamp(diff, -turn * dt, turn * dt);
        seat.cd -= dt;
        seat.hitCd = Math.max(0, seat.hitCd - dt);
        if (seat.cd <= 0) {
          this.fireGun(seat);
          seat.cd = 1 / r.gun.rate;
        }
      }
    } else {
      const focused = this.pointer.down;
      let targetAng = r.gun.angle;
      if (focused) targetAng = angTo(tw, this.pointer);
      else {
        const nearest = this.nearest(tw);
        if (nearest) targetAng = angTo(tw, nearest);
      }
      const diff = normAng(targetAng - r.gun.angle);
      const turn = focused ? 12 : Math.max(r.gun.autoTurn, 8);
      r.gun.angle += clamp(diff, -turn * dt, turn * dt);
      r.gun.cd -= dt;
      if (r.gun.cd <= 0) {
        this.fireGun();
        r.gun.cd = 1 / r.gun.rate;
      }
    }

    if (r.overdrive.left > 0) r.overdrive.left -= dt;
    if (tw.regen) tw.hp = Math.min(tw.maxHp, tw.hp + tw.regen * dt);
    tw.hitCd = Math.max(0, tw.hitCd - dt);

    for (const [id, st] of Object.entries(r.wepStats)) {
      if (!r.weapons[id] || st.timer === undefined) continue;
      st.timer -= dt;
      if (st.timer <= 0) {
        if (id === "laser") this.fireLaser();
        if (id === "scatter") this.fireScatter();
        if (id === "grenade") this.fireGrenade();
        if (id === "emp") this.fireEmp();
        st.timer = st.cd;
      }
      if (id === "scatter" && st.pending > 0) {
        st.pendingIn -= dt;
        if (st.pendingIn <= 0) {
          st.pending = 0;
          const t = this.nearest(r.tower);
          if (t) this.scatterVolley(st, t);
        }
      }
      if (id === "laser" && st.spin) st.spinAngle = (st.spinAngle || 0) + dt * 1.8;
      if (id === "emp" && st.pending > 0) {
        st.pendingIn -= dt;
        if (st.pendingIn <= 0) {
          st.pending -= 1;
          st.pendingIn = 0.16;
          this.pulseEmp(true);
        }
      }
    }
    for (const beam of r.beams) {
      if (beam.life <= 0) continue;
      beam.tick -= dt;
      if (beam.tick > 0) continue;
      beam.tick = 0.2;
      for (const e of r.enemies) {
        if (e.dead) continue;
        if (pointLine(e.x, e.y, beam.x1, beam.y1, beam.x2, beam.y2) < beam.w + e.r) this.damage(e, beam.dps * 0.2, "#60a5fa", false);
      }
    }
    r.beams = r.beams.filter((beam) => beam.life > 0);

    if (r.weapons.orb && r.wepStats.orb) this.updateOrbs(dt, tw);
    for (const pool of r.pools) {
      pool.life -= dt;
      for (const e of r.enemies) {
        if (e.dead || dist(e, pool) > pool.r) continue;
        e.hp -= pool.dps * dt;
        e.slow = Math.max(e.slow || 0, pool.resin ? 0.25 : 0.4);
        e.slowMul = 0.2;
        if (pool.pit) e.freeze = Math.max(e.freeze || 0, pool.pit);
        if (pool.pull) {
          const a = angTo(e, pool);
          e.x += Math.cos(a) * 70 * dt;
          e.y += Math.sin(a) * 70 * dt;
        }
        if (e.hp <= 0) {
          const x = e.x;
          const y = e.y;
          this.kill(e);
          if (pool.magma) this.explode(x, y, 56, pool.dps);
        }
      }
    }
    r.pools = r.pools.filter((pool) => pool.life > 0);

    if (r.weapons.drone && r.drone) {
      this.syncDrones();
      const st = r.drone;
      const claimed = new Set();
      r.drones.forEach((d, i) => {
        const own = this.nearest(d, (e) => !claimed.has(e));
        const t = own || this.nearest(d);
        if (t) claimed.add(t);
        const n = r.drones.length;
        const spread = (i - (n - 1) / 2) * 0.85;
        const orbit = d.orbit ?? i * 1.2;
        const hover = t ? angTo(tw, t) + spread : orbit;
        const want = t
          ? { x: t.x + Math.cos(hover) * 110, y: t.y + Math.sin(hover) * 110 }
          : { x: tw.x + Math.cos(orbit) * 150, y: tw.y + Math.sin(orbit) * 150 };
        const glide = Math.min(0.08, 1.15 * dt);
        d.x = lerp(d.x, want.x, glide);
        d.y = lerp(d.y, want.y, glide);
        d.cd -= dt;
        if (t && d.cd <= 0) {
          const pellets = st.pellets || 1;
          const a = angTo(d, t);
          for (let i = 0; i < pellets; i++) {
            const ang = a + (i - (pellets - 1) / 2) * 0.12;
            r.bullets.push({
              x: d.x,
              y: d.y,
              vx: Math.cos(ang) * (st.speed || 560),
              vy: Math.sin(ang) * (st.speed || 560),
              dmg: st.dmg,
              r: 3.4,
              life: st.life || 0.9,
              pierce: st.pierce || 0,
              falloff: st.falloff || 0,
              bombRadius: st.bombOnHit ? st.radius : 0,
              bombDmg: st.bombOnHit ? st.dmg * st.bombMul : 0,
              color: "#f472b6",
              kind: "gun",
              hit: new Set(),
            });
          }
          if (st.bombs && !st.bombOnHit) this.explode(d.x, d.y + 10, st.radius, st.dmg * st.bombMul);
          d.cd = st.cd;
        }
      });
      const min = 78;
      for (let i = 0; i < r.drones.length; i++) {
        for (let j = i + 1; j < r.drones.length; j++) {
          const a = r.drones[i];
          const b = r.drones[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const gap = Math.hypot(dx, dy);
          if (gap >= min) continue;
          const nx = gap < 0.01 ? 1 : dx / gap;
          const ny = gap < 0.01 ? 0 : dy / gap;
          const push = (min - gap) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    if (r.bossIntro > 0) {
      r.bossIntro -= dt;
      r.bossPulse -= dt;
      this.shake = Math.max(this.shake, 6);
      if (r.bossPulse <= 0) {
        r.bossPulse = 0.42;
        const cx = this.worldW / 2;
        const cy = this.worldH / 2;
        this.run.fx.push({ kind: "ring", x: cx, y: cy, r: 24, max: 340, life: 0.5, color: "#ff5d9a" });
      }
      if (r.bossIntro <= 0) this.releaseBoss();
    } else if (r.spawnQueue.length) {
      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        for (let n = 0; n < 10 && r.spawnQueue.length; n++) this.spawnEnemy(r.spawnQueue.shift());
        r.spawnTimer = this.spawnGap();
      }
    } else if (!r.enemies.some((e) => !e.dead)) {
      r.wavePause += dt;
      if (r.wavePause > 1.15) {
        r.wavesCleared += 1;
        if (r.endless) {
          this.ui.onEndlessWave?.(r.level, r.wave);
          r.power *= 2;
          r.wave += 1;
          if (r.wave > 40) {
            this.exitAfterLevel();
            this.draw(dt);
            return;
          }
          this.queueWave();
          this.draw(dt);
          return;
        }
        if (r.wave === 6) {
          this.showLevelClear();
          this.draw(dt);
          return;
        }
        r.wave += 1;
        this.queueWave();
      }
    }

    for (const e of r.enemies) {
      if (e.dead) continue;
      const home = r.seats ? nearestSeat(r.seats, e) : tw;
      const a = angTo(e, home);
      let slow = 1;
      if (e.freeze > 0) {
        e.freeze -= dt;
        slow = 0;
      } else if (e.slow > 0) {
        e.slow -= dt;
        slow = e.slowMul ?? 0.45;
      }
      let vx = Math.cos(a) * e.speed * slow;
      let vy = Math.sin(a) * e.speed * slow;
      if (e.zigzag) {
        e.phase += dt * 8;
        vx += Math.cos(e.phase) * 70;
      }
      e.x += vx * dt;
      e.y += vy * dt;
      if (e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + 4 * dt);

      if (e.burn > 0) {
        e.burn -= dt;
        e.hp -= (e.burnDps || 0) * dt;
        if (e.hp <= 0) {
          const x = e.x;
          const y = e.y;
          const boom = this.run.wepStats.laser?.ash ? e.burnDps : 0;
          this.kill(e);
          if (boom) this.explode(x, y, 78, boom);
          continue;
        }
      }
      const emp = r.wepStats.emp;
      if (emp?.trap && r.weapons.emp && dist(e, tw) < (emp.full ? 9999 : emp.radius)) {
        e.slow = Math.max(e.slow || 0, 0.2);
        e.slowMul = emp.slowMul ?? 0.45;
        e.inEmp = true;
      } else if (e.inEmp) {
        e.inEmp = false;
        if (emp?.prison) e.slow = Math.max(e.slow || 0, emp.prison);
      }
      const hitCore = r.seats ? home : tw;
      if (dist(e, hitCore) < e.r + (hitCore.r || tw.r) && (hitCore.hitCd || 0) <= 0 && tw.hitCd <= 0) {
        const orb = r.wepStats.orb;
        const blocked = tw.guard > 0 || (orb?.branch === "ward" && orb.guard > 0);
        if (blocked) {
          if (tw.guard > 0) tw.guard -= 1;
          else orb.guard -= 1;
          tw.hitCd = 0.35;
          hitCore.hitCd = 0.35;
          this.burst(hitCore.x, hitCore.y, "#34d399", 10);
          if (orb?.reflect) this.damage(e, e.dmg * 3, "#34d399");
          if (orb?.flash) this.explode(tw.x, tw.y, orb.radius, orb.dmg * 6);
          if (orb?.mend) tw.hp = Math.min(tw.maxHp, tw.hp + orb.mend);
          continue;
        }
        tw.hp -= e.dmg;
        tw.hitCd = e.boss ? 0.35 : 0.45;
        hitCore.hitCd = tw.hitCd;
        this.shake = 7;
        this.burst(hitCore.x, hitCore.y, "#ff5d7a", 8);
        if (!e.boss) {
          e.x -= Math.cos(a) * 36;
          e.y -= Math.sin(a) * 36;
        }
        if (tw.hp <= 0) {
          tw.hp = 0;
          this.end(false);
          this.draw(dt);
          return;
        }
        this.ui.updateHud(r);
      }
    }

    for (const b of r.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const bounce = reflectBullet(b, this.worldW, this.worldH);
      if (bounce?.swarm && !bounce.died) this.spawnSwarm(b);
      if (b.edged && b.life > 0 && b.kind === "gun") this.steerBounce(b, dt);
      if (b.kind === "nade" && (b.life < 0.05 || this.hitAny(b))) {
        this.blast(b);
        b.life = 0;
        continue;
      }
      for (const e of r.enemies) {
        if (e.dead || b.hit.has(e)) continue;
        if (dist(b, e) < b.r + e.r) {
          const crit = this.damage(e, b.dmg, b.color, true, !!b.guaranteedCrit);
          if (crit && b.canChain) r.gun.forceNext = true;
          if (b.knock) {
            const a = angTo(tw, e);
            e.x += Math.cos(a) * b.knock * 0.12;
            e.y += Math.sin(a) * b.knock * 0.12;
          }
          if (b.bog || b.cordon) {
            e.slow = Math.max(e.slow || 0, 1);
            e.slowMul = b.cordon ? 0.05 : 0.12;
          }
          if (b.cluster && b.shards && !e.dead) this.burstPellets(e.x, e.y, b.shards, b.dmg * (b.shardMul || 0.45), b.shardLife || 0.16, b.shardPierce || 0, !!b.echo);
          if (b.avalanche && e.dead) this.burstPellets(e.x, e.y, b.shards || 4, b.dmg * 0.5, 0.2, 0, false);
          b.hit.add(e);
          if (bulletShouldStop(b)) {
            if (b.bombRadius) this.explode(b.x, b.y, b.bombRadius, b.bombDmg);
            b.life = 0;
            break;
          }
        }
      }
    }

    r.bullets = r.bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < this.worldW + 40 && b.y > -40 && b.y < this.worldH + 40);
    r.enemies = r.enemies.filter((e) => !e.dead);
    for (const f of r.fx) {
      f.life -= dt;
      if (f.kind === "dot") {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      if (f.kind === "text") f.y += f.vy * dt;
      if (f.kind === "ring") f.r = lerp(f.r, f.max, 8 * dt);
    }
    r.fx = r.fx.filter((f) => f.life > 0);
    r.comboFlash = Math.max(0, r.comboFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.ui.setCore?.(r);
    this.draw(dt);
  }

  hitAny(b) {
    return this.run.enemies.some((e) => !e.dead && dist(b, e) < 16 + e.r);
  }

  draw() {
    if (this.headless || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05060c";
    ctx.fillRect(0, 0, w, h);
    const shx = (Math.random() - 0.5) * this.shake * this.dpr;
    const shy = (Math.random() - 0.5) * this.shake * this.dpr;
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, (this.ox + shx / this.dpr) * this.dpr, (this.oy + shy / this.dpr) * this.dpr);

    ctx.fillStyle = "#070814";
    ctx.fillRect(0, 0, this.worldW, this.worldH);
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#9bb6ff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(90,120,200,0.07)";
    ctx.lineWidth = 1;
    for (let y = 40; y < this.worldH; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.worldW, y);
      ctx.stroke();
    }

    if (!this.run) return;
    const tw = this.run.tower;

    const grd = ctx.createRadialGradient(tw.x, tw.y, 20, tw.x, tw.y, 260);
    grd.addColorStop(0, "rgba(126,232,255,0.08)");
    grd.addColorStop(1, "rgba(126,232,255,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(tw.x, tw.y, 260, 0, Math.PI * 2);
    ctx.fill();

    for (const e of this.run.enemies) this.drawEnemy(ctx, e);
    for (const b of this.run.bullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const f of this.run.fx) this.drawFx(ctx, f);

    if (this.run.weapons.orb && this.run.wepStats.orb) {
      const o = this.run.wepStats.orb;
      const spots = o.spots || [];
      for (let i = 0; i < o.count; i++) {
        const spot = spots[i] || this.orbHome(o, i, tw);
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, o.branch === "blade" ? 6 : 9, 0, Math.PI * 2);
        ctx.fill();
        if (o.branch === "blade") {
          const a = Math.atan2(spot.y - tw.y, spot.x - tw.x);
          ctx.strokeStyle = "#34d399";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(spot.x, spot.y);
          ctx.lineTo(spot.x + Math.cos(a + 1.2) * 18 * (o.reach || 1), spot.y + Math.sin(a + 1.2) * 18 * (o.reach || 1));
          ctx.stroke();
        }
      }
    }
    for (const pool of this.run.pools || []) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, Math.min(pool.r, 280), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const d of this.run.drones) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.fillStyle = "#f472b6";
      ctx.shadowColor = "#f472b6";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(20, 18);
      ctx.lineTo(0, 8);
      ctx.lineTo(-20, 18);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffe4f1";
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.run.seats?.length) {
      for (const seat of this.run.seats) this.drawTower(ctx, seat);
    } else this.drawTower(ctx);
    if (this.run.bossIntro > 0) this.drawBossIntro(ctx);
  }

  drawBossIntro(ctx) {
    const t = this.run.bossIntro;
    const pulse = 0.5 + 0.5 * Math.sin((2.6 - t) * 16);
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    ctx.save();
    ctx.fillStyle = `rgba(80, 0, 30, ${0.28 + pulse * 0.18})`;
    ctx.fillRect(0, 0, this.worldW, this.worldH);
    ctx.strokeStyle = "#ff5d9a";
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.45 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 90 + pulse * 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffe08a";
    ctx.font = `800 ${92 + pulse * 22}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff4d88";
    ctx.shadowBlur = 32;
    ctx.fillText("БОСС", cx, cy);
    ctx.font = "700 28px Manrope, sans-serif";
    ctx.fillStyle = "#ffd0e2";
    ctx.shadowBlur = 0;
    ctx.fillText("ВОЛНА 6", cx, cy + 78);
    ctx.restore();
  }

  drawTower(ctx, seat) {
    const tw = seat || this.run.tower;
    const aimAngle = seat ? seat.angle : this.run.gun.angle;
    if (this.state === "play") {
      const manual = seat ? seat.pointer?.down : this.pointer.down;
      const aim = manual ? (seat ? seat.pointer : this.pointer) : this.nearest(tw);
      if (aim) {
        ctx.strokeStyle = manual ? "rgba(255,255,255,0.4)" : "rgba(126,232,255,0.28)";
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(tw.x, tw.y);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (gatling?.complete && gatling.naturalWidth) {
      const h = 128;
      const w = h * (gatling.naturalWidth / gatling.naturalHeight);
      ctx.save();
      ctx.translate(tw.x, tw.y);
      ctx.rotate(aimAngle + Math.PI / 2);
      ctx.drawImage(gatling, -w / 2, -h * 0.78, w, h);
      ctx.restore();
    }
  }

  drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.boss ? 22 : 8;
    if (e.boss) {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.type === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "triangle") {
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, e.r);
      ctx.lineTo(-e.r, e.r);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === "square") {
      ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
    } else if (e.type === "diamond") {
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      hex(ctx, 0, 0, e.r, e.color, true);
    }
    ctx.shadowBlur = 0;
    if (e.hp < e.maxHp || e.shield) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-e.r, -e.r - 10, e.r * 2, 4);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-e.r, -e.r - 10, e.r * 2 * clamp(e.hp / e.maxHp, 0, 1), 4);
      if (e.maxShield) {
        ctx.fillStyle = "#34d399";
        ctx.fillRect(-e.r, -e.r - 15, e.r * 2 * clamp(e.shield / e.maxShield, 0, 1), 3);
      }
    }
    ctx.restore();
  }

  drawFx(ctx, f) {
    ctx.globalAlpha = clamp(f.life * 3, 0, 0.8);
    ctx.strokeStyle = f.color;
    ctx.fillStyle = f.color;
    if (f.kind === "dot") {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r || 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === "ring") {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === "text") {
      ctx.globalAlpha = clamp(f.life * 2.2, 0, 1);
      ctx.font = `800 ${f.size || 18}px Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    } else if (f.kind === "beam") {
      const fade = clamp(f.life * 2.4, 0, 1);
      ctx.lineCap = "round";
      ctx.globalAlpha = fade * 0.45;
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = Math.max(18, (f.w || 8) * 3.6);
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = "#f8fbff";
      ctx.lineWidth = Math.max(5, (f.w || 8) * 0.9);
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = "butt";
    }
    ctx.globalAlpha = 1;
  }

  sendCoop(msg) {
    const ws = this.coop?.ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  feedCoop(snap) {
    if (!this.coop) return;
    this.coop.snap = snap;
    this.coopLock = true;
    this.worldW = 720;
    this.worldH = 1280;
    if (!this.run) this.run = {};
    this.state = snap.state;
    this.presentCoop(1);
    if (snap.state === "cards" && snap.cardKey !== this.cardKey) {
      this.cardKey = snap.cardKey;
      this.ui.showCards(snap.cards, snap.heading, 0);
    }
    if (snap.state === "play" && this.cardKey) {
      this.cardKey = "";
      this.ui.hideCards();
    }
    if (snap.state === "levelclear" && snap.levelClear && this._clearKey !== snap.wave) {
      this._clearKey = snap.wave;
      this.ui.showLevelClear(snap.levelClear);
    }
    if (snap.state === "result" && !this._resultShown) {
      this._resultShown = true;
      this.ui.showResult(!!snap.result?.won, this.run, snap.result?.granted || null, {});
    }
  }

  presentCoop(gain) {
    const snap = this.coop?.snap;
    if (!snap) return;
    const run = this.run || {};
    const pull = (prev, next) => {
      const map = new Map((prev || []).map((item) => [item.id, item]));
      return next.map((item) => {
        const old = map.get(item.id);
        if (!old || gain >= 1) return { ...item };
        return { ...item, x: old.x + (item.x - old.x) * gain, y: old.y + (item.y - old.y) * gain };
      });
    };
    run.enemies = pull(run.enemies, snap.enemies);
    run.bullets = pull(run.bullets, snap.bullets);
    run.drones = pull(run.drones, snap.drones);
    run.fx = [];
    run.pools = [];
    run.weapons = snap.weapons || {};
    run.wepStats = run.wepStats || {};
    run.pips = snap.pips || {};
    run.wave = snap.wave;
    run.chapter = snap.chapter;
    run.level = snap.level;
    run.coins = snap.coins;
    run.crit = { chance: snap.crit || 0 };
    run.overdrive = snap.overdrive;
    run.tower = { ...(run.tower || {}), ...snap.tower, r: 34 };
    run.runId = snap.runId;
    run.offer = { level: snap.offerLevel || 1 };
    run.bossIntro = 0;
    run.gun = run.gun || { angle: -Math.PI / 2 };
    const mine = this.coop.seat || 0;
    run.seats = snap.seats.map((seat, i) => {
      const prev = run.seats?.[i] || seat;
      const local = i === mine;
      const pointer = local ? this.pointer : null;
      let angle = prev.angle ?? seat.angle;
      if (local && pointer?.down && run.tower) {
        angle = Math.atan2(pointer.y - seat.y, pointer.x - seat.x);
      } else {
        let delta = seat.angle - angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        angle += delta * gain;
      }
      return { ...seat, r: 34, angle, pointer: local ? pointer : { down: false } };
    });
    this.run = run;
    this.ui.setCore?.(run);
    if (this._hudWave !== run.wave || this._hudCoins !== run.coins) {
      this._hudWave = run.wave;
      this._hudCoins = run.coins;
      this.ui.updateHud?.(run);
    }
  }

  loop(t) {
    if (this.coop?.snap) {
      this.presentCoop(0.42);
      if (t - (this.coop.sent || 0) > 50) {
        this.coop.sent = t;
        this.sendCoop({ t: "in", x: this.pointer.x, y: this.pointer.y, down: this.pointer.down });
      }
      this.draw(0);
      requestAnimationFrame((n) => this.loop(n));
      return;
    }
    if (this.remote) {
      this.draw(0);
      const due = this.remoteAction || (this.state === "play" && t - (this.syncedAt || 0) > 80);
      if (due && !this.syncing && api?.battleSync) {
        this.syncing = true;
        const action = this.remoteAction;
        this.remoteAction = null;
        api.battleSync({
          pointer: { x: this.pointer.x, y: this.pointer.y, down: this.pointer.down },
          speed: this.speed || 1,
          worldW: this.worldW,
          worldH: this.worldH,
          action: action?.action || "",
          cardId: action?.cardId || "",
        }).then((data) => {
          if (data?.snap) this.applySnap(data.snap);
          if (data?.profile) this.ui.applyProfile?.(data.profile);
        }).catch((error) => {
          this.ui.toast(error.message || "Нет связи с боем");
        }).finally(() => {
          this.syncing = false;
          this.syncedAt = performance.now();
        });
      }
      requestAnimationFrame((n) => this.loop(n));
      return;
    }
    const dt = Math.min(0.033, (t - (this.last || t)) / 1000) * (this.speed || 1);
    this.last = t;
    this.update(dt);
    requestAnimationFrame((n) => this.loop(n));
  }

  async startRemote(level) {
    const data = await api.battleStart({
      level,
      worldW: this.worldW,
      worldH: this.worldH,
    });
    this.remote = true;
    this.syncedAt = 0;
    this.applySnap(data.snap);
    this.ui.showPlay();
  }

  applySnap(snap) {
    const prev = this.state;
    this.state = snap.state;
    if (snap.worldW) this.worldW = snap.worldW;
    if (snap.worldH) this.worldH = snap.worldH;
    this.shake = snap.shake || 0;
    this.run = snap.run;
    this.ui.updateHud(this.run);
    this.ui.setCombo?.(this.run);
    for (const text of snap.toasts || []) this.ui.toast(text);
    if (snap.state === "cards" && snap.cardKey !== this.cardKey) {
      this.cardKey = snap.cardKey;
      this.ui.showCards(snap.cards, snap.heading, snap.rerollUsed || 0);
    }
    if (snap.state === "play" && prev === "cards") this.ui.hideCards();
    if (snap.state === "levelclear" && prev !== "levelclear" && snap.levelClear) this.ui.showLevelClear(snap.levelClear);
    if (snap.state === "play" && prev === "levelclear") this.ui.hideLevelClear();
    if (snap.state === "result" && prev !== "result" && snap.result) {
      this.ui.showResult(!!snap.result.won, this.run, snap.result.granted || null, snap.result.pending ? { pending: true } : {});
    }
  }
}

function hex(ctx, x, y, r, color, fill) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (fill) ctx.fill();
  else ctx.stroke();
}

function pointLine(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export { WEAPON_INFO };

function readPending() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    if (!parsed) return [];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function writePending(list) {
  if (!list.length) localStorage.removeItem(PENDING_KEY);
  else localStorage.setItem(PENDING_KEY, JSON.stringify(list.length === 1 ? list[0] : list));
}

function rememberPending(facts) {
  if (typeof localStorage === "undefined") return;
  const list = readPending().filter((item) => item.runId !== facts.runId);
  list.push(facts);
  writePending(list);
}

function forgetPending(runId) {
  writePending(readPending().filter((item) => item.runId !== runId));
}

export async function retryPendingClaims(onProfile) {
  for (const facts of readPending()) {
    try {
      const result = await api.claimRun(facts);
      forgetPending(facts.runId);
      if (result.profile) onProfile?.(result.profile);
    } catch {
      return;
    }
  }
}
