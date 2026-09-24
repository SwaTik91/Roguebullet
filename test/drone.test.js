import test from "node:test";
import assert from "node:assert/strict";
import { addDrones, dronePool, droneStep, hasten, rollDroneOffer } from "../src/drone.js";

function run() {
  return {
    drone: { dmg: 16, count: 1, cd: 0.26, bombs: false, radius: 64, bombMul: 1.6, speed: 560, pierce: 0, pellets: 1, bombOnHit: false },
  };
}

test("drone levels offer three cards and three branches", () => {
  const step = droneStep(2);
  assert.equal(step.cards.length, 3);
  assert.deepEqual(droneStep(5).cards.map((c) => c.title), ["Стая", "Бомбы", "Охота"]);
  assert.equal(droneStep(10, "flock").cards.length, 3);
  assert.equal(droneStep(15, "bomb").cards.length, 3);
  assert.ok(dronePool("hunt").length > dronePool(null).length);
});

test("common drone cards appear more often than epics", () => {
  let seed = 3;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const counts = { common: 0, rare: 0, epic: 0 };
  for (let i = 0; i < 160; i++) {
    for (const card of rollDroneOffer("flock", {}, 3, rng)) counts[card.rarity] += 1;
  }
  assert.ok(counts.common > counts.rare);
  assert.ok(counts.rare > counts.epic);
});

test("flock and hunt legendaries change the drone", () => {
  const r = run();
  droneStep(5).cards[0].apply(r);
  droneStep(10, "flock").cards[0].apply(r);
  assert.equal(r.drone.count, 4);
  const hunt = run();
  droneStep(5).cards[2].apply(hunt);
  droneStep(15, "hunt").cards[0].apply(hunt);
  assert.equal(hunt.drone.dmg, 16 * 1.6 * 2);
  assert.equal(hunt.drone.pierce, 1);
});

test("drone count and fire rate stay capped", () => {
  const r = run();
  r.drone.count = 5;
  addDrones(r.drone, 4);
  assert.equal(r.drone.count, 6);
  r.drone.cd = 0.1;
  hasten(r.drone, 0.2);
  assert.equal(r.drone.cd, 0.07);
});

test("cluster bomb is not offered twice", () => {
  const r = run();
  r.drone.branch = "bomb";
  dronePool("bomb").find((c) => c.id === "b-hit").apply(r);
  assert.equal(rollDroneOffer("bomb", r.drone, 99).some((c) => c.id === "b-hit"), false);
});
