import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOSS_BASE,
  BOSS_EVERY,
  CRYSTAL_SHOP,
  ENEMY_KINDS,
  ENEMY_SPAWN,
  META_UPGRADES,
  SHAPES,
  WAVE_COUNT_BASE,
  WAVE_COUNT_MULT,
  WAVE_COUNT_STEP,
  WAVE_GROWTH,
  WEAPON_INFO,
  defaultWep,
  endlessEnemyWave,
  enemyForWave,
  waveCount,
} from "../src/content.js";
import { codexCardGroups } from "../src/draft.js";
import { dronePool, droneStep } from "../src/drone.js";
import { empStep } from "../src/emp.js";
import { grenadeStep } from "../src/grenade.js";
import {
  CRIT_START,
  DRONE_START,
  GUN_START,
  HANGAR_ATK_STEP,
  HANGAR_HP_STEP,
  OFFER_XP_MULT,
  OVERDRIVE,
  RESONANCE_DMG,
  RESONANCE_DMG_PER_WAVE,
  RESONANCE_NEED,
  RESONANCE_RADIUS,
  TOWER_BASE_HP,
} from "../src/game.js";
import { GUN_CRIT_CAP, GUN_RATE_CAP, gunPool, gunStep, gunXpToNext } from "../src/gun.js";
import { laserStep } from "../src/laser.js";
import { orbStep } from "../src/orb.js";
import { AFFIXES, BASES, PART_RARITY_CUTS, PART_UNIVERSAL_CHANCE, RARITY_STEP, describeAffix, partFamilyLabel } from "../src/parts.js";
import { scatterStep } from "../src/scatter.js";
import { upgradeCost } from "../src/storage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RARITY = {
  common: "обычная",
  rare: "редкая",
  epic: "эпическая",
  legendary: "легендарная",
};

const STAT = {
  dmg: "урон",
  rate: "выстрелов в секунду",
  pellets: "пули",
  pierce: "пробивание",
  bounces: "отскоки",
  life: "жизнь выстрела",
  speed: "скорость",
  gap: "зазор",
  autoTurn: "автонаводка",
  cd: "перезарядка",
  count: "число",
  radius: "радиус",
  spin: "скорость вращения",
  reach: "размах",
  width: "ширина",
  n: "дробины",
  knock: "отброс",
  slow: "замедление",
  slowMul: "сила замедления",
  slowDur: "длительность замедления",
  rays: "лучи",
  poolDmg: "урон лужи",
  bombMul: "множитель бомбы",
};

