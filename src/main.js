import "./style.css";
import { Game, WEAPON_INFO } from "./game.js";
import { Synth } from "./audio.js";
import { loadMeta, saveMeta, upgradeCost } from "./storage.js";
import { CRYSTAL_SHOP, META_UPGRADES, SHAPES, damageShares, weaponColor, weaponLabel } from "./content.js";
import { api, newId } from "./api.js";
import { describeAffix, partFamilyLabel, activeSets } from "./parts.js";
import { canUpgrade, upgradeCost as partUpgradeCost, salvageValue } from "./salvage.js";
import { nextSpeed, speedLabel } from "./speed.js";
import { rerollLabel, rerollPrice } from "./reroll.js";
import { activeSynergies, SYNERGIES } from "./synergy.js";
import { HANGAR_TREE, hangarCost, hangarMax, hangarUnlocked, hangarNode } from "./hangar.js";
import { retryPendingClaims, retryPendingPartRolls } from "./game.js";

const $ = (id) => document.getElementById(id);
const audio = new Synth();
let meta = loadMeta();
let profile = null;

const ui = {
  save() {
    saveMeta(meta);
    refreshMenu();
  },
  showPlay() {
    hideAll();
    setHubChrome(false);
    $("hud").classList.remove("hidden");
    $("build-overlay").classList.add("hidden");
    $("result-report").classList.add("hidden");
    retryPendingClaims(applyProfile);
    retryPendingPartRolls(game);
  },
  updateHud(run) {
    $("hud-wave").textContent = String(run.wave);
    $("hud-chapter").textContent = `${run.chapterNum || 1}-${run.level}`;
    $("hud-coins").textContent = String(run.coins);
    $("hud-crit").textContent = `${Math.round((run.crit?.chance || 0) * 100)}%`;
    this.setCore(run);
    const box = $("weapons");
    const names = Object.keys(run.weapons || {}).filter((k) => run.weapons[k]);
    const pips = run.pips || {};
    box.innerHTML = names.map((k) => {
      const info = WEAPON_INFO[k];
      const dots = (pips[k] || []).map((kind) => `<i class="${kind === "legendary" ? "leg" : ""}" style="background:${kind === "legendary" ? "#ffb347" : info.color}"></i>`).join("");
      return `<div class="wep"><b style="color:${info.color}">${info.name}</b>${dots ? `<span class="pips">${dots}</span>` : ""}</div>`;
    }).join("");
  },
  setCore(run) {
    const tower = run?.tower;
    if (tower && $("hud-hp")) {
      const hp = Math.max(0, Math.min(1, tower.hp / (tower.maxHp || 1)));
      $("hud-hp").style.width = `${hp * 100}%`;
      $("hud-hp").style.background = hp < 0.3 ? "#ff5d7a" : "#7ee8ff";
    }
    const drive = run?.overdrive;
    if (drive && $("hud-drive")) {
      const hot = drive.left > 0;
      $("hud-drive-label").textContent = hot ? "ОВЕРДРАЙВ" : "ЗАРЯД";
      const fill = hot ? drive.left / drive.dur : drive.charge / drive.max;
      $("hud-drive").style.width = `${Math.max(0, Math.min(1, fill || 0)) * 100}%`;
      $("core-status").classList.toggle("hot", hot);
    }
  },
  setCombo(run) {
    const el = $("combo");
    if (run.combo < 2 || !run.comboType) {
      el.classList.add("hidden");
      return;
    }
    const names = { circle: "●", triangle: "▲", square: "■", hex: "⬢", diamond: "◆", boss: "✸" };
    el.classList.remove("hidden");
    $("combo-text").textContent = `${names[run.comboType] || "●"} × ${run.combo}`;
  },
  showCards(cards, heading, used = 0) {
    setHubChrome(false);
    $("screen-cards").classList.remove("hidden");
    if (heading) {
      $("cards-title").textContent = heading.title;
      $("cards-sub").textContent = heading.sub;
    }
    const price = rerollPrice(used);
    const reroll = $("btn-reroll");
    reroll.textContent = rerollLabel(price);
    reroll.disabled = !price;
    reroll.dataset.used = String(used);
    reroll.classList.toggle("hidden", heading?.reroll === false);
    $("card-row").innerHTML = "";
    cards.forEach((card) => {
      const btn = document.createElement("button");
      btn.className = `card ${card.rarity}`;
      const labels = { legendary: "ЛЕГЕНДАРКА", epic: "ЭПИК", rare: "РЕДКАЯ", common: "ОБЫЧНАЯ" };
      btn.innerHTML = `<span class="card-top"><small>${labels[card.rarity] || "ОБЫЧНАЯ"}</small><em>${card.who || "Общая карта"}</em></span><strong>${card.title}</strong><p>${card.desc}</p>`;
      btn.onclick = () => game.applyCard(card);
      $("card-row").appendChild(btn);
    });
  },
  hideCards() {
    $("screen-cards").classList.add("hidden");
  },
  showLevelClear(info) {
    setHubChrome(false);
    $("hud").classList.add("hidden");
    $("screen-level-clear").classList.remove("hidden");
    const chapter = info.chapter || 1;
    const chapterPrefix = chapter > 1 ? `ГЛАВА ${chapter} · ` : "";
    $("clear-title").textContent = `${chapterPrefix}УРОВЕНЬ ${info.level} ПРОЙДЕН`;
    $("clear-coins").textContent = `+${info.coins}`;
    $("clear-crystals").textContent = info.crystals ? `+${info.crystals}` : "0";
    $("clear-note").textContent = info.crystals
      ? "Кристаллы за первое прохождение придут вместе с наградой забега."
      : "Этот уровень уже был пройден. Кристаллы за него больше не выдаются.";
    $("clear-part").textContent = "";
    $("clear-part").classList.add("hidden");
    $("btn-next-level").classList.toggle("hidden", !info.canNext);
    $("btn-next-chapter").classList.toggle("hidden", !info.chapterDone);
    $("btn-next-chapter").textContent = `ГЛАВА ${chapter + 1}`;
  },
  setLevelClearPart(line) {
    const el = $("clear-part");
    if (!line) {
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    el.textContent = line;
    el.classList.remove("hidden");
  },
  hideLevelClear() {
    $("screen-level-clear").classList.add("hidden");
    $("hud").classList.remove("hidden");
  },
  async onEndlessWave(level, wave, partLine) {
    const partSuffix = partLine ? ` · ${partLine}` : "";
    try {
      const result = await api.claimEndless(level, wave);
      if (result.profile) applyProfile(result.profile);
      const crystalText = result.granted
        ? `+${result.granted} кристаллов за волну ${wave}`
        : `Волна ${wave} уже была забрана`;
      ui.toast(`${crystalText}${partSuffix}`);
    } catch {
      ui.toast(`Кристаллы за волну придут при появлении связи${partSuffix}`);
    }
  },
  showResult(win, run, granted, extra = {}) {
    setHubChrome(false);
    $("hud").classList.add("hidden");
    $("build-overlay").classList.add("hidden");
    $("screen-result").classList.remove("hidden");
    $("result-title").textContent = win ? "ГЛАВА УДЕРЖАНА" : "ЯДРО ПАЛО";
    renderReport(run);
    const chapter = run.chapterNum || 1;
    $("result-wave").textContent = chapter > 1 ? `Гл.${chapter} · ${run.level}` : String(run.level);
    const kills = run.kills && typeof run.kills === "object"
      ? Object.values(run.kills).reduce((sum, n) => sum + Number(n || 0), 0)
      : run.kills;
    $("result-kills").textContent = String(kills || 0);
    if (extra.pending || !granted) {
      $("result-sub").textContent = "Награда будет выдана при появлении связи";
      $("result-coins").textContent = "…";
      $("result-crystals").textContent = "…";
      return;
    }
    const fullRun = win && (run.startedLevel || 1) === 1;
    $("result-sub").textContent = fullRun
      ? "Все 3 уровня пройдены. Награда уже на аккаунте."
      : win
        ? `Уровень ${run.level} пройден. Награда уже на аккаунте.`
        : `Уровень ${run.level} не удержан. Награда уже на аккаунте.`;
    $("result-coins").textContent = `+${granted.coins || 0}`;
    $("result-crystals").textContent = `+${granted.crystals || 0}`;
    ui.toast(`+${granted.coins || 0} монет, +${granted.crystals || 0} кристаллов`, 2600);
  },
  toast(text, ms = 1400) {
    const el = $("toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(ui._t);
    ui._t = setTimeout(() => el.classList.add("hidden"), ms);
  },
};

const game = new Game($("game"), ui, audio, meta);

const SCREENS = [
  "screen-login",
  "screen-menu",
  "screen-levels",
  "screen-coop",
  "screen-hangar",
  "screen-parts",
  "screen-shop",
  "screen-dailies",
  "screen-how",
  "screen-collection",
  "screen-settings",
  "screen-save",
  "screen-dev",
  "screen-cards",
  "screen-result",
  "screen-level-clear",
];
const HUB_TABS = {
  play: { screen: "screen-menu", render: refreshMenu },
  hangar: { screen: "screen-hangar", render: () => renderHangar() },
  parts: { screen: "screen-parts", render: () => renderParts() },
  shop: { screen: "screen-shop", render: () => renderShop() },
  tasks: { screen: "screen-dailies", render: () => renderTasks() },
};
const FURTHEST_LEVEL = 40;
const SEEN_PARTS_KEY = "roguebullet-seen-parts";
const SAVE_PROMPT_KEY = "roguebullet-save-prompt-shown";
const SHOP_WEAPONS = ["laser", "scatter", "grenade", "emp", "orb", "drone"];
const DAILY_TITLES = {
  wave3: "Пройти 3-ю волну",
  kills40: "Убить 40 врагов",
  kills150: "Убить 150 врагов",
  level: "Пройти 1 уровень",
  endless8: "Дойти до 8-й волны орды",
};
const ACHIEVEMENT_TITLES = {
  first_blood: "Первая кровь",
  first_boss: "Первый босс",
  three_levels: "Три уровня",
  kills_100: "Сотня",
  kills_500: "Полтысячи",
  kills_2000: "Две тысячи",
  hangar: "Ангар",
  hangar_10: "Инженер",
  chest: "Сундук",
  chest_10: "Кладоискатель",
  endless_10: "Орда: 10 волн",
  endless_25: "Орда: 25 волн",
  chapter_1: "Глава 1 пройдена",
  chapter_2: "Глава 2 пройдена",
  chapter_3: "Глава 3 пройдена",
  chapter_4: "Глава 4 пройдена",
  chapter_5: "Глава 5 пройдена",
  chapter_6: "Глава 6 пройдена",
  chapter_7: "Глава 7 пройдена",
  chapter_8: "Глава 8 пройдена",
};
const PART_RARITY_LABELS = {
  legendary: "ЛЕГЕНДАРКА",
  epic: "ЭПИК",
  rare: "РЕДКАЯ",
  common: "ОБЫЧНАЯ",
};

function hideAll() {
  for (const id of SCREENS) $(id).classList.add("hidden");
}

function setHubChrome(on) {
  $("hub-top").classList.toggle("hidden", !on);
  $("tabbar").classList.toggle("hidden", !on);
}

function openScreen(id) {
  hideAll();
  setHubChrome(false);
  $(id).classList.remove("hidden");
}

let activeTab = "play";

function showTab(name) {
  const tab = HUB_TABS[name] || HUB_TABS.play;
  activeTab = HUB_TABS[name] ? name : "play";
  hideAll();
  $("hud").classList.add("hidden");
  $("build-overlay").classList.add("hidden");
  $("result-report").classList.add("hidden");
  setHubChrome(true);
  $(tab.screen).classList.remove("hidden");
  document.querySelectorAll("#tabbar .tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });
  if (activeTab === "parts") markPartsSeen();
  tab.render?.();
  refreshMenu();
  updateBadges();
}

function applyProfile(next) {
  profile = next;
  game.profile = next;
  refreshMenu();
  updateBadges();
}

ui.applyProfile = applyProfile;

function refreshMenu() {
  $("menu-account").textContent = String(profile?.accountLevel || 1);
  $("menu-coins").textContent = String(profile?.coins || 0);
  $("menu-crystals").textContent = String(profile?.crystals || 0);
  const furthest = furthestOpenLevel();
  const fchap = Math.floor((furthest - 1) / 5) + 1;
  const fsub = ((furthest - 1) % 5) + 1;
  $("btn-play").textContent = `В БОЙ · УРОВЕНЬ ${fchap}-${fsub}`;
  const tester = !!profile?.tester;
  $("btn-coop").hidden = !tester;
  $("btn-dev").hidden = !tester;
}

function furthestOpenLevel() {
  const cleared = new Set(profile?.clearedLevels || []);
  let level = 1;
  while (level < FURTHEST_LEVEL && cleared.has(level)) level += 1;
  return level;
}

function seenPartIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_PARTS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markPartsSeen() {
  const ids = (profile?.parts || []).map((p) => p.id);
  localStorage.setItem(SEEN_PARTS_KEY, JSON.stringify(ids));
}

function hasNewParts() {
  const seen = seenPartIds();
  return (profile?.parts || []).some((p) => !seen.has(p.id));
}

function updateBadges() {
  const coins = profile?.coins || 0;
  const crystals = profile?.crystals || 0;
  const hangarReady = META_UPGRADES.some((u) => coins >= upgradeCost(profile?.hangar?.[u.key] || 0));
  const owned = new Set(profile?.weapons || []);
  const shopReady =
    crystals >= 20 ||
    (crystals >= 25 && (profile?.critBonus || 0) < 10) ||
    (crystals >= 40 && SHOP_WEAPONS.some((id) => !owned.has(id))) ||
    (crystals >= 50 && !profile?.fourthCard);
  const tasksReady =
    (profile?.dailies || []).some((t) => t.done && !t.claimed) ||
    (profile?.achievements || []).some((a) => a.ready && !a.claimed);
  toggleBadge("badge-hangar", hangarReady);
  toggleBadge("badge-parts", hasNewParts() && activeTab !== "parts");
  toggleBadge("badge-shop", shopReady);
  toggleBadge("badge-tasks", tasksReady);
}

function toggleBadge(id, on) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !on);
}

function showLogin(message) {
  hideAll();
  setHubChrome(false);
  $("login-error").textContent = message || "";
  $("screen-login").classList.remove("hidden");
}

function showMenu() {
  showTab("play");
  retryPendingClaims(applyProfile);
  retryPendingPartRolls(game);
  maybePromptSave();
}

function maybePromptSave() {
  if (!profile?.isGuest) return;
  if (localStorage.getItem(SAVE_PROMPT_KEY)) return;
  if (!(profile?.clearedLevels || []).length) return;
  localStorage.setItem(SAVE_PROMPT_KEY, "1");
  openSaveScreen();
}

function renderTasks() {
  renderDailies();
  renderAchievements();
  renderLeaderboard();
}

async function renderLeaderboard() {
  const list = $("leaderboard-list");
  const seasonLine = $("season-line");
  if (!list) return;
  list.innerHTML = `<div class="sub">Загрузка…</div>`;
  try {
    const data = await api.leaderboard();
    const season = data.season || {};
    seasonLine.textContent = `Сезон ${season.label || "?"} · осталось дней: ${season.daysLeft ?? "?"}`;
    const top = data.top || [];
    const me = data.me;
    const onBoard = me && top.some((row) => row.rank === me.rank);
    let html = top
      .map((row) => {
        const mine = me && row.rank === me.rank ? " mine" : "";
        return `<div class="lb-row${mine}"><span class="lb-rank">${row.rank}</span><span class="lb-name">${escapeHtml(row.name)}</span><span class="lb-wave">${row.wave}</span></div>`;
      })
      .join("");
    if (me && !onBoard) {
      html += `<div class="lb-row mine lb-sep"><span class="lb-rank">${me.rank}</span><span class="lb-name">Ты</span><span class="lb-wave">${me.wave}</span></div>`;
    }
    if (!html) html = `<div class="sub">Пока никто не дошёл до орды. Будь первым!</div>`;
    list.innerHTML = html;
  } catch {
    list.innerHTML = `<div class="sub">Таблица недоступна без связи.</div>`;
  }
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

async function purchase(action, rerender) {
  try {
    const result = await action();
    applyProfile(result.profile);
    rerender?.();
    return result;
  } catch (error) {
    ui.toast(error.message || "Не вышло");
    return null;
  }
}

function renderHangar() {
  const coins = profile?.coins || 0;
  const hangar = profile?.hangar || {};
  $("hangar-coins").textContent = String(coins);
  renderWeaponLoadout();
  $("hangar-list").innerHTML = HANGAR_TREE.map((node) => {
    const lvl = hangar[node.id] || 0;
    const max = hangarMax(node.id);
    const unlocked = hangarUnlocked(hangar, node.id);
    const maxed = lvl >= max;
    const cost = hangarCost(node.id, lvl);
    const levelText = Number.isFinite(max) ? `ур. ${lvl}/${max}` : `ур. ${lvl}`;
    let label;
    let disabled;
    if (!unlocked) {
      const req = node.requires;
      const reqNode = hangarNode(req.node);
      label = `🔒 ${reqNode?.title || req.node} ур. ${req.level}`;
      disabled = true;
    } else if (maxed) {
      label = "МАКС";
      disabled = true;
    } else {
      label = String(cost);
      disabled = coins < cost;
    }
    return `<div class="upgrade${unlocked ? "" : " locked"}"><div><strong>${node.title}</strong><div class="sub">${levelText} · ${node.desc}</div></div><button data-key="${node.id}" ${disabled ? "disabled" : ""}>${label}</button></div>`;
  }).join("");
  $("hangar-list").querySelectorAll("button[data-key]").forEach((btn) => {
    btn.onclick = () => purchase(() => api.buyHangar(btn.dataset.key), renderHangar);
  });
}

function weaponSlotCell(id, { locked = false } = {}) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "part-cell weapon-cell";
  if (!id) {
    cell.classList.add("empty");
    cell.innerHTML = `<span class="cell-glyph">+</span><span class="cell-tag">Пусто</span>`;
    return cell;
  }
  const glyph = FAMILY_GLYPH[id] || FAMILY_GLYPH.common;
  cell.innerHTML = `<span class="cell-glyph" style="color:${weaponTint(id)}">${glyph}</span><span class="cell-tag">${WEAPON_INFO[id]?.name || id}</span>`;
  if (locked) cell.classList.add("locked");
  return cell;
}

function setWeaponLoadout(next) {
  purchase(() => api.setWeaponLoadout(next), renderHangar);
}

function renderWeaponLoadout() {
  const slotsEl = $("weapon-slots");
  const invEl = $("weapon-inventory");
  if (!slotsEl || !invEl) return;
  const loadout = (Array.isArray(profile?.weaponLoadout) ? profile.weaponLoadout : ["gun", "drone"]).filter(Boolean);
  const owned = new Set([...(profile?.weapons || []), "gun", "drone"]);
  const inLoadout = new Set(loadout);
  slotsEl.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const id = loadout[i] || null;
    const locked = id === "gun";
    const cell = weaponSlotCell(id, { locked });
    if (id && !locked) {
      cell.onclick = () => setWeaponLoadout(loadout.filter((w) => w !== id));
    }
    slotsEl.appendChild(cell);
  }
  invEl.innerHTML = "";
  const arsenal = WEAPON_ORDER.filter((id) => id !== "gun" && owned.has(id));
  if (!arsenal.length) {
    invEl.innerHTML = `<p class="sub">Купите орудия в магазине.</p>`;
    return;
  }
  for (const id of arsenal) {
    const equipped = inLoadout.has(id);
    const cell = weaponSlotCell(id, { locked: false });
    if (equipped) cell.classList.add("equipped");
    cell.onclick = () => {
      if (equipped) {
        setWeaponLoadout(loadout.filter((w) => w !== id));
      } else if (loadout.length < 5) {
        setWeaponLoadout([...loadout, id]);
      } else {
        ui.toast("Максимум 5 орудий");
      }
    };
    invEl.appendChild(cell);
  }
}

