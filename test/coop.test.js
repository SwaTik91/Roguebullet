import test from "node:test";
import assert from "node:assert/strict";
import { coopSeatLayout } from "../src/coop.js";

test("coop guns sit on one line and the same distance from each side", () => {
  const [left, right] = coopSeatLayout(720, 1280);
  assert.equal(left.y, right.y);
  assert.equal(left.y, 640);
  assert.ok(Math.abs(left.x - (720 - right.x)) < 1e-9);
  assert.ok(left.x > 80 && right.x < 640);
  assert.ok(right.x - left.x > 200);
});
