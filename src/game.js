import { SHAPES, WEAPON_INFO, pickCards, enemyForWave, waveCount } from "./content.js";

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

  startRun() {
    const atk = 1 + this.meta.atk * 0.12;
    const hp = 220 + this.meta.hp * 40;
    this.run = {
      level: 1,
      chapter: 1,
      wave: 1,
      kills: 0,
      coins: 0,
      xp: 0,
      nextXp: 18,
      comboNeed: 6,
      comboType: null,
      combo: 0,
      comboFlash: 0,
      overdrive: { charge: 8 * this.meta.charge, max: 100, dur: 3.4, left: 0, mul: 1.85 },
      weapons: { gun: true },
      wepStats: {},
      drones: [],
      orbAngle: 0,
      gun: {
        angle: -Math.PI / 2,
        dmg: 9 * atk,
        rate: 8,
        pellets: 1,
        pierce: 0,
        bounce: false,
        killStack: 0,
        autoTurn: 2.6,
        focusMul: 1.65,
        cd: 0,
      },
      crit: { chance: 0.08, mul: 2 },
      tower: { x: this.worldW / 2, y: this.worldH / 2, r: 34, hp, maxHp: hp, regen: 0, slide: 280, hitCd: 0 },
      enemies: [],
      bullets: [],
      fx: [],
      spawnQueue: [],
      spawnTimer: 0,
      wavePause: 1.2,
      won: false,
    };
    this.queueWave();
    this.state = "play";
    this.ui.showPlay();
    this.ui.updateHud(this.run);
  }

  queueWave() {
    const { wave, chapter } = this.run;
    this.run.spawnQueue = [];
    if (wave % 6 === 0) {
      this.run.spawnQueue.push(enemyForWave(wave, chapter));
      const escorts = 14 + chapter * 4;
      for (let i = 0; i < escorts; i++) this.run.spawnQueue.push(enemyForWave(3 + (i % 3), chapter));
    } else {
      const n = waveCount(wave);
      for (let i = 0; i < n; i++) this.run.spawnQueue.push(enemyForWave(wave, chapter));
    }
    this.run.spawnTimer = 0.45;
    this.run.wavePause = 0;
    this.ui.updateHud(this.run);
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

  damage(e, amt, src, canCrit = true) {
    if (e.dead) return;
    let crit = false;
    if (canCrit && this.run.crit && Math.random() < this.run.crit.chance) {
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
      return;
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
    this.run.kills += 1;
    this.run.coins += e.coins;
    this.run.xp += e.xp;
    this.run.gun.dmg *= 1 + this.run.gun.killStack;
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

    if (this.run.xp >= this.run.nextXp && this.state === "play") {
      this.run.xp -= this.run.nextXp;
      this.run.nextXp = Math.round(this.run.nextXp * 1.28 + 6);
      this.offerCards();
    }
    this.ui.updateHud(this.run);
  }

  prismBurst(x, y) {
    this.audio.boom();
    this.burst(x, y, "#c084fc", 26);
    for (const e of this.run.enemies) {
      if (!e.dead && dist(e, { x, y }) < 210) this.damage(e, 55 + this.run.wave * 6, "#c084fc");
    }
    this.shake = 8;
  }

  offerCards() {
    this.state = "cards";
    this.ui.showCards(pickCards(this.run));
  }

  applyCard(card) {
    card.apply(this.run);
    if (card.weapon === "drone") this.syncDrones();
    this.state = "play";
    this.ui.hideCards();
    this.ui.updateHud(this.run);
    this.audio.pickup();
  }

  syncDrones() {
    const need = this.run.wepStats.drone?.count || 0;
    while (this.run.drones.length < need) {
      this.run.drones.push({
        x: this.run.tower.x,
        y: this.run.tower.y - 80,
        a: Math.random() * Math.PI * 2,
        cd: 0,
      });
    }
  }

  fireGun() {
    const g = this.run.gun;
    const over = this.run.overdrive.left > 0;
    const focused = this.pointer.down;
    const dmg = g.dmg * (focused ? g.focusMul : 1) * (over ? this.run.overdrive.mul : 1);
    const a = g.angle;
    const spd = over ? 780 : 680;
    const gap = 12;
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
        bounce: g.bounce,
        life: 1.15,
        color: over ? "#fff1b8" : "#7ee8ff",
        kind: "gun",
        hit: new Set(),
      });
    }
    const gain = (this.pointer.down ? 3.4 : 1.6) * (1 + this.meta.charge * 0.18);
    if (this.run.overdrive.left <= 0) this.run.overdrive.charge += gain;
    if (this.run.overdrive.charge >= this.run.overdrive.max) {
      this.run.overdrive.charge = 0;
      this.run.overdrive.left = this.run.overdrive.dur;
      this.audio.overdrive();
      this.ui.toast("ОВЕРДРАЙВ");
    }
    this.audio.shoot();
  }

  fireLaser() {
    const s = this.run.wepStats.laser;
    const target = this.nearest(this.run.tower, (e) => e.hp > e.maxHp * 0.3) || this.nearest(this.run.tower);
    if (!target) return;
    const a = angTo(this.run.tower, target);
    const x2 = this.run.tower.x + Math.cos(a) * 1400;
    const y2 = this.run.tower.y + Math.sin(a) * 1400;
    this.run.fx.push({ kind: "beam", x1: this.run.tower.x, y1: this.run.tower.y, x2, y2, life: 0.12, color: "#60a5fa", w: s.width });
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      const d = pointLine(e.x, e.y, this.run.tower.x, this.run.tower.y, x2, y2);
      if (d < s.width + e.r) this.damage(e, s.dmg, "#60a5fa");
    }
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
    this.run.fx.push({ kind: "ring", x: this.run.tower.x, y: this.run.tower.y, r: 20, max: s.radius, life: 0.35, color: "#c084fc" });
    for (const e of this.run.enemies) {
      if (!e.dead && dist(e, this.run.tower) < s.radius) {
        this.damage(e, s.dmg, "#c084fc");
        e.slow = Math.max(e.slow, 0.7 + s.slow);
      }
    }
    this.audio.boom();
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

  advanceLevel() {
    const r = this.run;
    if (r.level >= LEVELS) {
      this.end(true);
      return;
    }
    r.level += 1;
    r.chapter = r.level;
    r.wave = 1;
    r.tower.hp = r.tower.maxHp;
    r.enemies = [];
    r.bullets = [];
    r.spawnQueue = [];
    r.combo = 0;
    r.comboType = null;
    this.meta.bestLevel = Math.max(this.meta.bestLevel || 1, r.level);
    this.ui.save();
    this.ui.updateHud(r);
    this.ui.toast(`УРОВЕНЬ ${r.level}`);
    this.audio.win();
    this.queueWave();
  }

  end(win) {
    this.state = "result";
    this.run.won = win;
    const progress = (this.run.level - 1) * 6 + this.run.wave;
    const gain = this.run.coins + (win ? 40 : 0) + progress;
    this.meta.coins += gain;
    this.meta.bestWave = Math.max(this.meta.bestWave, progress);
    this.meta.bestLevel = Math.max(this.meta.bestLevel || 1, win ? LEVELS : this.run.level);
    this.ui.save();
    this.ui.showResult(win, this.run, gain);
    win ? this.audio.win() : this.audio.lose();
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
    }

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

    if (r.weapons.drone && r.wepStats.drone) {
      this.syncDrones();
      const st = r.wepStats.drone;
      for (const d of r.drones) {
        const t = this.nearest(d);
        const want = t ? t : { x: tw.x, y: tw.y - 140 };
        d.x = lerp(d.x, want.x, 1.8 * dt);
        d.y = lerp(d.y, want.y - 40, 1.8 * dt);
        d.cd -= dt;
        if (t && d.cd <= 0) {
          const a = angTo(d, t);
          r.bullets.push({
            x: d.x,
            y: d.y,
            vx: Math.cos(a) * 560,
            vy: Math.sin(a) * 560,
            dmg: st.dmg,
            r: 3,
            life: 0.9,
            color: "#f472b6",
            kind: "gun",
            hit: new Set(),
          });
          if (st.bombs) {
            this.explode(d.x, d.y + 10, 46, st.dmg * 1.6);
          }
          d.cd = st.cd;
        }
      }
    }

    if (r.spawnQueue.length) {
      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        this.spawnEnemy(r.spawnQueue.shift());
        r.spawnTimer = this.spawnGap();
      }
    } else if (!r.enemies.some((e) => !e.dead)) {
      r.wavePause += dt;
      if (r.wavePause > 1.15) {
        if (r.wave === 6) {
          this.advanceLevel();
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
      const slow = e.slow > 0 ? 0.45 : 1;
      if (e.slow > 0) e.slow -= dt;
      let vx = Math.cos(a) * e.speed * slow;
      let vy = Math.sin(a) * e.speed * slow;
      if (e.zigzag) {
        e.phase += dt * 8;
        vx += Math.cos(e.phase) * 70;
      }
      e.x += vx * dt;
      e.y += vy * dt;
      if (e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + 4 * dt);

      if (dist(e, tw) < e.r + tw.r && tw.hitCd <= 0) {
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
      if (b.bounce) {
        if (b.x < 8 || b.x > this.worldW - 8) b.vx *= -1;
        if (b.y < 8 || b.y > this.worldH - 8) b.vy *= -1;
      }
      if (b.kind === "nade" && (b.life < 0.05 || this.hitAny(b))) {
        this.explode(b.x, b.y, b.radius, b.dmg);
        b.life = 0;
        continue;
      }
      for (const e of r.enemies) {
        if (e.dead || b.hit.has(e)) continue;
        if (dist(b, e) < b.r + e.r) {
          this.damage(e, b.dmg, b.color);
          if (b.knock) {
            const a = angTo(tw, e);
            e.x += Math.cos(a) * b.knock * 0.12;
            e.y += Math.sin(a) * b.knock * 0.12;
          }
          b.hit.add(e);
          if (!b.pierce) {
            b.life = 0;
            break;
          }
          b.pierce -= 1;
          if (b.pierce < 0) {
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
    ctx.shadowBlur = 8;
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
    const dt = Math.min(0.033, (t - (this.last || t)) / 1000);
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
