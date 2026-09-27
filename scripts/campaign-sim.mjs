import { createBattle } from "../src/battle.js";
import { enemyForWave, waveCount, startingLoadout } from "../src/content.js";

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Pick the "best" offered card: prefer weapon/gun/drone upgrades and unlocks
// over pure defensive general cards, so the sim plays a reasonable build.
function pickCard(cards) {
  if (!cards.length) return null;
  const score = (c) => {
    let s = { common: 1, rare: 2, epic: 3, legendary: 4 }[c.rarity] || 1;
    if (c.unlock) s += 1;
    if (c.who && c.who !== "Общая карта") s += 1;
    return s;
  };
  return cards.slice().sort((a, b) => score(b) - score(a))[0];
}

function autoPlay(startLevel, { maxLevels = 40, seed = 1, profile = {} } = {}) {
  const { game, ui } = createBattle({ profile, level: startLevel, runId: `sim-${startLevel}-${seed}` });
  game.rand = lcg(seed + startLevel * 7919);
  const dt = 1 / 60;
  const maxSteps = 60 * 60 * 40; // 40 in-game minutes cap
  let cleared = 0;
  let guard = 0;
  let deepestWave = 0;
  while (guard++ < maxSteps) {
    if (game.state === "play") {
      game.update(dt);
      deepestWave = Math.max(deepestWave, game.run.wave);
    } else if (game.state === "cards") {
      const pick = pickCard(ui.cards || []);
      if (pick) game.applyCard(pick);
      else break;
    } else if (game.state === "levelclear") {
      cleared += 1;
      const info = ui.levelClear;
      if (cleared >= maxLevels || !info || !info.canNext) break;
      game.continueLevel();
    } else {
      break; // result (died) or unknown
    }
  }
  const r = game.run;
  return {
    startLevel,
    cleared,
    died: game.state === "result",
    reached: `${r.chapterNum}-${r.level}`,
    reachedWave: r.wave,
    core: Math.round(Math.max(0, r.tower.hp)),
    maxCore: Math.round(r.tower.maxHp),
  };
}

function difficultyTable() {
  console.log("=== Кривая сложности (HP/урон/кол-во) ===");
  console.log("абс.ур | глава-ур | HP круга w1 | HP круга w5 | HP босса w6 | урон w1 | враги w1 | враги w5");
  for (const abs of [1, 3, 5, 6, 10, 15, 20, 30, 40]) {
    const chapter = Math.floor((abs - 1) / 5) + 1;
    const sub = ((abs - 1) % 5) + 1;
    const noRng = () => 0.99; // avoid specials/elites
    const w1 = enemyForWave(1, abs, 1, noRng);
    const w5 = enemyForWave(5, abs, 1, noRng);
    const boss = enemyForWave(6, abs, 1, noRng);
    console.log(
      `${String(abs).padStart(6)} | ${`${chapter}-${sub}`.padStart(8)} | ${String(Math.round(w1.hp)).padStart(11)} | ${String(Math.round(w5.hp)).padStart(11)} | ${String(Math.round(boss.hp)).padStart(11)} | ${String(Math.round(w1.dmg)).padStart(7)} | ${String(waveCount(1)).padStart(8)} | ${String(waveCount(5)).padStart(8)}`,
    );
  }
}

difficultyTable();

console.log("\n=== Автопрохождение с нуля (базовый лоадаут gun+drone, без ангара/деталей) ===");
console.log("Старт с уровня N, каждый уровень билд сбрасывается (как в игре). 3 сида на уровень.\n");
for (const start of [1, 2, 3, 4, 5, 6, 8, 11, 16]) {
  const runs = [1, 2, 3].map((seed) => autoPlay(start, { maxLevels: 1, seed }));
  const clears = runs.filter((r) => r.cleared >= 1).length;
  const avgCore = Math.round(runs.reduce((s, r) => s + r.core, 0) / runs.length);
  const detail = runs.map((r) => (r.cleared ? "clear" : `die ${r.reached} w${r.reachedWave}`)).join(", ");
  console.log(`уровень ${String(start).padStart(2)}: пройдено ${clears}/3, ср.HP ядра ${avgCore}  [${detail}]`);
}

console.log("\n=== Непрерывный забег с уровня 1 (сколько уровней подряд осилит с нуля) ===");
for (const seed of [1, 2, 3]) {
  const r = autoPlay(1, { maxLevels: 40, seed });
  console.log(`сид ${seed}: пройдено уровней ${r.cleared}, дошёл до ${r.reached} w${r.reachedWave}, HP ядра ${r.core}/${r.maxCore}, ${r.died ? "погиб" : "остановлен"}`);
}

function gearedProfile(level) {
  // Прокачанный ангар + крит + полный лоадаут из 5 орудий.
  return {
    hangar: { atk: level, hp: level, charge: 3, crit: 5, regen: 4, drive: 3 },
    critBonus: 10,
    weaponLoadout: ["gun", "drone", "laser", "grenade", "orb"],
    weapons: ["laser", "grenade", "orb", "scatter", "emp"],
  };
}

console.log("\n=== Автопрохождение с прокачкой (ангар + крит + 5 орудий) ===");
console.log("hangar.atk/hp = уровню (грубая модель роста меты). 3 сида.\n");
for (const start of [1, 3, 5, 6, 10, 15, 20, 30, 40]) {
  const profile = gearedProfile(Math.min(8, Math.ceil(start / 3)));
  const runs = [1, 2, 3].map((seed) => autoPlay(start, { maxLevels: 1, seed, profile }));
  const clears = runs.filter((r) => r.cleared >= 1).length;
  const avgCore = Math.round(runs.reduce((s, r) => s + r.core, 0) / runs.length);
  const detail = runs.map((r) => (r.cleared ? "clear" : `die ${r.reached} w${r.reachedWave}`)).join(", ");
  console.log(`уровень ${String(start).padStart(2)}: пройдено ${clears}/3, ср.HP ядра ${avgCore}  [${detail}]`);
}

