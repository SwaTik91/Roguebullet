import test from "node:test";
import assert from "node:assert/strict";
import { endlessEnemyWave, enemyForWave } from "../src/content.js";

test("endless waves stay on normal enemies", () => {
  for (const wave of [7, 8, 11, 16, 21]) {
    const kind = endlessEnemyWave(wave);
    assert.ok(kind >= 1 && kind <= 5);
    assert.equal(enemyForWave(kind, 1, 2).boss, undefined);
  }
});
