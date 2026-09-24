import test from "node:test";
import assert from "node:assert/strict";
import {
  rollPart,
  firstSlot,
  equipAt,
  unequip,
  sumBonuses,
  applyBonuses,
} from "../src/parts.js";

function rngFrom(values) {
  let i = 0;
  return () => values[i++] ?? 0;
}

function part(id, base, family, rarity, affixes, baseName) {
  return { id, base, baseName, family, rarity, affixes };
}

test("rollPart common core at fixed rng", () => {
  const p = rollPart(rngFrom([0.39, 0, 0, 0, 0.1]), []);
  assert.equal(p.family, null);
  assert.equal(p.baseName, "Ядро");
  assert.equal(p.rarity, "common");
});

test("rollPart gun barrel when laser is owned", () => {
  const p = rollPart(rngFrom([0.5, 0, 0, 0.2, 0.5]), ["laser"]);
  assert.equal(p.family, "gun");
  assert.equal(p.baseName, "Ствол");
});

test("rarity distribution on many rolls", () => {
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (let i = 0; i < 2000; i++) {
    const p = rollPart(Math.random, []);
    counts[p.rarity] += 1;
  }
  assert.ok(Math.abs(counts.common / 2000 - 0.55) < 0.04);
  assert.ok(Math.abs(counts.rare / 2000 - 0.3) < 0.04);
  assert.ok(Math.abs(counts.epic / 2000 - 0.1) < 0.04);
  assert.ok(Math.abs(counts.legendary / 2000 - 0.05) < 0.04);
});

test("common and rare gun parts never roll bounce", () => {
  for (let i = 0; i < 500; i++) {
    const p = rollPart(Math.random, []);
    if (p.family !== "gun") continue;
    if (p.rarity === "common" || p.rarity === "rare") {
      assert.ok(!p.affixes.some((a) => a.id === "bounce"));
    }
  }
});

test("part affix ids differ", () => {
  for (let i = 0; i < 200; i++) {
    const p = rollPart(Math.random, ["laser", "scatter"]);
    assert.equal(p.affixes.length, 2);
    assert.notEqual(p.affixes[0].id, p.affixes[1].id);
  }
});

test("firstSlot puts gun part in slot 0", () => {
  const parts = [part("g1", "barrel", "gun", "common", [], "Ствол")];
  const slots = [null, null, null, null, null, null, null, null];
  const out = firstSlot(parts, slots, "g1");
  assert.deepEqual(out.slots[0], "g1");
});

test("second part with same base is rejected", () => {
  const parts = [
    part("g1", "barrel", "gun", "common", [], "Ствол"),
    part("g2", "barrel", "gun", "rare", [], "Ствол"),
  ];
  let slots = [null, null, null, null, null, null, null, null];
  slots = firstSlot(parts, slots, "g1").slots;
  const out = firstSlot(parts, slots, "g2");
  assert.deepEqual(out, { error: "Такая уже надета" });
});

test("four gun bases fill weapon slots then fifth uses common slot", () => {
  const bases = ["barrel", "belt", "sight", "muzzle"];
  const parts = bases.map((b, i) => part(`g${i}`, b, "gun", "common", [], b));
  let slots = [null, null, null, null, null, null, null, null];
  for (let i = 0; i < 4; i++) {
    slots = firstSlot(parts, slots, `g${i}`).slots;
    assert.equal(slots[i], `g${i}`);
  }
  const p5 = part("g4", "extra", "gun", "common", [], "Extra");
  parts.push(p5);
  slots = firstSlot(parts, slots, "g4").slots;
  assert.equal(slots[4], "g4");
});

test("common part goes to slot 4 when loadout empty", () => {
  const parts = [part("c1", "core", null, "common", [], "Ядро")];
  const slots = [null, null, null, null, null, null, null, null];
  const out = firstSlot(parts, slots, "c1");
  assert.equal(out.slots[4], "c1");
  assert.equal(out.slots[0], null);
});

test("equipAt rejects common part in weapon slot", () => {
  const parts = [part("c1", "core", null, "common", [], "Ядро")];
  const slots = [null, null, null, null, null, null, null, null];
  const out = equipAt(parts, slots, "c1", 0);
  assert.ok(out.error);
});

test("equipAt rejects family mismatch in occupied slot", () => {
  const parts = [
    part("g1", "barrel", "gun", "common", [], "Ствол"),
    part("l1", "lens", "laser", "common", [], "Линза"),
  ];
  let slots = [null, null, null, null, null, null, null, null];
  slots = firstSlot(parts, slots, "g1").slots;
  const out = equipAt(parts, slots, "l1", 0);
  assert.ok(out.error);
});

test("equipAt laser in empty slot 1", () => {
  const parts = [
    part("g1", "barrel", "gun", "common", [], "Ствол"),
    part("l1", "lens", "laser", "common", [], "Линза"),
  ];
  let slots = [null, null, null, null, null, null, null, null];
  slots = firstSlot(parts, slots, "g1").slots;
  const out = equipAt(parts, slots, "l1", 1);
  assert.equal(out.slots[1], "l1");
});

test("sumBonuses caps gun damage from two legendary dmg affixes", () => {
  const affix = { id: "dmg", name: "урон", step: 4 };
  const parts = [
    part("a", "barrel", "gun", "legendary", [affix, { id: "rate", name: "скорострельность", step: 4 }]),
    part("b", "belt", "gun", "legendary", [affix, { id: "pierce", name: "пробивание", step: 4 }]),
  ];
  const slots = ["a", "b", null, null, null, null, null, null];
  const bonuses = sumBonuses(parts, slots);
  assert.equal(bonuses.gunDmg, 0.32);
});

test("sumBonuses hp only from equipped and caps at 150", () => {
  const hpAffix = { id: "hp", name: "здоровье ядра", step: 4 };
  const mk = (id) => part(id, "core", null, "legendary", [hpAffix, { id: "regen", name: "регенерация", step: 4 }]);
  const parts = [mk("h1"), mk("h2"), mk("h3"), mk("h4")];
  assert.equal(sumBonuses(parts, [null, null, null, null, null, null, null, null]).hp, 0);
  assert.equal(sumBonuses(parts, ["h1", null, null, null, null, null, null, null]).hp, 60);
  assert.equal(sumBonuses(parts, ["h1", "h2", "h3", "h4", null, null, null, null]).hp, 150);
});

test("applyBonuses updates gun damage and tower hp", () => {
  const run = {
    gun: { dmg: 17, rate: 8, pierce: 0, bounces: 0 },
    tower: { maxHp: 220, hp: 220, regen: 0 },
    crit: { chance: 0.08 },
    overdrive: { chargeGain: 1, dur: 3.4 },
    wepStats: {},
  };
  applyBonuses(run, { gunDmg: 0.4, hp: 150 });
  assert.equal(run.gun.dmg, 17 * 1.4);
  assert.equal(run.tower.maxHp, 220 + 150);
});

test("unequip clears slot", () => {
  const slots = ["a", null, null, null, null, null, null, null];
  assert.deepEqual(unequip(slots, 0), [null, null, null, null, null, null, null, null]);
});
