import test from "node:test";
import assert from "node:assert/strict";
import { activeSets, setBonuses, sumBonuses } from "../src/parts.js";

function part(id, base, family, rarity = "common", affixes = []) {
  return { id, base, baseName: base, family, rarity, affixes };
}

function gunParts() {
  return [
    part("g1", "barrel", "gun"),
    part("g2", "belt", "gun"),
    part("g3", "sight", "gun"),
    part("g4", "muzzle", "gun"),
    part("c1", "core", null),
    part("c2", "actuator", null),
  ];
}

test("no set below two matching parts", () => {
  const parts = gunParts();
  const slots = ["g1", null, null, null, null, null, null, null];
  assert.deepEqual(activeSets(parts, slots), []);
  assert.deepEqual(setBonuses(parts, slots), {});
});

test("weapon family set scales with equipped count", () => {
  const parts = gunParts();
  const two = ["g1", "g2", null, null, null, null, null, null];
  const three = ["g1", "g2", "g3", null, null, null, null, null];
  const four = ["g1", "g2", "g3", "g4", null, null, null, null];
  assert.equal(setBonuses(parts, two).gunDmg, 0.08);
  assert.equal(setBonuses(parts, three).gunDmg, 0.16);
  assert.equal(setBonuses(parts, four).gunDmg, 0.28);
});

test("common set grants defensive bonuses", () => {
  const parts = gunParts();
  const slots = [null, null, null, null, "c1", "c2", null, null];
  const bonus = setBonuses(parts, slots);
  assert.equal(bonus.hp, 40);
  assert.equal(bonus.regen, undefined);
});

test("activeSets reports family, count and tier", () => {
  const parts = gunParts();
  const slots = ["g1", "g2", "g3", null, null, null, null, null];
  const sets = activeSets(parts, slots);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].family, "gun");
  assert.equal(sets[0].count, 3);
  assert.equal(sets[0].tier, 3);
});

test("set bonus bypasses affix caps in sumBonuses", () => {
  const capAffix = { id: "dmg", name: "урон", step: 4 };
  const parts = [
    part("g1", "barrel", "gun", "legendary", [capAffix]),
    part("g2", "belt", "gun", "legendary", [capAffix]),
    part("g3", "sight", "gun", "legendary", [capAffix]),
    part("g4", "muzzle", "gun", "legendary", [capAffix]),
  ];
  const slots = ["g1", "g2", "g3", "g4", null, null, null, null];
  const bonus = sumBonuses(parts, slots);
  assert.ok(bonus.gunDmg > 0.4, `expected above the 0.4 affix cap, got ${bonus.gunDmg}`);
});