function partBlock(part) {
  const affixLines = (part.affixes || [])
    .map((affix) => {
      const line = describeAffix(part.family, affix);
      const split = line.indexOf(": ");
      const name = split >= 0 ? line.slice(0, split) : line;
      const value = split >= 0 ? line.slice(split + 2) : "";
      return `<div class="part-affix"><span>${name}</span><b>${value}</b></div>`;
    })
    .join("");
  const rarity = part.rarity || "common";
  return `<strong>${part.baseName || part.base}</strong><div class="sub rarity-${rarity}">${partFamilyLabel(part.family)} · ${PART_RARITY_LABELS[rarity] || rarity}</div>${affixLines}`;
}

const BRANCH_LABELS = {
  queue: "Очередь", volley: "Залп", ricochet: "Рикошет",
  cage: "Ступор", storm: "Разряд", dome: "Купол",
  wedge: "Клин", cassette: "Кассета", crater: "Кратер",
  wave: "Вал", sheaf: "Сноп", bunch: "Гроздь",
  cut: "Резак", prism: "Призма", mirror: "Зеркало",
  flock: "Стая", bomb: "Бомбы", hunt: "Охота",
  blade: "Серп", ward: "Барьер", lunge: "Выпад",
};
const WEAPON_ORDER = ["gun", "laser", "scatter", "grenade", "emp", "orb", "drone"];

