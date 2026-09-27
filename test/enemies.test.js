import test from "node:test";
import assert from "node:assert/strict";
import { ELITE, SPECIAL_ENEMIES, enemyForWave } from "../src/content.js";
import { mulberry32 } from "../src/coop.js";
import { createBattle } from "../src/battle.js";

function sample(wave, count) {
  const rng = mulberry32(1234);
  const out = [];
  for (let i = 0; i < count; i++) out.push(enemyForWave(wave, 1, 1, rng));
  return out;
}

test("special enemies and elites appear on normal waves", () => {
  const enemies = sample(10, 6000);
  const dash = enemies.filter((e) => e.type === "dash");
  const heal = enemies.filter((e) => e.type === "heal");
  const elites = enemies.filter((e) => e.elite);
  assert.ok(dash.length > 0, "expected some dash enemies");
  assert.ok(heal.length > 0, "expected some heal enemies");
  assert.ok(elites.length > 0, "expected some elite enemies");
  for (const e of elites) assert.ok(ELITE.mods.includes(e.elite));
});

test("dash enemies carry their own dash config and healers an aura", () => {
  const enemies = sample(10, 6000);
  const dash = enemies.find((e) => e.type === "dash");
  const heal = enemies.find((e) => e.type === "heal");
  assert.equal(dash.dash.mul, SPECIAL_ENEMIES.dash.dash.mul);
  assert.equal(heal.healAura.radius, SPECIAL_ENEMIES.heal.healAura.radius);
});

test("elite modifiers boost stats and set their effect", () => {
  const enemies = sample(10, 6000);
  const armor = enemies.find((e) => e.elite === "armor");
  const swift = enemies.find((e) => e.elite === "swift");
  const burst = enemies.find((e) => e.elite === "burst");
  assert.ok(armor.shield > 0, "armor elite has a shield");
  assert.ok(swift.speed > 0);
  assert.equal(burst.burstOnDeath, true);
});

test("boss waves never carry specials or elites", () => {
  for (let i = 0; i < 200; i++) {
    const boss = enemyForWave(6, 2, 1, mulberry32(i + 1));
    assert.equal(boss.boss, true);
    assert.equal(boss.elite, undefined);
    assert.equal(boss.type, "boss");
  }
});

test("the game loop advances dash and healer enemies without errors", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const tw = game.run.tower;
  game.run.enemies = [
    { type: "dash", x: tw.x, y: tw.y - 320, r: 14, hp: 200, maxHp: 200, shield: 0, maxShield: 0, dmg: 8, speed: 80, color: "#f97316", xp: 9, coins: 3, dash: { cd: 0.4, dur: 0.3, mul: 3.2 }, dead: false, id: 1 },
    { type: "heal", x: tw.x + 40, y: tw.y - 320, r: 15, hp: 58, maxHp: 58, shield: 0, maxShield: 0, dmg: 5, speed: 46, color: "#22d3ee", xp: 13, coins: 4, healAura: { radius: 130, hps: 12, tick: 0.2 }, dead: false, id: 2 },
    { type: "circle", x: tw.x + 90, y: tw.y - 320, r: 16, hp: 20, maxHp: 100, shield: 0, maxShield: 0, dmg: 5, speed: 0, color: "#7dd3fc", xp: 6, coins: 2, dead: false, id: 3 },
  ];
  const wounded = game.run.enemies[2];
  for (let i = 0; i < 20; i++) game.update(0.05);
  assert.ok(wounded.hp > 20, "healer restored the wounded neighbor");
});

test("burst elite spawns shards on death", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const tw = game.run.tower;
  const e = { type: "square", x: tw.x, y: tw.y - 300, r: 20, hp: 10, maxHp: 200, shield: 0, maxShield: 0, dmg: 5, speed: 0, color: "#fb7185", xp: 5, coins: 2, burstOnDeath: true, dead: false, id: 9 };
  game.run.enemies = [e];
  game.damage(e, 999, "#7ee8ff", false, false, "gun");
  assert.ok(game.run.enemies.length >= 3, "burst spawned shard enemies");
});

test("boss enters phases and summons minions as HP drops", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const tw = game.run.tower;
  const boss = { type: "boss", boss: true, x: tw.x, y: 60, r: 78, hp: 1000, maxHp: 1000, shield: 0, maxShield: 0, dmg: 18, speed: 28, color: "#f472b6", xp: 80, coins: 28, dead: false, id: 100 };
  game.run.enemies = [boss];
  game.update(0.016);
  assert.equal(boss.bossPhase, 1);
  boss.hp = 600;
  game.update(0.016);
  assert.equal(boss.bossPhase, 2);
  assert.ok(boss.shield > 0, "phase 2 gives a shield");
  assert.ok(game.run.enemies.length > 1, "phase 2 summons minions");
  boss.hp = 300;
  game.update(0.016);
  assert.equal(boss.bossPhase, 3);
});
