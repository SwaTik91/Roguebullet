import test from "node:test";
import assert from "node:assert/strict";
import { createBattle } from "../src/battle.js";
import { damageShares, weaponLabel } from "../src/content.js";

test("damageShares turns raw damage into fractions that sum to one", () => {
  const shares = damageShares({ gun: 30, laser: 10 });
  assert.equal(Math.round((shares.gun + shares.laser) * 100), 100);
  assert.ok(shares.gun > shares.laser);
});

test("damageShares is empty when nothing was dealt", () => {
  assert.deepEqual(damageShares({}), {});
});

test("weaponLabel names the resonance line", () => {
  assert.equal(weaponLabel("resonance"), "Резонанс");
  assert.equal(weaponLabel("gun"), "Пулемёт");
});

test("damage records the dealt amount under the weapon tag", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const enemy = { x: 100, y: 100, r: 10, hp: 40, maxHp: 40, shield: 0, color: "#fff", type: "circle", coins: 0, xp: 0 };
  game.run.enemies = [enemy];
  game.damage(enemy, 25, "#7ee8ff", false, false, "gun");
  game.damage(enemy, 10, "#60a5fa", false, false, "laser");
  assert.equal(game.run.dmgByWeapon.gun, 25);
  assert.equal(game.run.dmgByWeapon.laser, 10);
  const shares = damageShares(game.run.dmgByWeapon);
  assert.ok(shares.gun > shares.laser);
});

test("damage without a tag leaves the counter empty", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const enemy = { x: 100, y: 100, r: 10, hp: 40, maxHp: 40, shield: 0, color: "#fff", type: "circle", coins: 0, xp: 0 };
  game.run.enemies = [enemy];
  game.damage(enemy, 25, "#7ee8ff", false);
  assert.deepEqual(game.run.dmgByWeapon, {});
});
