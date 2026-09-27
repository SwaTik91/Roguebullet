import test from "node:test";
import assert from "node:assert/strict";
import { nextRarity, salvageValue, upgradeCost, canUpgrade } from "../src/salvage.js";

test("nextRarity walks the rarity ladder and stops at legendary", () => {
  assert.equal(nextRarity("common"), "rare");
  assert.equal(nextRarity("rare"), "epic");
  assert.equal(nextRarity("epic"), "legendary");
  assert.equal(nextRarity("legendary"), null);
});

test("salvage value grows with rarity", () => {
  assert.ok(salvageValue("common") < salvageValue("rare"));
  assert.ok(salvageValue("rare") < salvageValue("epic"));
  assert.ok(salvageValue("epic") < salvageValue("legendary"));
});

test("upgrade cost is defined only for upgradable rarities", () => {
  assert.equal(typeof upgradeCost("common"), "number");
  assert.equal(typeof upgradeCost("epic"), "number");
  assert.equal(upgradeCost("legendary"), null);
});

test("canUpgrade is false only at legendary", () => {
  assert.equal(canUpgrade("common"), true);
  assert.equal(canUpgrade("epic"), true);
  assert.equal(canUpgrade("legendary"), false);
});
