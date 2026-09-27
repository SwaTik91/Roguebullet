import test from "node:test";
import assert from "node:assert/strict";
import { hangarCost, hangarMax, hangarUnlocked, applyHangarTree } from "../src/hangar.js";

test("legacy nodes are always unlocked and uncapped", () => {
  assert.equal(hangarUnlocked({}, "atk"), true);
  assert.equal(hangarMax("atk"), Infinity);
});

test("tree nodes unlock only when the base node is deep enough", () => {
  assert.equal(hangarUnlocked({ atk: 1 }, "crit"), false);
  assert.equal(hangarUnlocked({ atk: 2 }, "crit"), true);
  assert.equal(hangarUnlocked({ hp: 2 }, "regen"), true);
  assert.equal(hangarUnlocked({ charge: 1 }, "drive"), false);
});

test("tree node cost rises with level", () => {
  assert.ok(hangarCost("crit", 0) < hangarCost("crit", 1));
});

test("applyHangarTree adds crit, regen and overdrive duration", () => {
  const run = { crit: { chance: 0.08 }, tower: { regen: 0 }, overdrive: { dur: 3.4 } };
  applyHangarTree(run, { crit: 3, regen: 2, drive: 2 });
  assert.ok(Math.abs(run.crit.chance - (0.08 + 0.03)) < 1e-9);
  assert.equal(run.tower.regen, 1.0);
  assert.ok(Math.abs(run.overdrive.dur - (3.4 + 0.6)) < 1e-9);
});
