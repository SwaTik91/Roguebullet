import test from "node:test";
import assert from "node:assert/strict";
import { defaultWep } from "../src/content.js";
import { battlePool, rollBattleOffer } from "../src/draft.js";

function run() {
  return {
    weapons: { gun: true, drone: true },
    wepStats: {},
    gun: {
      dmg: 14,
      rate: 8,
      pellets: 1,
      pierce: 0,
      bounces: 0,
      life: 1.15,
      speed: 680,
      gap: 12,
      edgeMul: 1,
      swarm: false,
      branch: null,
    },
    drone: {
      dmg: 16,
      count: 1,
      cd: 0.26,
      bombs: false,
      radius: 64,
      bombMul: 1.6,
      speed: 560,
      pierce: 0,
      pellets: 1,
      bombOnHit: false,
      extraPellet: false,
      branch: null,
    },
    crit: { chance: 0.08, mul: 2 },
    tower: { hp: 220, maxHp: 220, regen: 0 },
    overdrive: { dur: 3.4, mul: 1.85, chargeGain: 0 },
    comboNeed: 6,
  };
}

function lcg(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test("offer length is 3 and ids are unique", () => {
  const cards = rollBattleOffer(run());
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map((c) => c.id)).size, 3);
  for (const c of cards) {
    assert.equal(typeof c.id, "string");
    assert.equal(typeof c.title, "string");
    assert.equal(typeof c.desc, "string");
    assert.equal(typeof c.apply, "function");
    assert.ok(["common", "rare", "epic", "legendary"].includes(c.rarity));
  }
});

test("unowned laser can appear and leaves the pool once owned", () => {
  const fresh = run();
  const open = rollBattleOffer(fresh, 99, () => 0);
  const laser = open.find((c) => c.id === "laser");
  assert.ok(laser);
  assert.equal(laser.rarity, "rare");
  laser.apply(fresh);
  assert.equal(fresh.weapons.laser, true);
  assert.deepEqual(fresh.wepStats.laser, defaultWep("laser"));
  const closed = rollBattleOffer(fresh, 99, () => 0);
  assert.equal(closed.some((c) => c.id === "laser"), false);
  assert.ok(closed.some((c) => c.id === "laser-d"));
});

test("Пластины increases hp", () => {
  const r = run();
  const plates = battlePool(r).find((c) => c.title === "Пластины");
  assert.ok(plates);
  plates.apply(r);
  assert.equal(r.tower.hp, 300);
  assert.equal(r.tower.maxHp, 300);
  assert.equal(r.tower.regen, 1.2);
});

test("common cards outweigh rare cards, which outweigh epics", () => {
  const counts = { common: 0, rare: 0, epic: 0 };
  const rng = lcg(11);
  for (let i = 0; i < 150; i++) {
    for (const card of rollBattleOffer(run(), 3, rng)) {
      if (card.rarity in counts) counts[card.rarity] += 1;
    }
  }
  assert.ok(counts.common > counts.rare);
  assert.ok(counts.rare > counts.epic);
});

test("gun branch card appears in the pool only when branch is null", () => {
  const open = battlePool(run());
  assert.ok(open.some((c) => c.id === "queue" && c.rarity === "legendary"));
  const chosen = run();
  chosen.gun.branch = "queue";
  const closed = battlePool(chosen);
  assert.equal(closed.some((c) => c.id === "queue" || c.id === "volley" || c.id === "ricochet"), false);
  assert.ok(closed.some((c) => c.id === "spark"));
  const offer = rollBattleOffer(run(), 99, () => 0);
  assert.ok(offer.some((c) => c.title === "Очередь"));
  const branched = run();
  branched.gun.branch = "volley";
  assert.equal(rollBattleOffer(branched, 99, () => 0).some((c) => c.id === "queue"), false);
});

test("branch cards and once-flags apply on the right weapon", () => {
  const r = run();
  battlePool(r).find((c) => c.id === "queue").apply(r);
  assert.equal(r.gun.branch, "queue");
  assert.equal(r.gun.rate, 12);
  assert.ok(Math.abs(r.crit.chance - 0.23) < 1e-9);
  battlePool(r).find((c) => c.id === "flock").apply(r);
  assert.equal(r.drone.branch, "flock");
  assert.equal(r.drone.count, 2);
  assert.ok(Math.abs(r.drone.cd - 0.26 * 0.7) < 1e-9);

  const filtered = run();
  filtered.gun.branch = "ricochet";
  filtered.gun.swarm = true;
  filtered.drone.branch = "bomb";
  filtered.drone.bombOnHit = true;
  const ids = new Set(battlePool(filtered).map((c) => c.id));
  assert.equal(ids.has("spark-s"), false);
  assert.equal(ids.has("b-hit"), false);
  assert.ok(ids.has("b1"));
});
