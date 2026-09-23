import "./style.css";
import { Game, WEAPON_INFO } from "./game.js";
import { Synth } from "./audio.js";
import { loadMeta, saveMeta, upgradeCost } from "./storage.js";
import { META_UPGRADES } from "./content.js";

const $ = (id) => document.getElementById(id);
const audio = new Synth();
let meta = loadMeta();

const ui = {
  save() {
    saveMeta(meta);
    refreshMenu();
  },
  showPlay() {
    hideAll();
    $("hud").classList.remove("hidden");
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
  showResult(win, run, gain) {
    $("hud").classList.add("hidden");
    $("screen-result").classList.remove("hidden");
    $("result-title").textContent = win ? "ГЛАВА УДЕРЖАНА" : "ЯДРО ПАЛО";
    $("result-sub").textContent = win
      ? "Босс разбит. Ядро усилилось для следующей главы."
      : "Фигуры прорвались. Улучши ангар и вернись.";
    $("result-wave").textContent = String(run.wave);
    $("result-kills").textContent = String(run.kills);
    $("result-coins").textContent = `+${gain}`;
  },
  toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(ui._t);
    ui._t = setTimeout(() => el.classList.add("hidden"), 900);
  },
};

const game = new Game($("game"), ui, audio, meta);

function hideAll() {
  for (const id of ["screen-menu", "screen-hangar", "screen-how", "screen-settings", "screen-cards", "screen-result"]) {
    $(id).classList.add("hidden");
  }
}

function refreshMenu() {
  $("menu-best").textContent = String(meta.bestWave);
  $("menu-chapter").textContent = String(meta.chapter);
  $("menu-coins").textContent = String(meta.coins);
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
  audio.unlock();
  game.meta = meta;
  game.startRun();
};
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
  audio.unlock();
  hideAll();
  game.meta = meta;
  game.startRun();
};
$("btn-result-menu").onclick = () => {
  hideAll();
  $("hud").classList.add("hidden");
  $("screen-menu").classList.remove("hidden");
  refreshMenu();
};

refreshMenu();
if (!meta.seenHow) {
  hideAll();
  $("screen-how").classList.remove("hidden");
}
game.loop(performance.now());