function runWeaponEntries(run) {
  const weapons = run.weapons || {};
  const entries = [];
  for (const id of WEAPON_ORDER) {
    if (id !== "gun" && id !== "drone" && !weapons[id]) continue;
    const stats = id === "gun" ? run.gun : id === "drone" ? run.drone : run.wepStats?.[id];
    if (!stats) continue;
    entries.push({ id, level: (run.pips?.[id] || []).length, branch: stats.branch || null });
  }
  return entries;
}

function cardsByWeaponLabel(run) {
  const groups = {};
  for (const c of run.takenCards || []) {
    const key = c.weapon || "Общая карта";
    (groups[key] = groups[key] || []).push(c.title);
  }
  return groups;
}

function equippedParts() {
  const loadout = new Set((profile?.loadout || []).filter(Boolean));
  return (profile?.parts || []).filter((p) => loadout.has(p.id));
}

function renderBuild() {
  const run = game.run;
  if (!run) return;
  const g = run.gun || {};
  const drive = run.overdrive || {};
  const critPct = Math.round((run.crit?.chance || 0) * 100);
  const hp = Math.max(0, Math.round(run.tower?.hp || 0));
  const maxHp = Math.round(run.tower?.maxHp || 0);
  const driveHot = drive.left > 0;
  const drivePct = drive.max ? Math.round((drive.charge / drive.max) * 100) : 0;
  $("build-summary").innerHTML = `
    <div><span>Урон пулемёта</span><b>${Math.round(g.dmg || 0)}</b></div>
    <div><span>Крит</span><b>${critPct}%</b></div>
    <div><span>HP ядра</span><b>${hp}/${maxHp}</b></div>
    <div><span>Овердрайв</span><b>${driveHot ? "активен" : `${drivePct}%`}</b></div>`;
  const groups = cardsByWeaponLabel(run);
  const dmgBy = run.dmgByWeapon || {};
  $("build-weapons").innerHTML = runWeaponEntries(run)
    .map((e) => {
      const label = weaponLabel(e.id);
      const branch = e.branch ? ` · ${BRANCH_LABELS[e.branch] || e.branch}` : "";
      const cards = (groups[label] || []).join(", ");
      const dmg = Math.round(dmgBy[e.id] || 0);
      return `<div class="build-weapon"><div class="build-weapon-head"><b style="color:${weaponColor(e.id)}">${label}</b><span>ур. ${e.level}${branch}</span></div><div class="build-weapon-dmg"><span>Нанесено урона</span><b>${dmg.toLocaleString("ru-RU")}</b></div>${cards ? `<p>${cards}</p>` : ""}</div>`;
    })
    .join("");
  const general = groups["Общая карта"] || [];
  const syns = activeSynergies(run);
  $("build-synergies").innerHTML = syns.length
    ? `<b>Синергии</b>${syns
        .map((s) => `<div class="build-syn"><b>${s.name}</b><span>${s.desc}</span></div>`)
        .join("")}`
    : "";
  const parts = equippedParts();
  const partHtml = parts.length
    ? parts.map((p) => `<span class="build-part rarity-${p.rarity || "common"}">${p.baseName || p.base} · ${partFamilyLabel(p.family)}</span>`).join("")
    : '<span class="sub">Нет надетых запчастей</span>';
  const sets = activeSets(profile?.parts || [], profile?.loadout || []);
  const setHtml = sets.length
    ? `<div class="build-sets"><b>Сеты</b>${sets.map((s) => `<div class="build-syn"><b>${partFamilyLabel(s.family)} ×${s.count}</b><span>${s.desc}</span></div>`).join("")}</div>`
    : "";
  $("build-parts").innerHTML = `${general.length ? `<div class="build-general"><b>Общие карты</b><p>${general.join(", ")}</p></div>` : ""}${setHtml}<div class="build-parts-list"><b>Запчасти</b><div>${partHtml}</div></div>`;
}

