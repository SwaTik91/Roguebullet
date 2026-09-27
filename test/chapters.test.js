import test from "node:test";
import assert from "node:assert/strict";
import { createBattle } from "../src/battle.js";
import { enemyForWave } from "../src/content.js";

test("clearing level 3 advances into the next chapter instead of ending", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = game.run;
  assert.equal(r.chapterNum, 1);
  assert.equal(r.chapter, 1);
  r.level = 3;
  game.continueLevel();
  assert.equal(r.chapterNum, 2);
  assert.equal(r.level, 1);
  assert.equal(r.chapter, 4);
  assert.equal(r.wave, 1);
  assert.equal(game.state, "play");
  game.continueLevel();
  assert.equal(r.level, 2);
  assert.equal(r.chapter, 5);
});

test("within a chapter continueLevel just steps the level", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = game.run;
  game.continueLevel();
  assert.equal(r.chapterNum, 1);
  assert.equal(r.level, 2);
  assert.equal(r.chapter, 2);
});

test("facts stay inside the server's campaign bounds across chapters", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  const r = game.run;
  r.level = 3;
  game.continueLevel();
  r.levelsCleared = 5;
  r.wave = 4;
  const f = game.facts();
  assert.equal(f.levelsCleared, 3);
  assert.equal(f.endedLevel, 3);
  assert.equal(f.endedWave, 6);
  assert.equal(f.won, true);
});

test("chapter-one facts are not inflated for a mid-campaign start", () => {
  const { game } = createBattle({ profile: {}, level: 2, runId: "r2" });
  const r = game.run;
  r.levelsCleared = 2;
  r.level = 3;
  const f = game.facts();
  assert.equal(f.levelsCleared, 2);
  assert.equal(f.endedLevel, 3);
  assert.equal(f.startedLevel, 2);
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
