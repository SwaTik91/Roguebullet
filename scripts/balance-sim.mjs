import { enemyForWave } from "../src/content.js";

const W = 720;
const H = 1280;
const TX = W / 2;
const TY = H / 2;
const DT = 0.05;
const SECONDS = 24;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spawn(wave, rng) {
  const def = enemyForWave(wave, 1, 1, rng);
  const side = Math.floor(rng() * 4);
  let x;
  let y;
  if (side === 0) {
    x = 40 + rng() * (W - 80);
    y = -36;
  } else if (side === 1) {
    x = 40 + rng() * (W - 80);
    y = H + 36;
  } else if (side === 2) {
    x = -36;
    y = 40 + rng() * (H - 80);
  } else {
    x = W + 36;
    y = 40 + rng() * (H - 80);
  }
  return { ...def, x, y, slow: 0, hp: def.hp + (def.shield || 0) };
}

function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function nearest(list, from, pred) {
  let best = null;
  let bestD = 1e9;
  for (const e of list) {
    if (e.hp <= 0 || (pred && !pred(e))) continue;
    const d = dist(e, from);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function hurt(e, amount, dealt) {
  if (e.hp <= 0) return;
  const hit = Math.min(e.hp, amount);
  e.hp -= hit;
  dealt.total += hit;
}

export function simulate(loadout, wave, seed = 1) {
  const rng = lcg(seed);
  const enemies = [];
  const bullets = [];
  const dealt = { gun: 0, drone: 0, laser: 0, scatter: 0, grenade: 0, emp: 0, orb: 0, total: 0 };
  const gun = { ...loadout.gun, cd: 0, angle: -Math.PI / 2 };
  const drone = loadout.drone ? { ...loadout.drone, cd: 0, x: TX, y: TY - 120 } : null;
  const wep = {};
  for (const [id, st] of Object.entries(loadout.wep || {})) wep[id] = { ...st, timer: 0 };
  const orb = wep.orb ? { angle: 0 } : null;
  let core = 220;
  let leaks = 0;
  let killed = 0;
  let spawnIn = 0.4;
  let left = wave % 6 === 0 ? 1 : 80;
  for (let t = 0; t < SECONDS; t += DT) {
    spawnIn -= DT;
    if (spawnIn <= 0 && left > 0) {
      const batch = Math.min(10, left);
      for (let i = 0; i < batch; i++) enemies.push(spawn(wave, rng));
      left -= batch;
      spawnIn = 1.05;
    }
    if (gun) {
      const target = nearest(enemies, { x: TX, y: TY });
      if (target) gun.angle = Math.atan2(target.y - TY, target.x - TX);
      gun.cd -= DT;
      if (gun.cd <= 0 && target) {
        bullets.push({
          x: TX + Math.cos(gun.angle) * 38,
          y: TY + Math.sin(gun.angle) * 38,
          vx: Math.cos(gun.angle) * gun.speed,
          vy: Math.sin(gun.angle) * gun.speed,
          dmg: gun.dmg,
          life: gun.life,
          who: "gun",
          hit: new Set(),
        });
        gun.cd = 1 / gun.rate;
      }
    }
    if (drone) {
      const target = nearest(enemies, drone);
      if (target) {
        drone.x += ((target.x - drone.x) / (dist(drone, target) || 1)) * 180 * DT;
        drone.y += ((target.y - drone.y) / (dist(drone, target) || 1)) * 180 * DT;
      }
      drone.cd -= DT;
      if (target && drone.cd <= 0) {
        const a = Math.atan2(target.y - drone.y, target.x - drone.x);
        bullets.push({
          x: drone.x,
          y: drone.y,
          vx: Math.cos(a) * 560,
          vy: Math.sin(a) * 560,
          dmg: drone.dmg,
          life: 0.9,
          who: "drone",
          hit: new Set(),
        });
        drone.cd = drone.cdRate;
      }
    }
    if (wep.laser) {
      wep.laser.timer -= DT;
      if (wep.laser.timer <= 0) {
        const target = nearest(enemies, { x: TX, y: TY });
        if (target) {
          const a = Math.atan2(target.y - TY, target.x - TX);
          const x2 = TX + Math.cos(a) * 1400;
          const y2 = TY + Math.sin(a) * 1400;
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            const dx = x2 - TX;
            const dy = y2 - TY;
            const l2 = dx * dx + dy * dy;
            const tt = Math.max(0, Math.min(1, ((e.x - TX) * dx + (e.y - TY) * dy) / l2));
            const gap = Math.hypot(e.x - (TX + tt * dx), e.y - (TY + tt * dy));
            if (gap < wep.laser.width + e.r) {
              const before = dealt.total;
              hurt(e, wep.laser.dmg, dealt);
              dealt.laser += dealt.total - before;
            }
          }
        }
        wep.laser.timer = wep.laser.cd;
      }
    }
    if (wep.scatter) {
      wep.scatter.timer -= DT;
      if (wep.scatter.timer <= 0) {
        const target = nearest(enemies, { x: TX, y: TY });
        if (target) {
          const base = Math.atan2(target.y - TY, target.x - TX);
          const s = wep.scatter;
          for (let i = 0; i < s.n; i++) {
            const a = base + (i - (s.n - 1) / 2) * (s.gap || 0.09);
            bullets.push({
              x: TX,
              y: TY,
              vx: Math.cos(a) * 620,
              vy: Math.sin(a) * 620,
              dmg: s.dmg,
              life: 0.38,
              who: "scatter",
              hit: new Set(),
            });
          }
        }
        wep.scatter.timer = wep.scatter.cd;
      }
    }
    if (wep.grenade) {
      wep.grenade.timer -= DT;
      if (wep.grenade.timer <= 0) {
        let best = null;
        let score = -1;
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          let s = 0;
          for (const o of enemies) if (o.hp > 0 && dist(e, o) < 110) s++;
          if (s > score) {
            score = s;
            best = e;
          }
        }
        if (best) {
          bullets.push({
            x: TX,
            y: TY,
            vx: (best.x - TX) * 1.6,
            vy: (best.y - TY) * 1.6,
            dmg: wep.grenade.dmg,
            life: 0.85,
            who: "grenade",
            radius: wep.grenade.radius,
            hit: new Set(),
          });
        }
        wep.grenade.timer = wep.grenade.cd;
      }
    }
    if (wep.emp) {
      wep.emp.timer -= DT;
      if (wep.emp.timer <= 0) {
        for (const e of enemies) {
          if (e.hp <= 0 || dist(e, { x: TX, y: TY }) > wep.emp.radius) continue;
          const before = dealt.total;
          hurt(e, wep.emp.dmg * (wep.emp.hits || 1), dealt);
          dealt.emp += dealt.total - before;
          e.slow = wep.emp.slowDur || 1.15;
        }
        wep.emp.timer = wep.emp.cd;
      }
    }
    if (orb) {
      orb.angle += wep.orb.spin * DT;
      for (let i = 0; i < wep.orb.count; i++) {
        const a = orb.angle + (i * Math.PI * 2) / wep.orb.count;
        const ox = TX + Math.cos(a) * wep.orb.radius;
        const oy = TY + Math.sin(a) * wep.orb.radius;
        for (const e of enemies) {
          if (e.hp <= 0 || dist(e, { x: ox, y: oy }) > e.r + 12 * (wep.orb.reach || 1)) continue;
          const before = dealt.total;
          hurt(e, wep.orb.dmg * DT * 8, dealt);
          dealt.orb += dealt.total - before;
        }
      }
    }
    for (const b of bullets) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      b.life -= DT;
      if (b.who === "grenade" && (b.life < 0.05 || enemies.some((e) => e.hp > 0 && dist(b, e) < 16 + e.r))) {
        for (const e of enemies) {
          if (e.hp <= 0 || dist(e, b) > b.radius) continue;
          const before = dealt.total;
          hurt(e, b.dmg, dealt);
          dealt.grenade += dealt.total - before;
        }
        b.life = 0;
        continue;
      }
      for (const e of enemies) {
        if (e.hp <= 0 || b.hit.has(e) || dist(b, e) > 4 + e.r) continue;
        const before = dealt.total;
        hurt(e, b.dmg, dealt);
        dealt[b.who] += dealt.total - before;
        b.hit.add(e);
        b.life = 0;
        break;
      }
    }
    for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (e.slow > 0) e.slow -= DT;
      const slow = e.slow > 0 ? 0.45 : 1;
      const a = Math.atan2(TY - e.y, TX - e.x);
      e.x += Math.cos(a) * e.speed * slow * DT;
      e.y += Math.sin(a) * e.speed * slow * DT;
      if (dist(e, { x: TX, y: TY }) < e.r + 34) {
        core -= e.dmg;
        leaks += 1;
        e.hp = 0;
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) {
        killed += 1;
        enemies.splice(i, 1);
      }
    }
    if (core <= 0) break;
  }
  return { dealt, killed, leaks, core: Math.max(0, Math.round(core)), alive: enemies.length };
}