function openBuild() {
  if (!game.run || game.state !== "play") return;
  game.paused = true;
  renderBuild();
  $("build-overlay").classList.remove("hidden");
}

function closeBuild() {
  $("build-overlay").classList.add("hidden");
  if (game.state === "play") game.paused = false;
}

function renderReport(run) {
  const box = $("result-report");
  if (!box) return;
  const shares = damageShares(run.dmgByWeapon || {});
  const rows = Object.entries(shares).sort((a, b) => b[1] - a[1]);
  const kills = run.kills && typeof run.kills === "object"
    ? Object.values(run.kills).reduce((sum, n) => sum + Number(n || 0), 0)
    : run.kills || 0;
  const dur = Math.round((performance.now() - (run._startedAt || performance.now())) / 1000);
  const durText = dur >= 60 ? `${Math.floor(dur / 60)} мин ${dur % 60} с` : `${dur} с`;
  const bars = rows.length
    ? rows
        .map(([tag, share]) => {
          const pct = Math.round(share * 100);
          return `<div class="report-bar"><div class="report-bar-head"><span style="color:${weaponColor(tag)}">${weaponLabel(tag)}</span><b>${pct}%</b></div><div class="report-track"><i style="width:${pct}%;background:${weaponColor(tag)}"></i></div></div>`;
        })
        .join("")
    : '<p class="sub">Урон не зафиксирован</p>';
  const weakest = rows.length > 1 ? weaponLabel(rows[rows.length - 1][0]) : null;
  const cards = (run.takenCards || []).map((c) => c.title);
  box.innerHTML = `
    <h3>Отчёт по бою</h3>
    <div class="report-meta">
      <div><span>Убито</span><b>${kills}</b></div>
      <div><span>Время</span><b>${durText}</b></div>
      <div><span>Уровень</span><b>${(run.chapterNum || 1) > 1 ? `Гл.${run.chapterNum}·${run.level}` : run.level}</b></div>
      <div><span>Волна</span><b>${run.wave}</b></div>
    </div>
    <div class="report-bars">${bars}</div>
    ${weakest ? `<p class="report-weak">Слабое звено: <b>${weakest}</b></p>` : ""}
    ${cards.length ? `<div class="report-cards"><b>Карты забега</b><p>${cards.join(", ")}</p></div>` : ""}`;
  box.classList.remove("hidden");
}

