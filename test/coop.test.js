import test from "node:test";
import assert from "node:assert/strict";
import { coopSeatLayout } from "../src/coop.js";
import { Game } from "../src/game.js";

test("coop guns sit on one line and the same distance from each side", () => {
  const [left, right] = coopSeatLayout(720, 1280);
  assert.equal(left.y, right.y);
  assert.equal(left.y, 640);
  assert.ok(Math.abs(left.x - (720 - right.x)) < 1e-9);
  assert.ok(left.x > 80 && right.x < 640);
  assert.ok(right.x - left.x > 200);
});

test("two phones with one seed stay on the same enemies", () => {
  const ui = {
    showPlay() {},
    updateHud() {},
    setCombo() {},
    toast() {},
    hideCards() {},
    showCards() {},
    save() {},
  };
  const audio = new Proxy({}, { get: () => () => {} });
  const data = { seed: 42, worldW: 800, worldH: 1280, level: 1, t0: 1, now: 1, profile: {} };
  const a = new Game(null, ui, audio, { bestWave: 0 }, { headless: true });
  const b = new Game(null, ui, audio, { bestWave: 0 }, { headless: true });
  a.beginCoop({ ...data, seat: 0 });
  b.beginCoop({ ...data, seat: 1 });
  for (let tick = 0; tick < 40; tick++) {
    a.applyCoopTick(tick);
    b.applyCoopTick(tick);
    a.update(1 / 60);
    b.update(1 / 60);
  }
  assert.equal(a.run.seats[0].y, a.run.seats[1].y);
  assert.ok(Math.abs(a.run.seats[0].x - (800 - a.run.seats[1].x)) < 1e-6);
  assert.equal(a.run.enemies.length, b.run.enemies.length);
  assert.ok(a.run.enemies.length > 0);
  assert.equal(a.run.enemies[0].x, b.run.enemies[0].x);
  assert.equal(a.run.enemies[0].y, b.run.enemies[0].y);
  assert.equal(a.run.tower.hp, b.run.tower.hp);
});
