import test from "node:test";
import assert from "node:assert/strict";
import { createBattle } from "../src/battle.js";

test("recordCollection stores discovered enemies, branches and synergies", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const run = game.run;
  run.kills = { circle: 5, dash: 1, heal: 0, split: 3 };
  run.gun.branch = "ricochet";
  run.wepStats.laser = { branch: "cut" };
  run.wepStats.grenade = { branch: "wedge" };
  game.recordCollection(run);
  const seen = game.meta.seen;
  assert.ok(seen.enemies.includes("circle"));
  assert.ok(seen.enemies.includes("dash"));
  assert.ok(!seen.enemies.includes("heal"), "zero kills should not count");
  assert.ok(!seen.enemies.includes("split"), "split is not a shape type");
  assert.ok(seen.branches.includes("ricochet"));
  assert.ok(seen.branches.includes("cut"));
  assert.ok(seen.synergies.includes("forge"), "laser + grenade branches unlock the forge synergy");
});

test("recordCollection is additive across runs and de-duplicates", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  game.meta.seen = { enemies: ["circle"], branches: [], synergies: [] };
  const run = game.run;
  run.kills = { circle: 2, square: 1 };
  game.recordCollection(run);
  assert.deepEqual(game.meta.seen.enemies.filter((t) => t === "circle").length, 1);
  assert.ok(game.meta.seen.enemies.includes("square"));
});