function renderParts() {
  const parts = profile?.parts || [];
  const loadout = profile?.loadout?.length === 8 ? profile.loadout : Array(8).fill(null);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const equipped = new Set(loadout.filter(Boolean));
  closePartPopup();

  const buildSlots = (indices, host) => {
    host.innerHTML = "";
    for (const index of indices) {
      const id = loadout[index];
      const part = id ? byId.get(id) : null;
      const cell = partCell(part, { equipped: true, slot: index });
      host.appendChild(cell);
    }
  };
  buildSlots([0, 1, 2, 3], $("parts-slots-weapon"));
  buildSlots([4, 5, 6, 7], $("parts-slots-common"));

  const sets = activeSets(parts, loadout);
  $("parts-sets").innerHTML = sets.length
    ? `<p class="sub part-group">Активные сеты</p>${sets
        .map(
          (s) =>
            `<div class="set-row"><b>${partFamilyLabel(s.family)} ×${s.count}</b><span>${s.desc}</span></div>`,
        )
        .join("")}`
    : "";

  const stash = parts.filter((p) => !equipped.has(p.id));
  const list = $("parts-list");
  list.innerHTML = "";
  if (!stash.length) {
    list.innerHTML = '<p class="sub">Склад пуст.</p>';
    return;
  }
  for (const part of stash) {
    list.appendChild(partCell(part, { equipped: false }));
  }
}

const FAMILY_GLYPH = {
  gun: "≡",
  drone: "✜",
  laser: "↯",
  scatter: "⁘",
  grenade: "✸",
  emp: "◎",
  orb: "◍",
  common: "◆",
};

function partCell(part, ctx) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "part-cell";
  if (!part) {
    cell.classList.add("empty");
    cell.innerHTML = `<span class="cell-glyph">·</span><span class="cell-tag">Пусто</span>`;
    return cell;
  }
  const rarity = part.rarity || "common";
  cell.classList.add(`rarity-${rarity}`);
  const family = part.family || "common";
  const glyph = FAMILY_GLYPH[family] || FAMILY_GLYPH.common;
  const color = family === "common" ? "var(--muted, #9aa4bd)" : weaponTint(family);
  cell.innerHTML = `<span class="cell-glyph" style="color:${color}">${glyph}</span><span class="cell-tag">${partFamilyLabel(family)}</span>`;
  attachPartCell(cell, {
    onTap: () => {
      if (ctx.equipped) purchase(() => api.unequipPart(ctx.slot), renderParts);
      else purchase(() => api.equipPart(part.id), renderParts);
    },
    onHold: () => openPartPopup(part, ctx),
  });
  return cell;
}

function weaponTint(family) {
  const colors = { gun: "#7ee8ff", laser: "#60a5fa", scatter: "#fbbf24", grenade: "#fb7185", emp: "#c084fc", orb: "#34d399", drone: "#f472b6" };
  return colors[family] || "var(--text)";
}

