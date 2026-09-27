import test from "node:test";
import assert from "node:assert/strict";
import { createBattle } from "../src/battle.js";
import { enemyForWave } from "../src/content.js";

test("clearing the last level of a chapter advances into the next chapter", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = game.run;
  assert.equal(r.chapterNum, 1);
  assert.equal(r.chapter, 1);
  r.level = 5;
  game.continueLevel();
  assert.equal(r.chapterNum, 2);
  assert.equal(r.level, 1);
  assert.equal(r.chapter, 6);
  assert.equal(r.wave, 1);
  assert.equal(game.state, "play");
  game.continueLevel();
  assert.equal(r.level, 2);
  assert.equal(r.chapter, 7);
});

test("within a chapter continueLevel just steps the level", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = game.run;
  game.continueLevel();
  assert.equal(r.chapterNum, 1);
  assert.equal(r.level, 2);
  assert.equal(r.chapter, 2);
});

test("facts report absolute campaign progress within server bounds", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = game.run;
  r.level = 3;
  game.continueLevel();
  r.levelsCleared = 5;
  r.wave = 4;
  const f = game.facts();
  assert.equal(f.startedLevel, 1);
  assert.equal(f.levelsCleared, 5);
  assert.equal(f.endedLevel, 6);
  assert.equal(f.endedWave, 4);
});

test("mid-campaign start keeps its started level and absolute ended level", () => {
  const { game } = createBattle({ profile: {}, level: 7, runId: "r2" });
  const r = game.run;
  r.levelsCleared = 2;
  const f = game.facts();
  assert.equal(f.levelsCleared, 2);
  assert.equal(f.startedLevel, 7);
  assert.equal(f.endedLevel, 9);
  assert.equal(r.chapterNum, 2);
  assert.equal(r.level, 2);
});

test("advancing to a new level resets the in-run build, endless keeps it", () => {
  const built = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = built.game.run;
  const baseDmg = r.gun.dmg;
  r.gun.dmg = baseDmg * 5;
  r.gun.level = 9;
  r.crit.mul = 6;
  r.weapons.laser = true;
  built.game.continueLevel();
  assert.equal(r.gun.dmg, baseDmg, "gun damage resets on new level");
  assert.equal(r.gun.level, 1, "gun level resets on new level");
  assert.equal(r.crit.mul, 2, "crit multiplier resets on new level");
  assert.equal(r.weapons.laser, undefined, "unlocked weapon resets on new level");

  const endlessBuilt = createBattle({ profile: {}, level: 1, runId: "r2" });
  const er = endlessBuilt.game.run;
  er.gun.dmg *= 5;
  const kept = er.gun.dmg;
  er.crit.mul = 6;
  endlessBuilt.game.beginEndless();
  assert.equal(er.gun.dmg, kept, "endless keeps upgraded gun damage");
  assert.equal(er.crit.mul, 6, "endless keeps crit multiplier");
});

test("endless claims use the absolute level so chapters do not collide", async () => {
  const { game } = createBattle({ profile: {}, level: 6, runId: "r" });
  const r = game.run;
  assert.equal(r.chapterNum, 2);
  assert.equal(r.level, 1);
  r.endlessWaves = 4;
  await game.endlessWaveCleared();
  assert.equal(game.ui.endless.level, 6);
});

test("deeper chapters scale enemy hp up", () => {
  const early = enemyForWave(1, 1, 1, () => 0.99);
  const deep = enemyForWave(1, 4, 1, () => 0.99);
  assert.ok(deep.hp > early.hp, "chapter 4 enemies are tougher than chapter 1");
});

test("level part roll keys stay distinct across chapters", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const chapter1 = game.partRollBody("level");
  assert.equal(chapter1.level, 1);
  game.run.level = 3;
  game.continueLevel();
  const chapter2 = game.partRollBody("level");
  assert.equal(chapter2.level, 4);
  assert.notEqual(chapter1.level, chapter2.level);
  assert.ok(game.partRollStillMatches(chapter2));
  assert.ok(!game.partRollStillMatches(chapter1));
});
