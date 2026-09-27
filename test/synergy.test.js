import test from "node:test";
import assert from "node:assert/strict";
import { activeSynergies, synergyFlags } from "../src/synergy.js";
import { createBattle } from "../src/battle.js";

function runWith(branches) {
  return {
    gun: { branch: branches.gun || null },
    drone: { branch: branches.drone || null },
    wepStats: {
      laser: { branch: branches.laser || null },
      grenade: { branch: branches.grenade || null },
      emp: { branch: branches.emp || null },
      orb: { branch: branches.orb || null },
      scatter: { branch: branches.scatter || null },
    },
  };
}

test("forge needs laser and grenade branches", () => {
  assert.deepEqual(activeSynergies(runWith({ laser: "cut" })).map((s) => s.id), []);
  const ids = activeSynergies(runWith({ laser: "cut", grenade: "wedge" })).map((s) => s.id);
  assert.deepEqual(ids, ["forge"]);
});

test("overload needs emp and gun branches", () => {
  const ids = activeSynergies(runWith({ emp: "storm", gun: "ricochet" })).map((s) => s.id);
  assert.deepEqual(ids, ["overload"]);
});

test("aegis requires the ward branch specifically", () => {
  assert.deepEqual(activeSynergies(runWith({ orb: "blade", drone: "flock" })).map((s) => s.id), []);
  const ids = activeSynergies(runWith({ orb: "ward", drone: "flock" })).map((s) => s.id);
  assert.deepEqual(ids, ["aegis"]);
});

test("synergyFlags maps active synergies to their effect flags", () => {
  const flags = synergyFlags(runWith({ laser: "cut", grenade: "wedge", emp: "storm", gun: "queue" }));
  assert.equal(flags.burnBlast, true);
  assert.equal(flags.empBurst, true);
  assert.equal(flags.wardRush, undefined);
});

test("refreshSynergies stores flags on the run", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  game.run.wepStats.laser = { branch: "cut" };
  game.run.wepStats.grenade = { branch: "wedge" };
  game.refreshSynergies();
  assert.equal(game.run.syn.burnBlast, true);
});

test("burnBlast makes explosions ignite enemies", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const tw = game.run.tower;
  const e = { type: "circle", x: tw.x, y: tw.y - 40, r: 16, hp: 500, maxHp: 500, shield: 0, maxShield: 0, dmg: 5, speed: 0, color: "#7ee8ff", xp: 5, coins: 2, dead: false, id: 1 };
  game.run.enemies = [e];
  game.run.syn = {};
  game.explode(tw.x, tw.y - 40, 60, 100, "grenade");
  assert.ok(!e.burnDps, "no burn without the synergy");
  game.run.syn = { burnBlast: true };
  game.explode(tw.x, tw.y - 40, 60, 100, "grenade");
  assert.ok(e.burnDps > 0, "explosion ignited the enemy");
});

test("empBurst boosts gun bullets against slowed enemies", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  game.run.crit.chance = 0;
  game.run.syn = { empBurst: true };
  const tw = game.run.tower;
  const target = { type: "circle", x: tw.x + 5, y: tw.y - 200, r: 16, hp: 1000, maxHp: 1000, shield: 0, maxShield: 0, dmg: 5, speed: 0, color: "#7ee8ff", xp: 5, coins: 2, slow: 2, slowMul: 0.5, dead: false, id: 2 };
  game.run.enemies = [target];
  game.run.bullets = [
    { x: tw.x + 5, y: tw.y - 200, vx: 0, vy: 0, life: 1, r: 4, dmg: 100, color: "#7ee8ff", tag: "gun", kind: "gun", hit: new Set() },
  ];
  const before = target.hp;
  game.update(0.016);
  const dealt = before - target.hp;
  assert.ok(dealt >= 139 && dealt <= 141, `expected ~140 damage, got ${dealt}`);
});
