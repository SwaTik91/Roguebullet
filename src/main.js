import "./style.css";
import { Game, WEAPON_INFO } from "./game.js";
import { Synth } from "./audio.js";
import { loadMeta, saveMeta, upgradeCost } from "./storage.js";
import { META_UPGRADES } from "./content.js";
import { api, newId } from "./api.js";
import { nextSpeed, speedLabel } from "./speed.js";
import { retryPendingClaims } from "./game.js";

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
    $("hud").classList.remove("hidden");
    retryPendingClaims(applyProfile);
  },
  updateHud(run) {
    $("hud-wave").textContent = String(run.wave);
    $("hud-chapter").textContent = String(run.chapter);
    $("hud-coins").textContent = String(run.coins);
    $("hud-crit").textContent = `${Math.round((run.crit?.chance || 0) * 100)}%`;
    const box = $("weapons");
    const offer = run.offer;
    const names = Object.keys(run.weapons || {}).filter((k) => run.weapons[k]);
    const progress = !offer ? "" : offer.level >= 15 ? "макс" : `${offer.xp}/${offer.next}`;
    box.innerHTML = `<div class="wep"><b>Усиление ${offer?.level || 1}/15</b>${progress}</div>` + names.map((k) => {
      const info = WEAPON_INFO[k];
      return `<div class="wep"><b style="color:${info.color}">${info.name}</b></div>`;
    }).join("");
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
  showCards(cards, heading) {
    $("screen-cards").classList.remove("hidden");
    if (heading) {
      $("cards-title").textContent = heading.title;
      $("cards-sub").textContent = heading.sub;
    }
    $("card-row").innerHTML = "";
    cards.forEach((card) => {
      const btn = document.createElement("button");
      btn.className = `card ${card.rarity}`;
      const labels = { legendary: "ЛЕГЕНДАРКА", epic: "ЭПИК", rare: "РЕДКАЯ", common: "ОБЫЧНАЯ" };
      btn.innerHTML = `<small>${labels[card.rarity] || "ОБЫЧНАЯ"}</small><strong>${card.title}</strong><p>${card.desc}</p>`;
      btn.onclick = () => game.applyCard(card);
      $("card-row").appendChild(btn);
    });
  },
  hideCards() {
    $("screen-cards").classList.add("hidden");
  },
  showLevelClear(info) {
    $("hud").classList.add("hidden");
    $("screen-level-clear").classList.remove("hidden");
    $("clear-title").textContent = `УРОВЕНЬ ${info.level} ПРОЙДЕН`;
    $("clear-coins").textContent = `+${info.coins}`;
    $("clear-crystals").textContent = info.crystals ? `+${info.crystals}` : "0";
    $("clear-note").textContent = info.crystals
      ? "Кристаллы за первое прохождение придут вместе с наградой забега."
      : "Этот уровень уже был пройден. Кристаллы за него больше не выдаются.";
    $("btn-next-level").classList.toggle("hidden", !info.canNext);
  },
  hideLevelClear() {
    $("screen-level-clear").classList.add("hidden");
    $("hud").classList.remove("hidden");
  },
  async onEndlessWave(level, wave) {
    try {
      const result = await api.claimEndless(level, wave);
      if (result.profile) applyProfile(result.profile);
      ui.toast(result.granted ? `+${result.granted} кристаллов за волну ${wave}` : `Волна ${wave} уже была забрана`);
    } catch {
      ui.toast("Кристаллы за волну придут при появлении связи");
    }
  },
  showResult(win, run, granted, extra = {}) {
    $("hud").classList.add("hidden");
    $("screen-result").classList.remove("hidden");
    $("result-title").textContent = win ? "ГЛАВА УДЕРЖАНА" : "ЯДРО ПАЛО";
    $("result-wave").textContent = String(run.level);
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
  "screen-hangar",
  "screen-shop",
  "screen-chest",
  "screen-dailies",
  "screen-achievements",
  "screen-how",
  "screen-settings",
  "screen-cards",
  "screen-result",
  "screen-level-clear",
];
const SHOP_WEAPONS = ["laser", "scatter", "grenade", "emp", "orb", "drone"];
const DAILY_TITLES = {
  wave3: "Пройти 3-ю волну",
  kills40: "Убить 40 врагов",
  level: "Пройти 1 уровень",
};
const ACHIEVEMENT_TITLES = {
  first_blood: "Первая кровь",
  first_boss: "Первый босс",
  three_levels: "Три уровня",
  kills_100: "Сотня",
  kills_500: "Полтысячи",
  hangar: "Ангар",
  chest: "Сундук",
};

function hideAll() {
  for (const id of SCREENS) $(id).classList.add("hidden");
}

function openScreen(id) {
  hideAll();
  $(id).classList.remove("hidden");
}

function applyProfile(next) {
  profile = next;
  game.profile = next;
  refreshMenu();
}

ui.applyProfile = applyProfile;

function refreshMenu() {
  $("menu-account").textContent = String(profile?.accountLevel || 1);
  $("menu-coins").textContent = String(profile?.coins || 0);
  $("menu-crystals").textContent = String(profile?.crystals || 0);
}

function showLogin(message) {
  hideAll();
  $("login-error").textContent = message || "";
  $("screen-login").classList.remove("hidden");
}

function showMenu() {
  hideAll();
  $("screen-menu").classList.remove("hidden");
  refreshMenu();
  retryPendingClaims(applyProfile);
  if (!meta.seenHow) {
    hideAll();
    $("screen-how").classList.remove("hidden");
  }
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
  $("hangar-coins").textContent = String(coins);
  $("hangar-list").innerHTML = META_UPGRADES.map((u) => {
    const lvl = profile?.hangar?.[u.key] || 0;
    const cost = upgradeCost(lvl);
    return `<div class="upgrade"><div><strong>${u.title}</strong><div class="sub">ур. ${lvl} · ${u.desc}</div></div><button data-key="${u.key}" ${coins < cost ? "disabled" : ""}>${cost}</button></div>`;
  }).join("");
  $("hangar-list").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => purchase(() => api.buyHangar(btn.dataset.key), renderHangar);
  });
}