function attachPartCell(el, { onTap, onHold }) {
  let timer = null;
  let held = false;
  const start = () => {
    held = false;
    timer = setTimeout(() => {
      held = true;
      onHold();
    }, 420);
  };
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", () => {
    cancel();
    if (!held) onTap();
  });
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

function openPartPopup(part, ctx) {
  const popup = $("part-popup");
  const actions = [];
  if (ctx.equipped) {
    actions.push(`<button data-act="unequip">Снять</button>`);
  } else {
    actions.push(`<button data-act="equip">Надеть</button>`);
    const up = canUpgrade(part.rarity);
    if (up) {
      const cost = partUpgradeCost(part.rarity);
      const dis = (profile?.crystals || 0) < cost ? "disabled" : "";
      actions.push(`<button data-act="upgrade" ${dis}>Улучшить · ${cost}◆</button>`);
    }
    actions.push(`<button class="salvage-btn" data-act="salvage">Разобрать · +${salvageValue(part.rarity)}◆</button>`);
  }
  popup.innerHTML = `<div class="part-popup-card"><div class="part-popup-info">${partBlock(part)}</div><div class="part-actions">${actions.join("")}</div><button class="part-popup-close" data-act="close">Закрыть</button></div>`;
  popup.classList.remove("hidden");
  popup.onclick = (e) => {
    if (e.target === popup) closePartPopup();
  };
  popup.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      if (act === "close") return closePartPopup();
      if (act === "unequip") return purchase(() => api.unequipPart(ctx.slot), renderParts);
      if (act === "equip") return purchase(() => api.equipPart(part.id), renderParts);
      if (act === "upgrade") return purchase(() => api.upgradePart(part.id), renderParts);
      if (act === "salvage") {
        if (!confirm(`Разобрать деталь на +${salvageValue(part.rarity)}◆? Это навсегда.`)) return;
        return purchase(() => api.salvagePart(part.id), renderParts);
      }
    };
  });
}

function closePartPopup() {
  const popup = $("part-popup");
  if (!popup) return;
  popup.classList.add("hidden");
  popup.innerHTML = "";
  popup.onclick = null;
}

function renderShop() {
  const crystals = profile?.crystals || 0;
  const owned = new Set(profile?.weapons || []);
  $("shop-crystals").textContent = String(crystals);
  const rows = [
    {
      title: "Шанс крита",
      desc: `+${CRYSTAL_SHOP.critBonus}% навсегда · ${Math.min(CRYSTAL_SHOP.critCap / CRYSTAL_SHOP.critBonus, Math.floor((profile?.critBonus || 0) / CRYSTAL_SHOP.critBonus))}/${CRYSTAL_SHOP.critCap / CRYSTAL_SHOP.critBonus}`,
      label: (profile?.critBonus || 0) >= CRYSTAL_SHOP.critCap ? "МАКС" : String(CRYSTAL_SHOP.critPrice),
      disabled: crystals < CRYSTAL_SHOP.critPrice || (profile?.critBonus || 0) >= CRYSTAL_SHOP.critCap,
      run: () => api.buyShop("crit"),
    },
    ...SHOP_WEAPONS.map((id) => ({
      title: WEAPON_INFO[id].name,
      desc: "Покупается 1 раз. Ставится в ангаре",
      label: owned.has(id) ? "ЕСТЬ" : String(CRYSTAL_SHOP.weaponPrice),
      disabled: owned.has(id) || crystals < CRYSTAL_SHOP.weaponPrice,
      run: () => api.buyShop("weapon", id),
    })),
    {
      title: "Четвёртая карта",
      desc: "В выборе усиления 4 карты вместо 3",
      label: profile?.fourthCard ? "ЕСТЬ" : String(CRYSTAL_SHOP.fourthPrice),
      disabled: !!profile?.fourthCard || crystals < CRYSTAL_SHOP.fourthPrice,
      run: () => api.buyShop("fourth_card"),
    },
  ];
  $("shop-list").innerHTML = rows
    .map(
      (row, index) =>
        `<div class="upgrade"><div><strong>${row.title}</strong><div class="sub">${row.desc}</div></div><button data-index="${index}" ${row.disabled ? "disabled" : ""}>${row.label}</button></div>`,
    )
    .join("");
  $("shop-list").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => purchase(rows[Number(btn.dataset.index)].run, renderShop);
  });
  const poor = crystals < 20;
  $("btn-chest-open").disabled = poor;
  $("btn-chest-open").textContent = poor ? "НУЖНО 20" : "ОТКРЫТЬ";
}

function renderDailies() {
  const tasks = profile?.dailies || [];
  $("daily-list").innerHTML = tasks
    .map((task) => {
      const title = DAILY_TITLES[task.id] || task.id;
      const label = task.claimed ? "ЗАБРАНО" : "ЗАБРАТЬ";
      const disabled = !task.done || task.claimed;
      return `<div class="upgrade"><div><strong>${title}</strong><div class="sub">${crystalsLabel(task.crystals)}</div></div><button data-id="${task.id}" ${disabled ? "disabled" : ""}>${label}</button></div>`;
    })
    .join("");
  $("daily-list").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => purchase(() => api.claimDaily(btn.dataset.id), renderDailies);
  });
}

function renderAchievements() {
  const items = profile?.achievements || [];
  $("achievement-list").innerHTML = items
    .map((item) => {
      const title = ACHIEVEMENT_TITLES[item.id] || item.id;
      const label = item.claimed ? "ЗАБРАНО" : "ЗАБРАТЬ";
      const disabled = !item.ready || item.claimed;
      return `<div class="upgrade"><div><strong>${title}</strong><div class="sub">${crystalsLabel(item.crystals)}</div></div><button data-id="${item.id}" ${disabled ? "disabled" : ""}>${label}</button></div>`;
    })
    .join("");
  $("achievement-list").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => purchase(() => api.claimAchievement(btn.dataset.id), renderAchievements);
  });
}

function crystalsLabel(amount) {
  const n = Math.abs(Number(amount) || 0);
  const n10 = n % 10;
  const n100 = n % 100;
  let word = "кристаллов";
  if (n10 === 1 && n100 !== 11) word = "кристалл";
  else if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) word = "кристалла";
  return `${amount} ${word}`;
}

