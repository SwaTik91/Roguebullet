import test from "node:test";
import assert from "node:assert/strict";
import { SPEEDS, nextSpeed, speedLabel } from "../src/speed.js";

test("SPEEDS lists battle multipliers x1 through x4", () => {
  assert.deepEqual(SPEEDS, [1, 2, 3, 4]);
});

test("nextSpeed cycles 1 -> 2 -> 3 -> 4 -> 1", () => {
  assert.equal(nextSpeed(1), 2);
  assert.equal(nextSpeed(2), 3);
  assert.equal(nextSpeed(3), 4);
  assert.equal(nextSpeed(4), 1);
});

test("speedLabel returns multiplication marks", () => {
  assert.equal(speedLabel(1), "×1");
  assert.equal(speedLabel(2), "×2");
  assert.equal(speedLabel(3), "×3");
  assert.equal(speedLabel(4), "×4");
});
