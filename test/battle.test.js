import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle } from "../src/battle.js";

test("the server battle fires the gun and keeps the run", () => {
  const session = createBattle({ profile: {}, level: 1, worldW: 720, worldH: 1280, runId: "run-1" });
  const first = stepBattle(session, { pointer: { x: 360, y: 100, down: true }, speed: 1 }, session.last + 400);
  assert.equal(first.runId, "run-1");
  assert.ok(first.run.bullets.length > 0);
  assert.equal(first.run.tower.x, 360);
  assert.equal(first.state, "play");
});