function dropText(drop) {
  if (!drop) return "";
  if (drop.kind === "coins") return `${drop.amount} монет`;
      if (drop.kind === "crystals") return crystalsLabel(drop.amount);
  if (drop.kind === "crit") return `+${drop.amount}% крита`;
  if (drop.kind === "card") return `Карта: ${drop.card}`;
  return "";
}

const LEVELS_PER_CHAPTER = 5;
const CAMPAIGN_CHAPTERS = 8;

function levelClearCrystals(abs) {
  return 6 + Math.floor((abs - 1) / LEVELS_PER_CHAPTER) * 4;
}

function chapterBonusCrystals(chapter) {
  return 20 + (chapter - 1) * 10;
}

function levelOpen(abs) {
  const cleared = new Set(profile?.clearedLevels || []);
  return abs === 1 || cleared.has(abs - 1);
}

function chapterCleared(chapter, cleared) {
  for (let sub = 1; sub <= LEVELS_PER_CHAPTER; sub++) {
    if (!cleared.has((chapter - 1) * LEVELS_PER_CHAPTER + sub)) return false;
  }
  return true;
}

function renderLevels() {
  const cleared = new Set(profile?.clearedLevels || []);
  let maxChapter = 1;
  for (let ch = 1; ch < CAMPAIGN_CHAPTERS; ch++) {
    if (chapterCleared(ch, cleared)) maxChapter = ch + 1;
  }
  const blocks = [];
  for (let ch = 1; ch <= maxChapter; ch++) {
    const done = chapterCleared(ch, cleared);
    blocks.push(
      `<div class="chapter-head"><h3>Глава ${ch}</h3><span class="sub">${done ? "Пройдена" : `За главу: +${chapterBonusCrystals(ch)} кристаллов`}</span></div>`,
    );
    for (let sub = 1; sub <= LEVELS_PER_CHAPTER; sub++) {
      const abs = (ch - 1) * LEVELS_PER_CHAPTER + sub;
      const open = levelOpen(abs);
      const cl = cleared.has(abs);
      const note = !open
        ? "Сначала пройди предыдущий"
        : cl
          ? "Пройден. Можно начать снова."
          : `Первый раз: +${levelClearCrystals(abs)} кристаллов`;
      blocks.push(
        `<div class="upgrade level-row${cl ? " done" : ""}${open ? "" : " locked"}"><div class="level-node">${ch}-${sub}</div><div class="level-info"><div class="sub">${note}</div></div><button data-level="${abs}" ${open ? "" : "disabled"}>${open ? "В БОЙ" : "ЗАКРЫТ"}</button></div>`,
      );
    }
  }
  $("level-list").innerHTML = blocks.join("");
  $("level-list").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => beginBattle(Number(btn.dataset.level));
  });
}

function beginBattle(level = 1) {
  if (!api.token()) return;
  if (!levelOpen(level)) return;
  audio.unlock();
  game.meta = meta;
  game.profile = profile;
  game.remote = false;
  Promise.resolve(game.startRun(level)).catch((error) => ui.toast(error.message || "Бой не запустился"));
}

function coopSocket(msg) {
  const ws = new WebSocket(`ws://${location.hostname}:8090`);
  ws.onopen = () => ws.send(JSON.stringify(msg));
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.t === "err") {
      ui.toast(data.error || "Комната не найдена");
      return;
    }
    if (data.t === "room") {
      game.coop = { ws, seat: data.seat };
      $("coop-code").textContent = data.code;
      $("coop-wait").textContent = data.seat === 0 ? "Ждём друга. Пусть введёт этот код." : "Входим в уровень…";
    }
    if (data.t === "go") {
      game.coop = { ...(game.coop || {}), ws, seat: data.seat };
      game.beginCoop(data);
    } else if (data.t === "in" || data.t === "pick" || data.t === "reroll" || data.t === "continue" || data.t === "endless" || data.t === "exit") {
      game.onCoop(data);
    }
  };
  ws.onerror = () => ui.toast("Нет связи с комнатой");
}

$("btn-coop").onclick = () => {
  if (!api.token()) return;
  openScreen("screen-coop");
};
$("btn-coop-back").onclick = () => showMenu();
$("btn-coop-host").onclick = () => {
  game.resize();
  const p = profile || {};
  coopSocket({
    t: "host",
    level: 1,
    worldW: game.worldW,
    worldH: game.worldH,
    profile: {
      hangar: p.hangar || {},
      critBonus: p.critBonus || 0,
      weapons: p.weapons || [],
      fourthCard: !!p.fourthCard,
    },
  });
};
$("btn-coop-join").onclick = () => {
  const code = $("coop-join-code").value.trim().toUpperCase();
  if (code.length < 4) {
    ui.toast("Нужен код из 4 знаков");
    return;
  }
  coopSocket({ t: "join", code });
};
$("btn-play").onclick = () => {
  if (!api.token()) return;
  beginBattle(furthestOpenLevel());
};
$("btn-pick-level").onclick = () => {
  if (!api.token()) return;
  openScreen("screen-levels");
  renderLevels();
};
$("btn-levels-back").onclick = () => showMenu();
document.querySelectorAll("#tabbar .tab").forEach((btn) => {
  btn.onclick = () => showTab(btn.dataset.tab);
});
$("btn-gear").onclick = () => openSettings();

async function enter(mode) {
  const name = $("login-name").value.trim();
  const password = $("login-password").value;
  $("login-error").textContent = "";
  try {
    const session = mode === "register" ? await api.register(name, password) : await api.login(name, password);
    applyProfile(session.profile);
    showMenu();
  } catch (error) {
    $("login-error").textContent = error.message || "Вход не удался";
  }
}

