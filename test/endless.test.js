import test from "node:test";
import assert from "node:assert/strict";
import { applyQueuedCard, endlessEnemyWave, enemyForWave, startingLoadout } from "../src/content.js";

test("crystal weapons start the run and the fourth card is offered", () => {
  const gear = startingLoadout({ weapons: ["emp", "laser"], fourthCard: true });
  assert.equal(gear.weapons.emp, true);
  assert.equal(gear.weapons.laser, true);
  assert.equal(gear.wepStats.emp.dmg, 14);
  assert.equal(gear.cards, 4);
  const bare = startingLoadout({});
  assert.equal(bare.weapons.emp, undefined);
  assert.equal(bare.cards, 3);
});

test("a queued chest card changes the run", () => {
  const run = { gun: { dmg: 14, rate: 8, autoTurn: 2.6 }, tower: { hp: 220, maxHp: 220, regen: 0 } };
  assert.equal(applyQueuedCard(run, "Калибр"), true);
  assert.equal(run.gun.dmg, 14 * 1.35);
  assert.equal(applyQueuedCard(run, "Пластины"), true);
  assert.equal(run.tower.maxHp, 300);
});

test("endless waves stay on normal enemies", () => {
  for (const wave of [7, 8, 11, 16, 21]) {
    const kind = endlessEnemyWave(wave);
    assert.ok(kind >= 1 && kind <= 5);
    assert.equal(enemyForWave(kind, 1, 2).boss, undefined);
  }
});
