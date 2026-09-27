import { weaponLabel } from "./content.js";

export const SYNERGIES = [
  {
    id: "forge",
    name: "Плавильня",
    flag: "burnBlast",
    reqs: [{ weapon: "laser" }, { weapon: "grenade" }],
    desc: "Лазер + Заряд: взрывы поджигают задетых врагов.",
  },
  {
    id: "overload",
    name: "Перегрузка",
    flag: "empBurst",
    reqs: [{ weapon: "emp" }, { weapon: "gun" }],
    desc: "EMP + Пулемёт: пули бьют на +40% по замедленным и замороженным.",
  },
  {
    id: "aegis",
    name: "Рой-барьер",
    flag: "wardRush",
    reqs: [{ weapon: "orb", branch: "ward" }, { weapon: "drone" }],
    desc: "Орбиты (Барьер) + Дрон: барьер орбит восстанавливается вдвое быстрее.",
  },
];

export function weaponBranch(run, id) {
  if (!run) return null;
  if (id === "gun") return run.gun?.branch || null;
  if (id === "drone") return run.drone?.branch || null;
  return run.wepStats?.[id]?.branch || null;
}

function reqMet(run, req) {
  const branch = weaponBranch(run, req.weapon);
  if (!branch) return false;
  return req.branch ? branch === req.branch : true;
}

export function activeSynergies(run) {
  if (!run) return [];
  return SYNERGIES.filter((s) => s.reqs.every((req) => reqMet(run, req)));
}

export function synergyFlags(run) {
  const flags = {};
  for (const s of activeSynergies(run)) flags[s.flag] = true;
  return flags;
}

export function synergyReqLabels(syn) {
  return syn.reqs.map((req) => weaponLabel(req.weapon));
}
