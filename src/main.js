import "./style.css";
import { Game, WEAPON_INFO } from "./game.js";
import { Synth } from "./audio.js";
import { loadMeta, saveMeta, upgradeCost } from "./storage.js";
import { META_UPGRADES } from "./content.js";
import { api } from "./api.js";
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
    box.innerHTML = Object.keys(run.weapons)
      .filter((k) => run.weapons[k])
      .map((k) => {
        const info = WEAPON_INFO[k];
        return `<div class="wep"><b style="color:${info.color}">${info.name}</b>активно</div>`;
      })
      .join("");
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
  showCards(cards) {
    $("screen-cards").classList.remove("hidden");
    $("card-row").innerHTML = "";
    cards.forEach((card) => {
      const btn = document.createElement("button");
      btn.className = `card ${card.rarity}`;
      btn.innerHTML = `<small>${card.rarity === "epic" ? "ЭПИК" : card.rarity === "rare" ? "РЕДКАЯ" : "ОБЫЧНАЯ"}</small><strong>${card.title}</strong><p>${card.desc}</p>`;
      btn.onclick = () => game.applyCard(card);
      $("card-row").appendChild(btn);
    });
  },
  hideCards() {
    $("screen-cards").classList.add("hidden");
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
      return;
    }
    const crystals = granted.crystals ? ` Кристаллы +${granted.crystals}.` : "";
    $("result-sub").textContent = (win
      ? "Все 3 уровня пройдены. Сборка сохранила ядро до конца."
      : `Уровень ${run.level} не удержан. Улучши ангар и вернись.`) + crystals;
    $("result-coins").textContent = `+${granted.coins}`;
  },
  toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(ui._t);
    ui._t = setTimeout(() => el.classList.add("hidden"), 1400);
  },
};

const game = new Game($("game"), ui, audio, meta);

function hideAll() {
  for (const id of ["screen-login", "screen-menu", "screen-hangar", "screen-how", "screen-settings", "screen-cards", "screen-result"]) {
    $(id).classList.add("hidden");
  }
}

function applyProfile(next) {
  profile = next;
  game.profile = next;
  refreshMenu();
}

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

function renderHangar() {
  $("hangar-coins").textContent = String(meta.coins);
  $("hangar-list").innerHTML = META_UPGRADES.map((u) => {
    const lvl = meta[u.key];
    const cost = upgradeCost(lvl);
    return `<div class="upgrade"><div><strong>${u.title}</strong><div class="sub">ур. ${lvl} · ${u.desc}</div></div><button data-key="${u.key}" ${meta.coins < cost ? "disabled" : ""}>${cost}</button></div>`;
  }).join("");
  $("hangar-list").querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      const cost = upgradeCost(meta[key]);
      if (meta.coins < cost) return;
      meta.coins -= cost;
      meta[key] += 1;
      ui.save();
      renderHangar();
    };
  });
}

$("btn-play").onclick = () => {
  if (!api.token()) return;
  audio.unlock();
  game.meta = meta;
  game.profile = profile;
  game.startRun();
};

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
  hideAll();
  $("screen-hangar").classList.remove("hidden");
  renderHangar();
};
$("btn-hangar-back").onclick = () => {
  hideAll();
  $("screen-menu").classList.remove("hidden");
};
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
$("btn-again").onclick = () => {
  if (!api.token()) return;
  audio.unlock();
  hideAll();
  game.meta = meta;
  game.profile = profile;
  game.startRun();
};
$("btn-result-menu").onclick = () => {
  hideAll();
  $("hud").classList.add("hidden");
  $("screen-menu").classList.remove("hidden");
  refreshMenu();
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