$("btn-login").onclick = () => enter("login");
$("btn-register").onclick = () => enter("register");
$("btn-dev").onclick = () => {
  openScreen("screen-dev");
  $("dev-crystals").textContent = String(profile?.crystals || 0);
};
$("btn-dev-back").onclick = () => showTab("play");
$("btn-dev-crystals").onclick = () => {
  purchase(async () => {
    const result = await api.devCrystals(100);
    $("dev-crystals").textContent = String(result.profile?.crystals || 0);
    ui.toast("+100 кристаллов");
    return result;
  });
};
for (const rarity of ["common", "rare", "epic", "legendary"]) {
  $(`btn-dev-${rarity}`).onclick = () => {
    purchase(async () => {
      const result = await api.devPart(rarity);
      const part = result.part;
      if (part) ui.toast(`${part.baseName || part.base} · ${partFamilyLabel(part.family)}`);
      return result;
    });
  };
}
$("btn-chest-open").onclick = async () => {
  $("btn-chest-open").disabled = true;
  const result = await purchase(() => api.openChest(newId()), renderShop);
  if (result?.drop) $("chest-result").textContent = dropText(result.drop);
  renderShop();
};
function refreshSettings() {
  const on = meta.showDamage !== false;
  const btn = $("btn-damage-toggle");
  btn.textContent = on ? "ПОКАЗ УРОНА: ВКЛ" : "ПОКАЗ УРОНА: ВЫКЛ";
  btn.classList.toggle("primary", on);
  $("btn-save-progress").hidden = !profile?.isGuest;
}
function openSettings() {
  openScreen("screen-settings");
  refreshSettings();
}

function collectionChip(label, glyph, unlocked) {
  const glyphHtml = glyph ? `<span class="coll-glyph">${glyph}</span>` : "";
  return `<div class="coll-chip${unlocked ? "" : " locked"}">${glyphHtml}<span>${unlocked ? label : "???"}</span></div>`;
}

function collectionSection(title, items) {
  const unlocked = items.filter((i) => i.unlocked).length;
  const chips = items.map((i) => collectionChip(i.label, i.glyph, i.unlocked)).join("");
  return `<div class="coll-section"><h3>${title} <span class="sub">${unlocked}/${items.length}</span></h3><div class="coll-grid">${chips}</div></div>`;
}

function renderCollection() {
  const seen = meta.seen || {};
  const enemies = new Set(seen.enemies || []);
  const branches = new Set(seen.branches || []);
  const synergies = new Set(seen.synergies || []);
  const partFamilies = new Set((profile?.parts || []).map((p) => p.family || "common"));

  const enemyItems = Object.entries(SHAPES).map(([type, s]) => ({ label: s.name, glyph: s.glyph, unlocked: enemies.has(type) }));
  const branchItems = Object.entries(BRANCH_LABELS).map(([id, label]) => ({ label, glyph: "", unlocked: branches.has(id) }));
  const synItems = SYNERGIES.map((s) => ({ label: s.name, glyph: "", unlocked: synergies.has(s.id) }));
  const famList = ["gun", "drone", "laser", "scatter", "grenade", "emp", "orb", "common"];
  const partItems = famList.map((f) => ({ label: partFamilyLabel(f === "common" ? null : f), glyph: "", unlocked: partFamilies.has(f) }));

  $("collection-body").innerHTML =
    collectionSection("Враги", enemyItems) +
    collectionSection("Ветки оружия", branchItems) +
    collectionSection("Синергии", synItems) +
    collectionSection("Семейства запчастей", partItems);
}

function openCollection() {
  openScreen("screen-collection");
  renderCollection();
}
function openSaveScreen() {
  openScreen("screen-save");
  $("save-name").value = "";
  $("save-password").value = "";
  $("save-error").textContent = "";
}
$("btn-damage-toggle").onclick = () => {
  meta.showDamage = meta.showDamage === false;
  ui.save();
  refreshSettings();
};
$("btn-how2").onclick = () => {
  hideAll();
  setHubChrome(false);
  $("screen-how").classList.remove("hidden");
};
$("btn-collection").onclick = () => openCollection();
$("btn-collection-back").onclick = () => openSettings();
$("btn-save-progress").onclick = () => openSaveScreen();
$("btn-save-back").onclick = () => showMenu();
$("btn-save-confirm").onclick = async () => {
  const name = $("save-name").value.trim();
  const password = $("save-password").value;
  $("save-error").textContent = "";
  try {
    const result = await api.saveAccount(name, password);
    applyProfile(result.profile);
    ui.toast("Прогресс сохранён");
    showMenu();
  } catch (error) {
    $("save-error").textContent = error.message || "Не вышло сохранить";
  }
};
$("btn-login-other").onclick = () => showLogin();
$("btn-settings-back").onclick = () => showMenu();
$("btn-how-back").onclick = () => {
  meta.seenHow = true;
  ui.save();
  showMenu();
};
$("btn-reroll").onclick = async () => {
  const btn = $("btn-reroll");
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await game.rerollCards(Number(btn.dataset.used) || 0);
  } catch (err) {
    ui.toast(err.message || "Реролл не прошёл");
    btn.disabled = false;
  }
};
$("btn-speed").onclick = () => {
  game.speed = nextSpeed(game.speed || 1);
  $("btn-speed").textContent = speedLabel(game.speed);
};
$("btn-build").onclick = () => {
  if ($("build-overlay").classList.contains("hidden")) openBuild();
  else closeBuild();
};
$("btn-surrender").onclick = () => {
  if (!game.run || game.state !== "play") return;
  if (!confirm("Сдаться и покинуть бой? Награда за пройденное сохранится.")) return;
  game.surrender();
};
$("btn-build-resume").onclick = () => closeBuild();
$("btn-next-level").onclick = () => game.continueLevel();
$("btn-next-chapter").onclick = () => game.continueLevel();
$("btn-endless").onclick = () => game.beginEndless();
$("btn-clear-menu").onclick = () => {
  ui.hideLevelClear();
  game.exitAfterLevel();
};
$("btn-again").onclick = () => {
  hideAll();
  beginBattle(game.run?.startedLevel || 1);
};
$("btn-result-menu").onclick = () => {
  $("hud").classList.add("hidden");
  showMenu();
};

async function boot() {
  if (!api.token()) {
    try {
      const guest = await api.guest();
      applyProfile(guest.profile);
      showMenu();
      return;
    } catch (error) {
      showLogin(error.message || "");
      return;
    }
  }
  try {
    const me = await api.me();
    applyProfile(me.profile);
    showMenu();
  } catch (error) {
    showLogin(error.message || "Сессия не найдена");
  }
}

boot();
game.loop(performance.now());