const baseGun = { dmg: 17, rate: 8, speed: 680, life: 1.15 };
const baseDrone = { dmg: 24, cdRate: 0.24 };

function kit(extra = {}) {
  return { gun: baseGun, drone: baseDrone, wep: extra };
}

const kits = {
  "gun+drone": kit(),
  laser: kit({ laser: { dmg: 36, cd: 0.6, width: 9 } }),
  scatter: kit({ scatter: { dmg: 16, cd: 0.8, n: 7, gap: 0.1 } }),
  grenade: kit({ grenade: { dmg: 58, cd: 1.45, radius: 100 } }),
  emp: kit({ emp: { dmg: 14, cd: 2.7, radius: 145, slowDur: 1.7, hits: 1 } }),
  orb: kit({ orb: { dmg: 18, count: 3, radius: 104, spin: 2, reach: 1 } }),
};

if (process.argv[1].endsWith("balance-sim.mjs")) {
  for (const wave of [1, 3, 5]) {
    console.log(`\nwave ${wave}`);
    for (const [name, loadout] of Object.entries(kits)) {
      const runs = [1, 2, 3].map((seed) => simulate(loadout, wave, seed));
      const avg = (key) => Math.round(runs.reduce((s, r) => s + r.dealt[key], 0) / runs.length);
      const core = Math.round(runs.reduce((s, r) => s + r.core, 0) / runs.length);
      const leaks = Math.round(runs.reduce((s, r) => s + r.leaks, 0) / runs.length);
      const extra = ["laser", "scatter", "grenade", "emp", "orb"].map((id) => `${id}:${avg(id)}`).join(" ");
      console.log(`${name.padEnd(10)} core ${core} leaks ${leaks} gun ${avg("gun")} drone ${avg("drone")} ${extra}`);
    }
  }
}
