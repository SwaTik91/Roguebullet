import { SHAPES, WEAPON_INFO, enemyForWave, waveCount } from "./content.js";
import { rayEnd, reflectAngle } from "./laser.js";
import { bulletShouldStop, gunStep, gunXpToNext, reflectBullet, rollGunShot } from "./gun.js";
import { legendaryOffer, rollBattleOffer, weaponMilestone } from "./draft.js";
import { api, newId } from "./api.js";

const PENDING_KEY = "roguebullet-pending-run";

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
  constructor(canvas, ui, audio, meta) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.audio = audio;
    this.meta = meta;
    this.dpr = 1;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.worldW = 720;
    this.worldH = 1280;
    this.stars = [];
    this.pointer = { down: false, x: 360, y: 200 };
    this.shake = 0;
    this.speed = 1;
    this.state = "boot";
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
    this.worldH = 1280;
    this.worldW = 1280 * (w / h);
    this.scale = h / this.worldH;
    this.ox = 0;
    this.oy = 0;
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
      weapons: { gun: true, drone: true },
      wepStats: {},
      drones: [],
      drone: {
        dmg: 22,
        count: 1,
        cd: 0.26,
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
        dmg: 14 * atk,
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
    for (let i = 0; i < n; i++) this.run.spawnQueue.push(enemyForWave(Math.min(wave, 6), chapter, power));
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
      const cards = rollBattleOffer(this.run);
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

  async rerollCards() {
    const result = await api.buyReroll(this.run.runId, this.run.offer.level);
    if (result.profile) this.ui.applyProfile?.(result.profile);
    this.ui.showCards(rollBattleOffer(this.run), null, result.used);
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

  fireGun() {
    const g = this.run.gun;
    const over = this.run.overdrive.left > 0;
    const dmg = g.dmg * (over ? this.run.overdrive.mul : 1);
    const shot = rollGunShot(g);
    const a = g.angle;
    const spd = (g.speed || 680) * (over ? 1.15 : 1);
    const gap = g.gap || 12;
    const sideX = -Math.sin(a);
    const sideY = Math.cos(a);
    for (let i = 0; i < g.pellets; i++) {
      const off = (i - (g.pellets - 1) / 2) * gap;
      this.run.bullets.push({
        x: this.run.tower.x + Math.cos(a) * 38 + sideX * off,
        y: this.run.tower.y + Math.sin(a) * 38 + sideY * off,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        dmg,
        r: over ? 5.5 : 3.2,
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
      this.paintBeam(x, y, end.x, end.y, width, s.hold || 0.12, power);
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
    const beam = { kind: "beam", x1, y1, x2, y2, life, color: "#60a5fa", w: width, dps, tick: 0 };
    this.run.fx.push(beam);
    if (life > 0.2) this.run.beams.push(beam);
  }

  ignite(e, dps) {
    e.burn = Math.max(e.burn || 0, 1);
    e.burnDps = Math.max(e.burnDps || 0, dps);
  }

  fireScatter() {
    const s = this.run.wepStats.scatter;
    const t = this.nearest(this.run.tower);
    if (!t) return;
    const base = angTo(this.run.tower, t);
    for (let i = 0; i < s.n; i++) {
      const a = base + (i - (s.n - 1) / 2) * 0.09;
      this.run.bullets.push({
        x: this.run.tower.x,
        y: this.run.tower.y,
        vx: Math.cos(a) * 620,
        vy: Math.sin(a) * 620,
        dmg: s.dmg,
        r: 3,
        pierce: 0,
        knock: s.knock,
        life: 0.38,
        color: "#fbbf24",
        kind: "pellet",
        hit: new Set(),
      });
    }
  }

  fireGrenade() {
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

    tw.x = this.worldW / 2;
    tw.y = this.worldH / 2;

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

    if (r.weapons.orb && r.wepStats.orb) {
      const o = r.wepStats.orb;
      r.orbAngle += o.spin * dt;
      for (let i = 0; i < o.count; i++) {
        const a = r.orbAngle + (i * Math.PI * 2) / o.count;
        const ox = tw.x + Math.cos(a) * o.radius;
        const oy = tw.y + Math.sin(a) * o.radius;
        for (const e of r.enemies) {
          if (!e.dead && dist(e, { x: ox, y: oy }) < e.r + 12) this.damage(e, o.dmg * dt * 8, "#34d399", false);
        }
      }
    }

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
          ? { x: t.x + Math.cos(hover) * 86, y: t.y + Math.sin(hover) * 86 }
          : { x: tw.x + Math.cos(orbit) * 130, y: tw.y + Math.sin(orbit) * 130 };
        d.x = lerp(d.x, want.x, 3.4 * dt);
        d.y = lerp(d.y, want.y, 3.4 * dt);
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
      const min = 48;
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
      const a = angTo(e, tw);
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
      if (dist(e, tw) < e.r + tw.r && tw.hitCd <= 0) {
        if (tw.guard > 0) {
          tw.guard -= 1;
          tw.hitCd = 0.35;
          this.burst(tw.x, tw.y, "#c084fc", 10);
          continue;
        }
        tw.hp -= e.dmg;
        tw.hitCd = e.boss ? 0.35 : 0.45;
        this.shake = 7;
        this.burst(tw.x, tw.y, "#ff5d7a", 8);
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
      if (b.kind === "nade" && (b.life < 0.05 || this.hitAny(b))) {
        this.explode(b.x, b.y, b.radius, b.dmg);
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
    this.draw(dt);
  }

  hitAny(b) {
    return this.run.enemies.some((e) => !e.dead && dist(b, e) < 16 + e.r);
  }

  draw() {
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
      for (let i = 0; i < o.count; i++) {
        const a = this.run.orbAngle + (i * Math.PI * 2) / o.count;
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.arc(tw.x + Math.cos(a) * o.radius, tw.y + Math.sin(a) * o.radius, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const d of this.run.drones) {
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - 10);
      ctx.lineTo(d.x + 8, d.y + 8);
      ctx.lineTo(d.x - 8, d.y + 8);
      ctx.fill();
    }

    this.drawTower(ctx);
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

  drawTower(ctx) {
    const tw = this.run.tower;
    const over = this.run.overdrive.left > 0;
    const charge = this.run.overdrive.charge / this.run.overdrive.max;
    ctx.save();
    ctx.translate(tw.x, tw.y);
    ctx.strokeStyle = over ? "#ffe08a" : "rgba(126,232,255,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (over ? this.run.overdrive.left / this.run.overdrive.dur : charge));
    ctx.stroke();

    ctx.rotate(this.run.gun.angle + Math.PI / 2);
    ctx.fillStyle = over ? "#fff4c4" : "#9cefff";
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(8, -10);
    ctx.lineTo(-8, -10);
    ctx.fill();
    ctx.restore();

    hex(ctx, tw.x, tw.y, tw.r, over ? "#ffe08a" : "#7ee8ff", true);
    hex(ctx, tw.x, tw.y, tw.r * 0.55, "#12202c", true);

    const ratio = tw.hp / tw.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(tw.x - 46, tw.y + 46, 92, 8);
    ctx.fillStyle = ratio < 0.3 ? "#ff5d7a" : "#7ee8ff";
    ctx.fillRect(tw.x - 46, tw.y + 46, 92 * ratio, 8);

    if (this.state === "play") {
      const manual = this.pointer.down;
      const aim = manual ? this.pointer : this.nearest(tw);
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
      ctx.lineWidth = f.w;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  loop(t) {
    const dt = Math.min(0.033, (t - (this.last || t)) / 1000) * (this.speed || 1);
    this.last = t;
    this.update(dt);
    requestAnimationFrame((n) => this.loop(n));
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
