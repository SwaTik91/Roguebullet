import test from "node:test";
import assert from "node:assert/strict";
import { addRate, bulletShouldStop, gunStep, gunXpToNext, reflectBullet, rollGunShot } from "../src/gun.js";

function run() {
  return {
    crit: { chance: 0.08, mul: 2 },
    gun: {
      dmg: 9,
      rate: 8,
      pellets: 1,
      pierce: 0,
      bounces: 0,
      life: 1.15,
      speed: 680,
      gap: 12,
      edgeMul: 1,
      swarm: false,
      falloff: 0,
      series: false,
      every: 0,
      shot: 0,
      forceNext: false,
    },
  };
}

test("shared levels raise damage and rate before the branch", () => {
  const r = run();
  gunStep(2).apply(r);
  gunStep(3).apply(r);
  gunStep(4).apply(r);
  assert.equal(r.gun.dmg, 9 * 1.25 * 1.25);
  assert.equal(r.gun.rate, 9);
});

test("level 5 offers the three branches", () => {
  const step = gunStep(5);
  assert.equal(step.kind, "choice");
  assert.deepEqual(step.cards.map((c) => c.title), ["Очередь", "Залп", "Рикошет"]);
});

test("queue branch raises rate and crit and caps both", () => {
  const r = run();
  gunStep(5).cards[0].apply(r);
  for (const level of [6, 7, 8, 9, 11, 12, 13, 14]) gunStep(level, "queue").apply(r);
  gunStep(10, "queue").cards[1].apply(r);
  assert.equal(r.gun.rate, 16);
  assert.ok(Math.abs(r.crit.chance - (0.08 + 0.1 + 0.06 * 3)) < 1e-9);
  r.gun.rate = 17;
  addRate(r.gun, 5);
  assert.equal(r.gun.rate, 18);
  r.crit.chance = 0.74;
  gunStep(7, "queue").apply(r);
  assert.equal(r.crit.chance, 0.75);
});

test("kazn sets crit damage to x3 and series chains one shot", () => {
  const r = run();
  r.gun.branch = "queue";
  gunStep(10, "queue").cards[0].apply(r);
  gunStep(15, "queue").cards[0].apply(r);
  assert.equal(r.crit.mul, 3);
  assert.equal(r.gun.series, true);
  const first = rollGunShot(r.gun);
  assert.equal(first.guaranteedCrit, false);
  assert.equal(first.canChain, true);
  r.gun.forceNext = true;
  const chained = rollGunShot(r.gun);
  assert.equal(chained.guaranteedCrit, true);
  assert.equal(chained.canChain, false);
  assert.equal(r.gun.forceNext, false);
});

test("counter crits every fourth shot", () => {
  const r = run();
  gunStep(15, "queue").cards[1].apply(r);
  const flags = [1, 2, 3, 4].map(() => rollGunShot(r.gun).guaranteedCrit);
  assert.deepEqual(flags, [false, false, false, true]);
});

test("volley grows pellets and pierce, wall tightens the gap", () => {
  const r = run();
  gunStep(5).cards[1].apply(r);
  for (const level of [6, 7, 8, 9, 11, 12, 13, 14]) gunStep(level, "volley").apply(r);
  assert.equal(r.gun.pellets, 6);
  assert.equal(r.gun.pierce, 3);
  gunStep(10, "volley").cards[0].apply(r);
  gunStep(15, "volley").cards[0].apply(r);
  assert.equal(r.gun.pellets, 11);
  assert.ok(r.gun.gap < 12);
  const through = run();
  gunStep(15, "volley").cards[1].apply(through);
  assert.equal(through.gun.falloff, 0.75);
});

test("ricochet bounce count and one-time edge bonus", () => {
  const r = run();
  gunStep(5).cards[2].apply(r);
  for (const level of [6, 7, 8, 9, 11, 12, 13, 14]) gunStep(level, "ricochet").apply(r);
  gunStep(10, "ricochet").cards[0].apply(r);
  gunStep(15, "ricochet").cards[1].apply(r);
  assert.equal(r.gun.bounces, 8);
  assert.ok(Math.abs(r.gun.life - 1.85) < 1e-9);
  assert.equal(r.gun.speed, 840);
  const edge = run();
  edge.gun.bounces = 2;
  edge.gun.edgeMul = 1.5;
  const b = { x: 1, y: 100, vx: -100, vy: 0, dmg: 10, bounces: 2, canBounce: true, life: 1, edgeMul: 1.5 };
  reflectBullet(b, 720, 1280);
  assert.equal(b.dmg, 15);
  assert.equal(b.bounces, 1);
  b.x = 1;
  b.vx = -50;
  reflectBullet(b, 720, 1280);
  assert.equal(b.dmg, 15);
});

test("falloff keeps the bullet and cuts damage", () => {
  const b = { dmg: 20, falloff: 0.75, pierce: 0 };
  assert.equal(bulletShouldStop(b), false);
  assert.equal(b.dmg, 15);
  const stop = { dmg: 8, pierce: 0 };
  assert.equal(bulletShouldStop(stop), true);
});

test("level 5 arrives after 500 kills", () => {
  let xp = 0;
  for (let level = 1; level < 5; level++) xp += gunXpToNext(level);
  assert.equal(xp, 500);
});
