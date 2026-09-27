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

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function playFromScratch(startLevel, seed) {
  const { game, ui } = createBattle({ profile: {}, level: startLevel, runId: `surv-${startLevel}-${seed}` });
  game.rand = lcg(seed + startLevel * 7919);
  const dt = 1 / 60;
  let cleared = 0;
  let guard = 0;
  while (guard++ < 60 * 60 * 30) {
    if (game.state === "play") {
      game.update(dt);
    } else if (game.state === "cards") {
      const cards = ui.cards || [];
      if (!cards.length) break;
      const score = (c) => ({ common: 1, rare: 2, epic: 3, legendary: 4 }[c.rarity] || 1) + (c.unlock ? 1 : 0) + (c.who && c.who !== "Общая карта" ? 1 : 0);
      game.applyCard(cards.slice().sort((a, b) => score(b) - score(a))[0]);
    } else if (game.state === "levelclear") {
      cleared += 1;
      break;
    } else {
      break;
    }
  }
  return cleared >= 1;
}

test("level 1-1 is beatable from a zero-meta account", () => {
  // Свежий аккаунт (только gun+drone, без ангара/деталей/крита) обязан
  // проходить первый уровень на всех сидах — точка входа в игру.
  for (const seed of [1, 2, 3, 4, 5]) {
    assert.ok(playFromScratch(1, seed), `1-1 не пройден с нуля на сиде ${seed}`);
  }
});

test("difficulty rises: a zero-meta account walls before mid-campaign", () => {
  // С нуля игрок не должен пробегать всю кампанию без прокачки — иначе
  // фарм и кристаллы теряют смысл. Уровень 2-1 (абс. 6) уже требует меты.
  const clears = [1, 2, 3].filter((seed) => playFromScratch(6, seed)).length;
  assert.ok(clears === 0, `2-1 не должен проходиться с нуля (пройдено ${clears}/3)`);
});
