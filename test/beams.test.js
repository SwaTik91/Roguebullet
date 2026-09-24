import test from "node:test";
import assert from "node:assert/strict";
import { defaultWep } from "../src/content.js";
import { legendaryOffer } from "../src/draft.js";
import { empStep } from "../src/emp.js";
import { grenadeStep } from "../src/grenade.js";
import { laserStep, rayEnd, reflectAngle } from "../src/laser.js";
import { orbStep } from "../src/orb.js";
import { scatterStep } from "../src/scatter.js";

function host() {
  return {
    wepStats: {
      laser: defaultWep("laser"),
      emp: defaultWep("emp"),
      scatter: defaultWep("scatter"),
      grenade: defaultWep("grenade"),
      orb: defaultWep("orb"),
    },
    pips: {},
  };
}

test("laser and emp open three branches on the fifth upgrade", () => {
  const run = host();
  run.pips = { laser: Array(4).fill("normal"), emp: Array(4).fill("normal") };
  assert.deepEqual(legendaryOffer(run, "laser").map((c) => c.title), ["Резак", "Призма", "Зеркало"]);
  assert.deepEqual(legendaryOffer(run, "emp").map((c) => c.title), ["Ступор", "Разряд", "Купол"]);
});

test("later laser and emp legendaries stay inside the chosen branch", () => {
  const run = host();
  laserStep(5).cards[0].apply(run);
  run.pips.laser = Array(9).fill("normal");
  assert.deepEqual(legendaryOffer(run, "laser").map((c) => c.id), ["cut-exec", "cut-spread", "cut-heat"]);
  empStep(5).cards[2].apply(run);
  run.pips.emp = Array(14).fill("normal");
  assert.deepEqual(legendaryOffer(run, "emp").map((c) => c.id), ["dm-sky", "dm-fort", "dm-wave"]);
  assert.ok(Math.abs(run.wepStats.emp.radius - 145 * 1.55) < 1e-9);
  assert.equal(run.wepStats.laser.dmg, 36 * 2);
  assert.equal(run.wepStats.laser.burn, 1);
});

test("scatter, grenade and orbs open their own branches", () => {
  const run = host();
  run.pips = { scatter: Array(4).fill("normal"), grenade: Array(4).fill("normal"), orb: Array(4).fill("normal") };
  assert.deepEqual(legendaryOffer(run, "scatter").map((c) => c.title), ["Вал", "Сноп", "Гроздь"]);
  assert.deepEqual(legendaryOffer(run, "grenade").map((c) => c.title), ["Клин", "Кассета", "Кратер"]);
  assert.deepEqual(legendaryOffer(run, "orb").map((c) => c.title), ["Серп", "Барьер", "Выпад"]);
  scatterStep(5).cards[1].apply(run);
  run.pips.scatter = Array(9).fill("normal");
  assert.equal(legendaryOffer(run, "scatter")[0].id, "sh-ham");
  grenadeStep(5).cards[0].apply(run);
  assert.equal(run.wepStats.grenade.shape, "wedge");
  orbStep(5).cards[2].apply(run);
  assert.equal(run.wepStats.orb.lungeMul, 8);
});

test("a beam aimed right stops on the right wall and reflects", () => {
  const end = rayEnd(10, 50, 0, 200, 100);
  assert.ok(Math.abs(end.x - 200) < 1e-6);
  assert.ok(Math.abs(end.y - 50) < 1e-6);
  assert.equal(end.axis, "x");
  assert.ok(Math.abs(reflectAngle(0.4, "x") - (Math.PI - 0.4)) < 1e-9);
  assert.ok(Math.abs(reflectAngle(0.4, "y") - -0.4) < 1e-9);
});
