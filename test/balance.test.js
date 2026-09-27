import test from "node:test";
import assert from "node:assert/strict";
import { createBattle } from "../src/battle.js";
import { defaultWep } from "../src/content.js";

function dummyField(count) {
  const cx = 360;
  const cy = 550;
  if (count === 1) return [{ x: cx, y: cy }];
  const field = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    field.push({ x: cx + Math.cos(ang) * 36, y: cy + Math.sin(ang) * 36 });
  }
  field.push({ x: cx, y: cy });
  return field;
}

function makeEnemies(field) {
  return field.map((f) => ({
    x: f.x,
    y: f.y,
    r: 16,
    hp: 1e9,
    maxHp: 1e9,
    dmg: 0,
    speed: 0,
    type: "square",
    color: "#fb7185",
    shield: 0,
    dead: false,
  }));
}

// Runs a single weapon in isolation against a fixed enemy field and returns
// its damage-per-second, read by weapon tag so other always-on weapons do not
// contaminate the number. Enemies are kept alive so DPS stays sustained.
function measure(weapon, count, seconds = 8) {
  const { game } = createBattle({ profile: {}, level: 1, runId: "b" });
  const r = game.run;
  game.meta.showDamage = false;
  r.crit.chance = 0;
  r.weapons = {};
  r.wepStats = {};
  r.drones = [];
  if (weapon === "gun") {
    r.weapons.gun = true;
  } else if (weapon === "drone") {
    r.weapons.drone = true;
  } else {
    r.weapons[weapon] = true;
    r.wepStats[weapon] = defaultWep(weapon);
    r.wepStats[weapon].timer = 0;
  }
  r.spawnQueue = [];
  r.bossIntro = 0;
  r.dmgByWeapon = {};
  const field = dummyField(count);
  r.enemies = makeEnemies(field);
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    r.fx.length = 0;
    game.update(dt);
    if (r.enemies.length < field.length) r.enemies = makeEnemies(field);
    for (const e of r.enemies) {
      e.hp = e.maxHp;
      e.dead = false;
      e.slow = 0;
      e.freeze = 0;
    }
  }
  return (r.dmgByWeapon[weapon] || 0) / seconds;
}

function single(weapon) {
  return measure(weapon, 1);
}
function cluster(weapon) {
  return measure(weapon, 9);
}

test("every weapon deals sustained damage", () => {
  for (const w of ["gun", "drone", "laser", "scatter", "grenade", "emp", "orb"]) {
    assert.ok(cluster(w) > 0, `${w} deals no damage`);
  }
});

test("gun stays the single-target leader", () => {
  const gun = single("gun");
  assert.ok(gun >= 110 && gun <= 150, `gun single ${gun}`);
  assert.ok(gun > single("laser"), "gun should beat laser single-target");
  assert.ok(gun > single("scatter"), "gun should beat scatter single-target");
  assert.ok(gun > single("grenade"), "gun should beat grenade single-target");
});

test("area weapons clear clusters far better than single targets", () => {
  for (const w of ["laser", "grenade", "scatter", "orb"]) {
    assert.ok(cluster(w) > single(w) * 2.5, `${w} should scale with crowd size`);
  }
});

test("no damage weapon is left underpowered on clusters", () => {
  // Scatter and orb used to trail every other option; keep them viable.
  assert.ok(cluster("scatter") >= 180, `scatter cluster ${cluster("scatter")}`);
  assert.ok(cluster("orb") >= 160, `orb cluster ${cluster("orb")}`);
});

test("laser remains the top area weapon without running away", () => {
  const laser = cluster("laser");
  assert.ok(laser >= 320 && laser <= 460, `laser cluster ${laser}`);
});