const WEAPONS = [
  { id: "gun", step: gunStep, pool: gunPool },
  { id: "laser", step: laserStep },
  { id: "scatter", step: scatterStep },
  { id: "grenade", step: grenadeStep },
  { id: "emp", step: empStep },
  { id: "orb", step: orbStep },
  { id: "drone", step: droneStep, pool: dronePool },
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readPython(name) {
  const text = fs.readFileSync(path.join(root, "server/store.py"), "utf8");
  const match = text.match(new RegExp(`^${name}\\s*=\\s*([0-9.]+)`, "m"));
  if (!match) throw new Error(`нет константы ${name}`);
  return Number(match[1]);
}

function cards(list) {
  if (!list?.length) return "<p class='muted'>Нет карт.</p>";
  return `<ul class="cards">${list
    .map(
      (card) =>
        `<li><b>${esc(card.title)}</b> <span class="tag">${esc(RARITY[card.rarity] || card.rarity || "")}</span><div>${esc(card.desc || "")}</div></li>`,
    )
    .join("")}</ul>`;
}

function stats(obj) {
  const rows = Object.entries(obj).filter(([, value]) => typeof value === "number" || typeof value === "boolean");
  if (!rows.length) return "";
  return `<table><tbody>${rows
    .map(([key, value]) => `<tr><th>${esc(STAT[key] || key)}</th><td>${esc(value)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function weaponSection(weapon, groups) {
  const info = WEAPON_INFO[weapon.id];
  const base = weapon.id === "gun" ? GUN_START : weapon.id === "drone" ? DRONE_START : defaultWep(weapon.id);
  const choice = weapon.step(5, null).cards;
  const shared = weapon.pool ? weapon.pool(null) : groups.upgrades[weapon.id] || [];
  const branches = choice
    .map((card) => {
      const extra = weapon.pool
        ? weapon.pool(card.id).filter((item) => !shared.some((baseCard) => baseCard.id === item.id))
        : [];
      return `<section class="branch"><h3>${esc(card.title)}</h3><p>${esc(card.desc)}</p>
        <h4>10-е улучшение</h4>${cards(weapon.step(10, card.id).cards)}
        <h4>15-е улучшение</h4>${cards(weapon.step(15, card.id).cards)}
        ${extra.length ? `<h4>Карты этой ветки в забеге</h4>${cards(extra)}` : ""}
      </section>`;
    })
    .join("");
  return `<section id="w-${weapon.id}"><h2>${esc(info.name)}</h2>${stats(base)}
    <h3>Ветки на 5-м улучшении</h3>${branches}
    <h3>Общие карты забега</h3>${cards(shared)}
  </section>`;
}

function partsSection(chance, every) {
  const families = ["gun", "drone", "laser", "scatter", "grenade", "emp", "orb", "common"];
  const blocks = families
    .map((family) => {
      const bases = (BASES[family] || []).map((base) => base.name).join(", ");
      const affixes = Object.entries(AFFIXES[family] || {})
        .map(([id, meta]) => {
          const step = meta.perStep != null ? 1 : RARITY_STEP[meta.minRarity] || 3;
          const sample = describeAffix(family === "common" ? null : family, { id, name: meta.name, step });
          const cap = meta.cap == null ? "без отдельного потолка" : `потолок ${meta.cap}`;
          return `<li>${esc(sample)} · с ${esc(RARITY[meta.minRarity])} · ${esc(cap)}</li>`;
        })
        .join("");
      const title = family === "common" ? "Общие" : partFamilyLabel(family);
      return `<h3>${esc(title)}</h3><p>Основы: ${esc(bases)}</p><ul>${affixes}</ul>`;
    })
    .join("");
  const rare = Math.round((PART_RARITY_CUTS.rare - PART_RARITY_CUTS.common) * 100);
  const epic = Math.round((PART_RARITY_CUTS.epic - PART_RARITY_CUTS.rare) * 100);
  const legend = Math.round((1 - PART_RARITY_CUTS.epic) * 100);
  return `<section id="parts"><h2>Запчасти</h2>
    <p>Каждый пройденный уровень даёт одну запчасть. В бесконечном режиме бросок на каждой ${every}-й волне после старта режима, шанс ${Math.round(chance * 100)}%.</p>
    <p>Общая деталь выпадает в ${Math.round(PART_UNIVERSAL_CHANCE * 100)}% случаев, иначе семейство купленного оружия. Редкость: обычная ${Math.round(PART_RARITY_CUTS.common * 100)}%, редкая ${rare}%, эпическая ${epic}%, легендарная ${legend}%. Шаг свойства равен редкости: ${Object.entries(RARITY_STEP).map(([id, step]) => `${RARITY[id]} ${step}`).join(", ")}.</p>
    ${blocks}
  </section>`;
}

function page() {
  const chance = readPython("ENDLESS_PART_CHANCE");
  const every = readPython("ENDLESS_PART_EVERY");
  const groups = codexCardGroups();
  const xpRows = [];
  for (let level = 1; level <= 20; level++) {
    const next = gunXpToNext(level);
    if (!next) break;
    xpRows.push(`<tr><td>${level}</td><td>${next}</td><td>${OFFER_XP_MULT === 1 ? next : Math.ceil(next / OFFER_XP_MULT)}</td></tr>`);
  }
  const hangarRows = [];
  for (let level = 0; level < 8; level++) hangarRows.push(`<tr><td>${level} → ${level + 1}</td><td>${upgradeCost(level)}</td></tr>`);
  const enemyRows = ENEMY_KINDS.map((enemy) => {
    const name = SHAPES[enemy.type]?.name || enemy.type;
    return `<tr><td>${esc(name)}</td><td>${enemy.hp}</td><td>${enemy.speed}</td><td>${enemy.dmg}</td><td>${enemy.xp}</td><td>${enemy.coins}</td></tr>`;
  }).join("");
  const waveRows = [];
  for (let wave = 1; wave <= 8; wave++) {
    const enemy = enemyForWave(wave, 1, 1, () => 0);
    const name = SHAPES[enemy.type]?.name || enemy.type;
    waveRows.push(
      `<tr><td>${wave}</td><td>${waveCount(wave)}</td><td>${esc(name)}</td><td>${Math.round(enemy.hp)}</td><td>${Math.round(enemy.dmg)}</td><td>${endlessEnemyWave(wave)}</td></tr>`,
    );
  }
  const xpNote =
    OFFER_XP_MULT === 1
      ? "Опыт копится как в таблице."
      : `Сейчас опыт копится в ${OFFER_XP_MULT} раза быстрее. Это временный множитель для теста.`;
  const weapons = WEAPONS.map((weapon) => weaponSection(weapon, groups)).join("");
  const nav = [
    ...WEAPONS.map((weapon) => `<a href="#w-${weapon.id}">${esc(WEAPON_INFO[weapon.id].name)}</a>`),
    `<a href="#general">Общие карты</a>`,
    `<a href="#parts">Запчасти</a>`,
    `<a href="#hangar">Ангар и магазин</a>`,
    `<a href="#waves">Волны</a>`,
    `<a href="#xp">Опыт</a>`,
    `<a href="#drive">Овердрайв</a>`,
  ].join("");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Справочник боя</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 16px/1.45 system-ui, sans-serif; background: #10141a; color: #e7eef6; }
    header, main { width: min(920px, calc(100% - 32px)); margin: 0 auto; }
    header { padding: 28px 0 8px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 8px; }
    nav a, .tag { color: #9be7ff; text-decoration: none; border: 1px solid #2a4450; border-radius: 999px; padding: 4px 10px; }
    section { padding: 18px 0 8px; border-top: 1px solid #24303a; }
    h2 { margin: 0 0 8px; }
    h3 { margin: 16px 0 6px; }
    .branch { margin: 10px 0 16px; padding: 10px 12px; background: #171d25; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #24303a; vertical-align: top; }
    th { color: #9aa8b5; font-weight: 600; }
    ul.cards, ul { padding-left: 18px; }
    .cards li { margin: 0 0 8px; }
    .muted { color: #9aa8b5; }
  </style>
</head>
<body>
  <header>
    <h1>Справочник боя</h1>
    <p class="muted">Собрано из кода игры. В меню ссылки нет.</p>
    <nav>${nav}</nav>
  </header>
  <main>
    ${weapons}
    <section id="general"><h2>Общие карты</h2>${cards(groups.general)}
      <h3>Открытие оружия</h3>${cards(groups.unlocks)}
    </section>
    ${partsSection(chance, every)}
    <section id="hangar"><h2>Ангар и магазин</h2>
      <p>Мощность ядра: +${Math.round(HANGAR_ATK_STEP * 100)}% урона пулемёта за уровень. Обшивка: +${HANGAR_HP_STEP} HP, база ядра ${TOWER_BASE_HP}. Конденсатор ускоряет набор овердрайва.</p>
      <table><thead><tr><th>Уровень ангара</th><th>Цена, монеты</th></tr></thead><tbody>${hangarRows.join("")}</tbody></table>
      <ul>
        ${META_UPGRADES.map((row) => `<li><b>${esc(row.title)}</b> — ${esc(row.desc)}</li>`).join("")}
      </ul>
      <h3>Кристаллы</h3>
      <ul>
        <li>Шанс крита: ${CRYSTAL_SHOP.critPrice} кристаллов, +${CRYSTAL_SHOP.critBonus}% , потолок ${CRYSTAL_SHOP.critCap}%.</li>
        <li>Оружие: ${CRYSTAL_SHOP.weaponPrice} кристаллов. Есть с начала каждого забега.</li>
        <li>Четвёртая карта: ${CRYSTAL_SHOP.fourthPrice} кристаллов. В выборе 4 карты вместо 3.</li>
      </ul>
    </section>
    <section id="waves"><h2>Волны</h2>
      <p>Здоровье растёт как ${WAVE_GROWTH.hpPow} в степени волны и ещё ×${WAVE_GROWTH.chapter} за главу. Урон врага +${Math.round(WAVE_GROWTH.dmgPerWave * 100)}% за волну. Босс на каждой ${BOSS_EVERY}-й волне: ${BOSS_BASE.hp} HP до роста. Обычная волна: (${WAVE_COUNT_BASE} + волна × ${WAVE_COUNT_STEP}) × ${WAVE_COUNT_MULT} врагов. Босс один.</p>
      <table><thead><tr><th>Форма</th><th>HP</th><th>Скорость</th><th>Урон</th><th>Опыт</th><th>Монеты</th></tr></thead><tbody>${enemyRows}</tbody></table>
      <p>Шанс сменить форму, если волна уже дошла: ${ENEMY_SPAWN.map((row) => `с ${row.minWave}-й ${Math.round(row.chance * 100)}%`).join(", ")}.</p>
      <table><thead><tr><th>Волна</th><th>Врагов</th><th>Форма при нулевом броске</th><th>HP</th><th>Урон</th><th>Волна бесконечного режима</th></tr></thead><tbody>${waveRows.join("")}</tbody></table>
    </section>
    <section id="xp"><h2>Опыт улучшений</h2>
      <p>${esc(xpNote)} Потолок темпа пулемёта ${GUN_RATE_CAP}. Потолок шанса крита ${Math.round(GUN_CRIT_CAP * 100)}%.</p>
      <table><thead><tr><th>Уровень</th><th>Опыт до следующего</th><th>Убийств при текущем множителе</th></tr></thead><tbody>${xpRows.join("")}</tbody></table>
    </section>
    <section id="drive"><h2>Овердрайв и резонанс форм</h2>
      <p>Овердрайв копит ${OVERDRIVE.shotGain} за выстрел. Уровень конденсатора умножает набор на 1 + уровень × ${OVERDRIVE.hangarRate}. Потолок ${OVERDRIVE.max}. Длительность ${OVERDRIVE.dur} с, урон ×${OVERDRIVE.mul}. Стартовый заряд: ${OVERDRIVE.startPerHangar} за уровень конденсатора. Базовый шанс крита ${Math.round(CRIT_START.chance * 100)}%, крит ×${CRIT_START.mul}.</p>
      <p>Резонанс форм: ${RESONANCE_NEED} одинаковых убийств подряд. Вспышка бьёт в радиусе ${RESONANCE_RADIUS} уроном ${RESONANCE_DMG} + волна × ${RESONANCE_DMG_PER_WAVE}.</p>
    </section>
  </main>
</body>
</html>`;
}

export function buildCodex(outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, page());
}

const calledDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledDirectly) buildCodex(path.join(root, "dist/codex/index.html"));
