import test from "node:test";
import assert from "node:assert/strict";
import { rerollLabel, rerollPrice } from "../src/reroll.js";

test("reroll ladder matches the free, coin, and crystal steps", () => {
  assert.equal(rerollPrice(0).kind, "free");
  assert.equal(rerollPrice(1).kind, "free");
  assert.deepEqual([2, 3, 4, 5, 6].map((n) => rerollPrice(n).amount), [1000, 2000, 3000, 4000, 5000]);
  assert.deepEqual([7, 8, 9, 10, 11, 12, 13].map((n) => rerollPrice(n).amount), [1, 2, 3, 4, 5, 10, 20]);
  assert.equal(rerollPrice(14), null);
  assert.equal(rerollLabel(rerollPrice(2)), "ЕЩЁ РАЗ · 1000 МОНЕТ");
  assert.equal(rerollLabel(null), "РЕРОЛЛ ЗАКОНЧИЛСЯ");
});
