import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle } from "../src/battle.js";

test("surrender ends the run as a loss and keeps progress facts", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  game.run.wave = 3;
  game.run.kills.circle = 5;
  game.surrender();
  assert.equal(game.state, "result");
  assert.equal(game.run.won, false);
  const f = game.facts();
  assert.equal(f.runId, "r");
  assert.equal(f.won, false);
  assert.equal(f.kills.circle, 5);
});

test("surrender does nothing outside of active play", () => {
  const { game } = createBattle({ profile: {}, level: 1, runId: "r" });
  game.state = "cards";
  game.surrender();
  assert.equal(game.state, "cards");
});

test("remote surrender action ends the battle server-side", () => {
  const session = createBattle({ profile: {}, level: 1, runId: "r" });
  const snap = stepBattle(session, { action: "surrender" });
  assert.equal(snap.state, "result");
  assert.equal(snap.result.won, false);
});