function renderShop() {
  const crystals = profile?.crystals || 0;
  const owned = new Set(profile?.weapons || []);
  $("shop-crystals").textContent = String(crystals);
  const rows = [
    {
      title: "Шанс крита",
      desc: `+2% навсегда · ${Math.min(5, Math.floor((profile?.critBonus || 0) / 2))}/5`,
      label: (profile?.critBonus || 0) >= 10 ? "МАКС" : "25",
      disabled: crystals < 25 || (profile?.critBonus || 0) >= 10,
      run: () => api.buyShop("crit"),
    },
    ...SHOP_WEAPONS.map((id) => ({
      title: WEAPON_INFO[id].name,
      desc: "Есть с начала каждого забега",
      label: owned.has(id) ? "ЕСТЬ" : "40",
      disabled: owned.has(id) || crystals < 40,
      run: () => api.buyShop("weapon", id),
    })),
    {
      title: "Четвёртая карта",
      desc: "В выборе усиления 4 карты вместо 3",
      label: profile?.fourthCard ? "ЕСТЬ" : "50",
      disabled: !!profile?.fourthCard || crystals < 50,
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

function renderChest() {
  const poor = (profile?.crystals || 0) < 20;
  $("btn-chest-open").disabled = poor;
  $("btn-chest-open").textContent = poor ? "НУЖНО 20" : "ОТКРЫТЬ";
}

const LEVEL_CRYSTALS = { 1: 8, 2: 12, 3: 20 };

function levelOpen(level) {
  const cleared = new Set(profile?.clearedLevels || []);
  return level === 1 || cleared.has(level - 1);
}

function renderLevels() {
  const cleared = new Set(profile?.clearedLevels || []);
  $("level-list").innerHTML = [1, 2, 3]
    .map((level) => {
      const open = levelOpen(level);
      const done = cleared.has(level);
      const note = !open
        ? "Сначала пройди предыдущий"
        : done
          ? "Пройден. С него можно начать снова."
          : `Первый раз: ${LEVEL_CRYSTALS[level]} кристаллов`;
      return `<div class="upgrade"><div><strong>Уровень ${level}</strong><div class="sub">${note}</div></div><button data-level="${level}" ${open ? "" : "disabled"}>${open ? "В БОЙ" : "ЗАКРЫТ"}</button></div>`;
    })
    .join("");
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
  Promise.resolve(game.startRun(level)).catch((error) => ui.toast(error.message || "Бой не запустился"));
}

$("btn-play").onclick = () => {
  if (!api.token()) return;
  openScreen("screen-levels");
  renderLevels();
};
$("btn-levels-back").onclick = () => showMenu();

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
$("btn-hangar").onclick = () => {
  openScreen("screen-hangar");
  renderHangar();
};
$("btn-hangar-back").onclick = () => showMenu();
$("btn-shop").onclick = () => {
  openScreen("screen-shop");
  renderShop();
};
$("btn-shop-back").onclick = () => showMenu();
$("btn-chest").onclick = () => {
  openScreen("screen-chest");
  $("chest-result").textContent = "";
  renderChest();
};
$("btn-chest-open").onclick = async () => {
  $("btn-chest-open").disabled = true;
  const result = await purchase(() => api.openChest(newId()), renderChest);
  if (result?.drop) $("chest-result").textContent = dropText(result.drop);
  renderChest();
};
$("btn-chest-back").onclick = () => showMenu();
$("btn-dailies").onclick = () => {
  openScreen("screen-dailies");
  renderDailies();
};
$("btn-dailies-back").onclick = () => showMenu();
$("btn-achievements").onclick = () => {
  openScreen("screen-achievements");
  renderAchievements();
};
$("btn-achievements-back").onclick = () => showMenu();
$("btn-how").onclick = () => {
  hideAll();
  $("screen-how").classList.remove("hidden");
};
function refreshSettings() {
  const on = meta.showDamage !== false;
  const btn = $("btn-damage-toggle");
  btn.textContent = on ? "ПОКАЗ УРОНА: ВКЛ" : "ПОКАЗ УРОНА: ВЫКЛ";
  btn.classList.toggle("primary", on);
}
$("btn-settings").onclick = () => {
  hideAll();
  refreshSettings();
  $("screen-settings").classList.remove("hidden");
};
$("btn-damage-toggle").onclick = () => {
  meta.showDamage = meta.showDamage === false;
  ui.save();
  refreshSettings();
};
$("btn-settings-back").onclick = () => {
  hideAll();
  $("screen-menu").classList.remove("hidden");
};
$("btn-how-back").onclick = () => {
  meta.seenHow = true;
  ui.save();
  hideAll();
  $("screen-menu").classList.remove("hidden");
};
$("btn-speed").onclick = () => {
  game.speed = nextSpeed(game.speed || 1);
  $("btn-speed").textContent = speedLabel(game.speed);
};
$("btn-next-level").onclick = () => game.continueLevel();
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
    showLogin();
    return;
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
