import test from "node:test";
import assert from "node:assert/strict";
import { addRate, bulletShouldStop, gunPool, gunStep, gunXpToNext, reflectBullet, rollGunOffer, rollGunShot } from "../src/gun.js";

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

test("ordinary levels offer three cards from a large rarity pool", () => {
  const shared = gunPool(null);
  const queue = gunPool("queue");
  assert.ok(shared.length >= 16);
  assert.ok(queue.length > shared.length);
  for (const rarity of ["common", "rare", "epic"]) {
    assert.ok(shared.some((c) => c.rarity === rarity));
    assert.ok(queue.some((c) => c.rarity === rarity));
  }
  assert.equal(queue.some((c) => c.id === "pel1"), false);
  const step = gunStep(2);
  assert.equal(step.cards.length, 3);
  assert.equal(new Set(step.cards.map((c) => c.id)).size, 3);
  for (const level of [10, 15]) assert.equal(gunStep(level, "queue").cards.length, 3);
});

test("common cards appear more often than epics", () => {
  let seed = 7;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const counts = { common: 0, rare: 0, epic: 0 };
  for (let i = 0; i < 200; i++) {
    for (const card of rollGunOffer("queue", {}, 3, rng)) counts[card.rarity] += 1;
  }
  assert.ok(counts.common > counts.rare);
  assert.ok(counts.rare > counts.epic);
});

test("level 5 offers the three branches", () => {
  const step = gunStep(5);
  assert.equal(step.kind, "choice");
  assert.deepEqual(step.cards.map((c) => c.title), ["Очередь", "Залп", "Рикошет"]);
});

test("rate and crit caps still hold", () => {
  const r = run();
  const tempo = gunPool(null).find((c) => c.id === "tempo");
  const spark = gunPool("queue").find((c) => c.id === "spark");
  r.gun.rate = 23;
  tempo.apply(r);
  assert.equal(r.gun.rate, 24);
  r.crit.chance = 0.74;
  spark.apply(r);
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

test("volley legendaries add pellets and pierce", () => {
  const r = run();
  gunStep(5).cards[1].apply(r);
  gunStep(10, "volley").cards[0].apply(r);
  gunStep(15, "volley").cards[0].apply(r);
  assert.equal(r.gun.pellets, 12);
  assert.ok(r.gun.gap < 12);
  const through = run();
  gunStep(15, "volley").cards[1].apply(through);
  assert.equal(through.gun.falloff, 0.9);
});

test("ricochet legendaries add bounces and a one-time edge bonus", () => {
  const r = run();
  gunStep(5).cards[2].apply(r);
  gunStep(10, "ricochet").cards[0].apply(r);
  gunStep(15, "ricochet").cards[1].apply(r);
  assert.equal(r.gun.bounces, 9);
  const swarm = gunPool("ricochet").find((c) => c.id === "spark-s");
  swarm.apply(r);
  assert.equal(rollGunOffer("ricochet", r.gun, 99).some((c) => c.id === "spark-s"), false);
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
